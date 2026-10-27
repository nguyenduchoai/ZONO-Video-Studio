import { insert, q, update, type Row } from "@dotaka/db";
import { logger, nowIso } from "@dotaka/shared";

/**
 * Durable job queue stored in the DB (spec: Redis+BullMQ). Same semantics the spec asks for:
 * separate queues (ads, chat, publish, agent, review), exponential backoff with jitter,
 * idempotency keys, per-key serialization (e.g. one chat turn per conversation at a time),
 * and dead-lettering. Swap for BullMQ by re-implementing enqueue/startWorkers.
 */
export type QueueName = "agent" | "ads" | "chat" | "publish" | "review";
export type Handler = (payload: Row, job: Row) => Promise<void>;

export class PermanentError extends Error {}

export function enqueue(queue: QueueName, name: string, payload: Row, opts: { bizId?: string; runAt?: Date; idempotencyKey?: string; lockKey?: string; maxAttempts?: number } = {}): string | null {
  if (opts.idempotencyKey) {
    const existing = q.get<Row>("SELECT id FROM job WHERE idempotency_key = ?", opts.idempotencyKey);
    if (existing) return existing.id;
  }
  const row = insert("job", {
    biz_id: opts.bizId ?? null, queue, name, payload, status: "queued",
    run_at: (opts.runAt ?? new Date()).toISOString(), attempts: 0, max_attempts: opts.maxAttempts ?? 5,
    idempotency_key: opts.idempotencyKey ?? null, lock_key: opts.lockKey ?? null,
  });
  return row.id;
}

const CONCURRENCY: Record<QueueName, number> = { chat: 4, agent: 3, ads: 2, publish: 2, review: 2 };
const running = new Map<QueueName, number>();
const heldLocks = new Set<string>();
let timer: NodeJS.Timeout | null = null;

/**
 * Chọn tối đa `free` job sẵn sàng chạy của 1 hàng đợi. Job có lock_key đang bị giữ (vd. "flow-chrome" khi Video Flow /
 * đăng qua Chrome đang chạy) bị loại NGAY TRONG SQL — trước đây chỉ lấy free*3 dòng rồi bỏ qua dòng bị khoá, nên hàng chục
 * job Flow xếp hàng làm nghẽn agent.run và các job khác. Mỗi lock_key chỉ được chọn 1 job/lượt.
 * Job không có handler vẫn được trả về để người gọi đánh dấu "dead" (không tính vào số chỗ trống).
 */
export function claimJobs(queue: QueueName, free: number, held: ReadonlySet<string> = new Set(), handlerNames?: ReadonlySet<string>): Row[] {
  const out: Row[] = [];
  const locks = new Set(held);
  const seen = new Set<string>();
  let started = 0;
  for (let round = 0; round < 20 && started < free; round++) {
    const lockList = [...locks];
    const seenList = [...seen];
    const rows = q.all<Row>(
      `SELECT * FROM job WHERE queue = ? AND status = 'queued' AND run_at <= ?`
        + (lockList.length ? ` AND (lock_key IS NULL OR lock_key NOT IN (${lockList.map(() => "?").join(",")}))` : "")
        + (seenList.length ? ` AND id NOT IN (${seenList.map(() => "?").join(",")})` : "")
        + " ORDER BY run_at LIMIT ?",
      queue, nowIso(), ...lockList, ...seenList, free - started,
    );
    if (!rows.length) break;
    for (const job of rows) {
      seen.add(job.id);
      if (job.lock_key && locks.has(job.lock_key)) continue; // cùng khoá với job vừa chọn trong lượt này
      out.push(job);
      if (handlerNames && !handlerNames.has(job.name)) continue; // sẽ bị đánh dead, không chiếm chỗ
      if (job.lock_key) locks.add(job.lock_key);
      started++;
      if (started >= free) break;
    }
  }
  return out;
}

export function startWorkers(handlers: Record<string, Handler>, pollMs = 500) {
  // Recover jobs whose worker died mid-run (spec §5 "Phục hồi").
  q.run("UPDATE job SET status = 'queued' WHERE status = 'running'");
  const names = new Set(Object.keys(handlers));
  const tick = () => {
    for (const queue of Object.keys(CONCURRENCY) as QueueName[]) {
      const free = CONCURRENCY[queue] - (running.get(queue) ?? 0);
      if (free <= 0) continue;
      for (const job of claimJobs(queue, free, heldLocks, names)) {
        const h = handlers[job.name];
        if (!h) {
          update("job", job.id, { status: "dead", last_error: `No handler for ${job.name}` });
          continue;
        }
        void runJob(queue, job, h);
      }
    }
  };
  timer = setInterval(tick, pollMs);
  return () => timer && clearInterval(timer);
}

async function runJob(queue: QueueName, job: Row, h: Handler) {
  running.set(queue, (running.get(queue) ?? 0) + 1);
  if (job.lock_key) heldLocks.add(job.lock_key);
  update("job", job.id, { status: "running", attempts: job.attempts + 1 });
  try {
    await h(job.payload, job);
    update("job", job.id, { status: "done", last_error: null });
  } catch (e) {
    const attempts = job.attempts + 1;
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof PermanentError || attempts >= job.max_attempts) {
      update("job", job.id, { status: "dead", last_error: msg });
      logger.error("job.dead", { job: job.name, error: msg });
    } else {
      const backoff = Math.min(60_000, 1000 * 2 ** attempts) * (0.8 + Math.random() * 0.4);
      update("job", job.id, { status: "queued", run_at: new Date(Date.now() + backoff).toISOString(), last_error: msg });
      logger.warn("job.retry", { job: job.name, attempts, error: msg });
    }
  } finally {
    running.set(queue, (running.get(queue) ?? 1) - 1);
    if (job.lock_key) heldLocks.delete(job.lock_key);
  }
}

// ---------------- Scheduler (repeatable jobs, persisted so they survive restarts) ----------------
export function startScheduler(tickMs = 5_000) { // nhịp kiểm tra lịch 5 giây: lịch 15 giây (0.25 phút) chạy đúng nhịp
  const tick = () => {
    const now = Date.now();
    // Doanh nghiệp đã lưu trữ: không chạy lịch nền (dữ liệu & cài đặt lịch giữ nguyên để khôi phục).
    for (const s of q.all<Row>(`SELECT s.* FROM schedule s JOIN biz b ON b.id = s.biz_id WHERE s.enabled = 1 AND COALESCE(json_extract(b.settings, '$.archived'), 0) = 0`)) {
      const last = s.last_run_at ? new Date(s.last_run_at).getTime() : 0;
      if (now - last >= s.every_minutes * 60_000) {
        const slot = Math.floor(now / (s.every_minutes * 60_000));
        enqueue(s.queue, s.name, { bizId: s.biz_id }, { bizId: s.biz_id, idempotencyKey: `sched:${s.biz_id}:${s.name}:${slot}` });
        // Ghi đúng mốc `now` đã so sánh (không phải giờ sau đó vài mili-giây): trước đây lịch 1 phút trượt thành ~80 giây vì lượt kế bị hụt 1 nhịp.
        update("schedule", s.id, { last_run_at: new Date(now).toISOString() });
      }
    }
  };
  setTimeout(tick, 3000);
  const t = setInterval(tick, tickMs);
  return () => clearInterval(t);
}
