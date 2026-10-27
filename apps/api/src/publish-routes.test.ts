import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, byId, closeDb, insert, openDb, q, update, type Row } from "@dotaka/db";
import { encryptSecret } from "@dotaka/shared";
import { expireApprovals } from "@dotaka/orchestrator";
import { errorHandler } from "./http.ts";
import { channelRoutes } from "./routes/channels.ts";
import { workRoutes } from "./routes/work.ts";

/**
 * Đăng bài qua API: "Đăng ngay" từ chối kịch bản; "Đăng lại" lượt lỗi; "Mở lại" nội dung hết hạn; mục duyệt kèm lỗi đăng;
 * Kênh đăng: thêm kênh (link bắt buộc), bật/tắt, kênh đăng chính. DB :memory:, không gọi Facebook / Chrome.
 */
let B: string, B2: string, app: FastifyInstance;
const api = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown, biz = B) => app.inject({ method, url, payload: payload as any, headers: { "x-biz-id": biz } });
const content = (title: string, extra: Row = {}) => insert("content_item", { biz_id: B, agent_key: "content", kind: "social_post", channel: "facebook", title, body: `${title} — nội dung`, status: "approved", ...extra });

beforeAll(async () => {
  process.env.DB_PATH = ":memory:";
  openDb(":memory:");
  B = insert("biz", { name: "Shop Lan", settings: { ...DEFAULT_SETTINGS, quietHours: [0, 0], llm: { provider: "sandbox" } } }).id;
  B2 = insert("biz", { name: "Shop Khác", settings: { ...DEFAULT_SETTINGS, llm: { provider: "sandbox" } } }).id;
  app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  workRoutes(app);
  channelRoutes(app);
  await app.ready();
});
beforeEach(() => { for (const t of ["publish_job", "content_item", "channel", "job", "approval", "task", "goal", "creative_job"]) q.run(`DELETE FROM ${t}`); });
afterAll(async () => { await app.close(); closeDb(); });

describe("POST /v1/content/:id/publish-now", () => {
  it("kịch bản video: 400 rõ ràng, không tạo lượt đăng", async () => {
    insert("channel", { biz_id: B, platform: "facebook", kind: "page", name: "Fanpage", external_id: "P1", enabled: 1, meta: {} });
    const script = content("Kịch bản", { kind: "video_script", body: "HOOK: A | B\n\n[0-4s] cảnh\n  🎙 lời\nCaption: x" });
    const res = await api("POST", `/v1/content/${script.id}/publish-now`);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain("Kịch bản cần làm thành video trước");
    expect(q.scalar<number>("SELECT COUNT(*) FROM publish_job WHERE content_item_id = ?", script.id)).toBe(0);
  });

  it("nội dung của doanh nghiệp khác → 404; chưa duyệt → NOT_APPROVED", async () => {
    const other = insert("content_item", { biz_id: B2, agent_key: "content", kind: "social_post", channel: "facebook", title: "Của khác", body: "x", status: "approved" });
    expect((await api("POST", `/v1/content/${other.id}/publish-now`)).statusCode).toBe(404);
    const draft = content("Chưa duyệt", { status: "awaiting_approval" });
    expect((await api("POST", `/v1/content/${draft.id}/publish-now`)).json().code).toBe("NOT_APPROVED");
  });

  it("đăng ngay một bài đã duyệt: tạo lượt đăng đúng kênh + xếp hàng; bấm lần nữa dùng lại lượt đang chờ", async () => {
    const ch = insert("channel", { biz_id: B, platform: "facebook", kind: "page", name: "Fanpage", external_id: "P1", enabled: 1, meta: {} });
    const ci = content("Bài duyệt");
    const r1 = await api("POST", `/v1/content/${ci.id}/publish-now`);
    expect(r1.statusCode).toBe(200);
    const job = r1.json();
    expect(job).toMatchObject({ channel_id: ch.id, status: "scheduled" });
    const r2 = await api("POST", `/v1/content/${ci.id}/publish-now`);
    expect(r2.json().id).toBe(job.id);
    expect(q.scalar<number>("SELECT COUNT(*) FROM publish_job WHERE content_item_id = ?", ci.id)).toBe(1);
  });

  it("video đã duyệt và đã lên NHÁP trên kênh (draft_on_channel) → vẫn bấm Đăng ngay được, tạo lượt đăng công khai", async () => {
    const ch = insert("channel", { biz_id: B, platform: "facebook", kind: "page", name: "Fanpage", external_id: "P1", enabled: 1, meta: {} });
    const asset = insert("creative_asset", { biz_id: B, kind: "video", path: "x.mp4", mime: "video/mp4" });
    const v = content("Video đã lên nháp", { kind: "video", status: "draft_on_channel", asset_id: asset.id });
    insert("publish_job", { biz_id: B, content_item_id: v.id, channel_id: ch.id, scheduled_at: new Date().toISOString(), status: "draft_uploaded", mode: "draft", asset_id: asset.id, idempotency_key: `draft:x:${ch.id}` });
    const r = await api("POST", `/v1/content/${v.id}/publish-now`);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ channel_id: ch.id, status: "scheduled" });
    expect(q.scalar<number>("SELECT COUNT(*) FROM publish_job WHERE content_item_id = ? AND mode != 'draft'", v.id)).toBe(1);
  });

  it("bài đã có lượt 'chờ kết nối kênh' → Đăng ngay dùng lại đúng lượt đó (không đụng khoá duy nhất); 'cần kiểm tra' → 409", async () => {
    const ch = insert("channel", { biz_id: B, platform: "facebook", kind: "page", name: "Fanpage", external_id: "P1", enabled: 1, meta: {} });
    const a = content("Chờ kết nối");
    const ja = insert("publish_job", { biz_id: B, content_item_id: a.id, channel_id: ch.id, scheduled_at: new Date().toISOString(), status: "needs_setup", error: "x", idempotency_key: `pub:${a.id}:${ch.id}` });
    const ra = await api("POST", `/v1/content/${a.id}/publish-now`);
    expect(ra.statusCode).toBe(200);
    expect(ra.json()).toMatchObject({ id: ja.id, status: "scheduled" });
    const b = content("Cần kiểm tra");
    insert("publish_job", { biz_id: B, content_item_id: b.id, channel_id: ch.id, scheduled_at: new Date().toISOString(), status: "needs_check", error: "x", idempotency_key: `pub:${b.id}:${ch.id}` });
    const rb = await api("POST", `/v1/content/${b.id}/publish-now`);
    expect(rb.statusCode).toBe(409);
    expect(rb.json().code).toBe("MAY_BE_LIVE");
  });
});

describe("Đăng lại / Mở lại / lỗi đăng trên mục duyệt", () => {
  it("POST /v1/publish-jobs/:id/retry: failed/needs_setup/needs_check → scheduled; done → 400; doanh nghiệp khác → 404", async () => {
    const ch = insert("channel", { biz_id: B, platform: "facebook", kind: "page", name: "Fanpage", external_id: "P1", enabled: 1, meta: {} });
    const mk = (status: string) => insert("publish_job", { biz_id: B, content_item_id: content(`Bài ${status}`).id, channel_id: ch.id, scheduled_at: new Date().toISOString(), status, error: "lỗi cũ", platform_state: { externalId: "old" }, idempotency_key: `pub:${status}:${Math.random()}` });
    for (const s of ["failed", "needs_setup", "needs_check"]) {
      const j = mk(s);
      const res = await api("POST", `/v1/publish-jobs/${j.id}/retry`);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ status: "scheduled", error: null, platform_state: {} });
    }
    const done = mk("done");
    expect((await api("POST", `/v1/publish-jobs/${done.id}/retry`)).statusCode).toBe(400);
    expect((await api("POST", `/v1/publish-jobs/${done.id}/retry`, undefined, B2)).statusCode).toBe(404);
  });

  it("POST /v1/content/:id/reopen: nội dung hết hạn → mục duyệt mới; còn hạn → 409", async () => {
    const g = insert("goal", { biz_id: B, title: "G", description: "x", template: "weekly_content", status: "active", params: {} });
    const t = insert("task", { biz_id: B, goal_id: g.id, agent_key: "content", title: "Bài", status: "awaiting_approval", input: {}, depends_on: [] });
    const ci = content("Bài hết hạn", { task_id: t.id, goal_id: g.id, status: "awaiting_approval" });
    expect((await api("POST", `/v1/content/${ci.id}/reopen`)).statusCode).toBe(409);
    insert("approval", { biz_id: B, subject_type: "task", subject_id: t.id, agent_key: "content", title: "Bài hết hạn", risk: "low", status: "pending", preview: {}, expires_at: new Date(Date.now() - 1000).toISOString() });
    expireApprovals();
    expect(byId<Row>("content_item", ci.id)!.status).toBe("expired");
    const res = await api("POST", `/v1/content/${ci.id}/reopen`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ subject_type: "task", status: "pending" });
    expect(byId<Row>("content_item", ci.id)!.status).toBe("awaiting_approval");
    expect((await api("POST", `/v1/content/${ci.id}/reopen`, undefined, B2)).statusCode).toBe(404);
  });

  it("chi tiết mục duyệt kèm lỗi đăng của nội dung (failed / needs_check / needs_setup)", async () => {
    const ch = insert("channel", { biz_id: B, platform: "facebook", kind: "page", name: "Fanpage", external_id: "P1", enabled: 1, meta: {} });
    const g = insert("goal", { biz_id: B, title: "G", description: "x", template: "weekly_content", status: "active", params: {} });
    const t = insert("task", { biz_id: B, goal_id: g.id, agent_key: "content", title: "Bài", status: "awaiting_approval", input: {}, depends_on: [] });
    const ci = content("Bài lỗi đăng", { task_id: t.id });
    const ap = insert("approval", { biz_id: B, subject_type: "task", subject_id: t.id, agent_key: "content", title: "Bài", risk: "low", status: "pending", preview: {} });
    insert("publish_job", { biz_id: B, content_item_id: ci.id, channel_id: ch.id, scheduled_at: new Date().toISOString(), status: "needs_setup", error: "Chưa kết nối", idempotency_key: "pub:x:1" });
    insert("publish_job", { biz_id: B, content_item_id: ci.id, channel_id: ch.id, scheduled_at: new Date().toISOString(), status: "done", idempotency_key: "pub:x:2" });
    const detail = (await api("GET", `/v1/approvals/${ap.id}`)).json();
    expect(detail.subject.publishErrors).toHaveLength(1);
    expect(detail.subject.publishErrors[0]).toMatchObject({ status: "needs_setup", error: "Chưa kết nối", platform: "facebook", name: "Fanpage" });
  });
});

describe("cảnh báo trước khi duyệt", () => {
  const pendingTask = (extra: Row = {}) => {
    const g = insert("goal", { biz_id: B, title: "G", description: "x", template: "weekly_content", status: "active", params: {} });
    const t = insert("task", { biz_id: B, goal_id: g.id, agent_key: "content", title: "Bài", status: "awaiting_approval", input: {}, depends_on: [], ...extra });
    content("Bài chờ duyệt", { task_id: t.id, status: "awaiting_approval" });
    return insert("approval", { biz_id: B, subject_type: "task", subject_id: t.id, agent_key: "content", title: "Bài", risk: "low", status: "pending", preview: {} });
  };
  it("chưa có kênh / kênh chưa sẵn sàng → channelBlocked + lời nhắn; kênh API thật → không cảnh báo; việc 'chỉ viết' → không cảnh báo", async () => {
    const ap = pendingTask();
    let list = (await api("GET", "/v1/approvals")).json();
    expect(list.find((a: Row) => a.id === ap.id)).toMatchObject({ channelBlocked: true });
    expect(list.find((a: Row) => a.id === ap.id).channelNote).toContain("chưa có kênh facebook");
    const ch = insert("channel", { biz_id: B, platform: "facebook", kind: "page", name: "Fanpage", external_id: "P1", enabled: 1, meta: {} });
    list = (await api("GET", "/v1/approvals")).json();
    expect(list.find((a: Row) => a.id === ap.id)).toMatchObject({ channelBlocked: true });
    expect((await api("GET", `/v1/approvals/${ap.id}`)).json().channelNote).toContain("Fanpage");
    const conn = insert("connection", { biz_id: B, platform: "meta", external_account_id: "s1", token_ciphertext: encryptSecret("{}"), status: "active", mode: "live", config: {} });
    update("channel", ch.id, { connection_id: conn.id, secret_ciphertext: encryptSecret("TOKEN") });
    list = (await api("GET", "/v1/approvals")).json();
    expect(list.find((a: Row) => a.id === ap.id).channelBlocked).toBe(false);
    const solo = pendingTask({ input: { noPublish: true } });
    update("channel", ch.id, { enabled: 0 });
    list = (await api("GET", "/v1/approvals")).json();
    expect(list.find((a: Row) => a.id === solo.id).channelBlocked).toBe(false);
  });
});

describe("Kênh đăng", () => {
  it("POST /v1/publish-channels: link bắt buộc + đúng nền tảng; kênh đầu = kênh chính; trùng link → 409", async () => {
    expect((await api("POST", "/v1/publish-channels", { platform: "tiktok", name: "ZONO" })).statusCode).toBe(400);
    expect((await api("POST", "/v1/publish-channels", { platform: "tiktok", name: "ZONO", profileUrl: "https://example.com/@x" })).statusCode).toBe(400);
    const ok = await api("POST", "/v1/publish-channels", { platform: "tiktok", name: "ZONO", profileUrl: "https://www.tiktok.com/@zonoacademy" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ platform: "tiktok", isDefault: true, route: "none" });
    expect((await api("POST", "/v1/publish-channels", { platform: "tiktok", name: "Lại", profileUrl: "https://www.tiktok.com/@zonoacademy" })).statusCode).toBe(409);
    const list = (await api("GET", "/v1/publish-channels")).json();
    expect(list.channels).toHaveLength(1);
    expect(list.channels[0]).toMatchObject({ isDefault: true, removed: false });
  });

  it("PUT enabled / default; DELETE vẫn gỡ mềm và kênh gỡ không hiện lại như kênh tắt", async () => {
    const a = insert("channel", { biz_id: B, platform: "facebook", kind: "page", name: "Trang A", external_id: "A", enabled: 1, meta: { isDefault: true } });
    const b = insert("channel", { biz_id: B, platform: "facebook", kind: "page", name: "Trang B", external_id: "B", enabled: 1, meta: {} });
    const def = await api("PUT", `/v1/publish-channels/${b.id}/default`, {});
    expect(def.json()).toMatchObject({ id: b.id, isDefault: true });
    expect(byId<Row>("channel", a.id)!.meta.isDefault).toBe(false);
    expect((await api("PUT", `/v1/publish-channels/${a.id}/enabled`, { enabled: false })).json()).toMatchObject({ enabled: 0, isDefault: false });
    expect((await api("PUT", `/v1/publish-channels/${a.id}/enabled`, { enabled: "no" })).statusCode).toBe(400);
    expect((await api("PUT", `/v1/publish-channels/${a.id}/enabled`, { enabled: true })).json()).toMatchObject({ enabled: 1 });
    expect((await api("PUT", `/v1/publish-channels/${a.id}/default`, {}, B2)).statusCode).toBe(404);
    // kênh có bài chờ đăng: không tắt được
    insert("publish_job", { biz_id: B, content_item_id: content("Chờ").id, channel_id: b.id, scheduled_at: new Date().toISOString(), status: "scheduled", idempotency_key: "pub:y:1" });
    const busy = await api("PUT", `/v1/publish-channels/${b.id}/enabled`, { enabled: false });
    expect(busy.statusCode).toBe(400);
    expect(busy.json().code).toBe("IN_USE");
    // gỡ mềm (DELETE) → removed
    update("channel", a.id, { connection_id: null });
    expect((await api("DELETE", `/v1/publish-channels/${a.id}`)).statusCode).toBe(200);
    const list = (await api("GET", "/v1/publish-channels")).json();
    expect(list.channels.find((c: Row) => c.id === a.id)).toMatchObject({ enabled: 0, removed: true });
  });
});
