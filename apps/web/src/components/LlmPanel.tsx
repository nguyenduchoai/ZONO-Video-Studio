import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, Layers, PlugZap, RefreshCw, Sparkles, Terminal } from "lucide-react";
import { api, useApi } from "../lib/api";
import { Badge, Button, Loading, Toggle, cx, inputCls, useToast } from "./ui";
import { AiAccounts } from "./AiAccounts";

const PROVIDERS = [
  { id: "claude_cli", short: "Claude (Anthropic)", label: "Claude Pro/Max (Claude CLI)", hint: "Dùng gói Claude Sếp đang đăng nhập trên máy — mạnh nhất cho chiến lược, pháp lý VN, code & REA." },
  { id: "codex_cli", short: "OpenAI (ChatGPT / DALL-E)", label: "ChatGPT Plus/Pro (Codex CLI)", hint: "Đăng nhập gói ChatGPT qua Codex CLI — chuyên tạo ảnh minh họa AI & tác vụ đa năng." },
  { id: "gemini_cli", short: "Google Gemini / Veo 3", label: "Google Gemini (Gemini CLI)", hint: "Dùng gói Google One AI qua lệnh `gemini` — tối ưu viết bài chuẩn SEO, tổng hợp web & kịch bản Video Veo 3." },
  { id: "sandbox", short: "Local Studio (Chạy tại máy)", label: "Local Studio / Sandbox", hint: "Chạy trực tiếp công cụ Local trên máy (Remotion 1080×1920, VieNeu-TTS 48kHz, Chrome 1080×1350, REA, vn-legal)." },
] as const;

const TASK_DOMAINS = [
  { id: "complex", icon: "🧠", label: "Công việc phức tạp · Chiến lược · Pháp lý VN · Code/REA", desc: "Hoạch định chiến lược, rà soát pháp lý 88 mục (vn-legal-check), dịch ngược ứng dụng (REA), phân tích sâu", rec: "claude_cli" },
  { id: "general", icon: "💬", label: "Trò chuyện điều phối · Bán hàng · CRM", desc: "Trợ lý Ngân Nguyệt / Muse Chat, tư vấn khách hàng, chăm sóc lead, viết bài mạng xã hội thường ngày", rec: "claude_cli" },
  { id: "image", icon: "🎨", label: "Tạo Ảnh AI & Thiết kế Visual (4:5 / Poster)", desc: "Sinh ảnh sản phẩm, minh họa quảng cáo bằng OpenAI (ChatGPT) kèm dự phòng Chrome Local 1080×1350", rec: "codex_cli" },
  { id: "seo", icon: "📝", label: "Viết bài chuẩn SEO · Nội dung dài · Tổng hợp Web", desc: "Bài viết chuẩn SEO Website, nghiên cứu từ khóa, tổng hợp tin tức báo chí dài", rec: "gemini_cli" },
  { id: "video", icon: "🎬", label: "Sản xuất Video · Kịch bản Veo 3 & Local Studio", desc: "Kịch bản video ngắn, điều phối Google Flow Veo 3, Gemini Video & Remotion + VieNeu-TTS 48kHz Local", rec: "gemini_cli" },
] as const;

const TIERS = [
  { key: "small", label: "Tầng nhỏ", use: "Chat khách, tóm tắt chuyển người" },
  { key: "medium", label: "Tầng vừa", use: "Brief, bài viết, kịch bản video, SEO" },
  { key: "large", label: "Tầng lớn", use: "Nghiên cứu thị trường, chiến lược" },
] as const;

/** Provider + Multi-Provider Task Routing Matrix + model-per-tier selection, used on the Settings page. */
export function LlmPanel() {
  const { data, reload, setData } = useApi<any>("llm", ["llm."]);
  const [testing, setTesting] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<Record<string, any>>({});
  const toast = useToast();
  useEffect(() => { setResults({}); }, [data?.settings?.provider, data?.settings?.codexAccountId]);
  if (!data) return <Loading />;
  const s = data.settings;
  const provStatus = data.providersStatus ?? {};
  const sysScan = data.systemScan;
  const taskRouting: Record<string, string> = s.taskRouting ?? { complex: "claude_cli", general: "claude_cli", image: "codex_cli", seo: "gemini_cli", video: "gemini_cli" };
  const priority: string[] = Array.isArray(s.providerPriority) && s.providerPriority.length ? s.providerPriority : ["claude_cli", "gemini_cli", "codex_cli", "sandbox"];

  const scanSystemClis = async () => {
    setScanning(true);
    try {
      const r = await api.post("llm/scan-system");
      setData({ ...data, settings: r.settings, effective: r.effective, providersStatus: r.providersStatus, systemScan: r.scan });
      toast("Đã quét toàn bộ hệ thống và đồng bộ các công cụ CLI AI trên máy");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setScanning(false);
    }
  };

  const save = async (patch: any, msg: string) => {
    try {
      const r = await api.put("llm", patch);
      setData({ ...data, settings: r.settings, effective: r.effective, providersStatus: r.providersStatus ?? data.providersStatus, catalog: r.catalog, selectedAccount: r.selectedAccount });
      toast(msg);
      return true;
    } catch (e: any) { toast(e.message, "err"); reload(); return false; }
  };
  const test = async (model: string) => {
    const key = `${s.provider}:${s.codexAccountId ?? ""}:${model}`;
    setTesting(key);
    try {
      const r = await api.post("llm/test", { model });
      setResults((x) => ({ ...x, [key]: r }));
      toast(r.ok ? `${model} trả lời sau ${(r.latencyMs / 1000).toFixed(1)}s` : `Lỗi: ${r.reason}`, r.ok ? "ok" : "err");
    } catch (e: any) { toast(e.message, "err"); } finally { setTesting(null); }
  };

  const movePriority = (idx: number, dir: -1 | 1) => {
    const next = [...priority];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    void save({ providerPriority: next }, "Đã cập nhật thứ tự ưu tiên nhà cung cấp AI");
  };

  const applyOptimalMatrix = () => {
    void save({
      multiProviderEnabled: true,
      taskRouting: {
        complex: "claude_cli",
        general: "claude_cli",
        image: "codex_cli",
        seo: "gemini_cli",
        video: "gemini_cli",
      },
      providerPriority: ["claude_cli", "gemini_cli", "codex_cli", "sandbox"],
    }, "Đã áp dụng Ma trận AI tối ưu: Claude (Phức tạp/Chat) · OpenAI (Ảnh) · Gemini (SEO/Video)");
  };

  return (
    <div className="space-y-5">
      {/* System CLI Auto-Scanner Summary */}
      {sysScan && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <Terminal className="h-4 w-4 text-emerald-600" />
                <span>Tự động nhận diện CLI AI trên hệ điều hành ({sysScan.platform})</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Hệ thống tự động quét {sysScan.discoveredPathDirs?.length ?? 0} thư mục môi trường trên máy để nhận diện và đồng bộ sẵn Gemini, OpenAI (Codex) và Claude.
              </p>
            </div>
            <Button size="sm" icon={RefreshCw} loading={scanning} onClick={scanSystemClis}>
              Quét lại CLI trên máy
            </Button>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {[
              { key: "gemini", item: sysScan.gemini, ready: provStatus.gemini_cli?.ready, reason: provStatus.gemini_cli?.reason },
              { key: "codex", item: sysScan.codex, ready: provStatus.codex_cli?.ready, reason: provStatus.codex_cli?.reason },
              { key: "claude", item: sysScan.claude, ready: provStatus.claude_cli?.ready, reason: provStatus.claude_cli?.reason },
            ].map(({ key, item, ready, reason }) => (
              <div key={key} className="rounded-xl border border-line bg-card p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">{item?.name ?? key}</span>
                  <Badge tone={ready ? "green" : item?.found ? "amber" : "red"}>
                    {ready ? "Sẵn sàng" : item?.found ? "Dự phòng" : "Chưa cài"}
                  </Badge>
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-muted" title={item?.resolvedPath ?? item?.bin}>
                  {item?.found ? (item.resolvedPath ?? item.bin) : "Không tìm thấy lệnh trên máy"}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {ready
                    ? `Nguồn: ${item?.accountHint ? `${item.accountHint} · ` : ""}${item?.authSource ?? "Đã đăng nhập"}`
                    : reason ?? (item?.authSource ?? "Chưa đăng nhập")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Provider AI Task Routing Matrix */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-blue-500/5 to-violet-500/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              <h3 className="text-base font-bold text-ink">Ma trận Phân công Đa Nhà cung cấp AI (Multi-Provider Task Router)</h3>
              <Badge tone={s.multiProviderEnabled !== false ? "green" : "gray"}>{s.multiProviderEnabled !== false ? "ĐANG BẬT" : "TẮT"}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              Gắn nhiều nhà cung cấp AI cùng lúc — mỗi loại việc giao cho đúng chuyên gia AI mạnh nhất (VD: <b>Claude</b> làm việc phức tạp/pháp lý, <b>OpenAI</b> tạo ảnh, <b>Gemini / Veo 3</b> viết SEO & làm video). Tự động chuyển tiếp sang AI ưu tiên kế tiếp hoặc chạy Local khi 1 bên hết hạn mức.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button size="sm" variant="primary" icon={Sparkles} onClick={applyOptimalMatrix}>Cấu hình chuẩn Khuyên dùng</Button>
            <label className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-ink">
              <span>Đa nhà cung cấp</span>
              <Toggle checked={s.multiProviderEnabled !== false} onChange={(v) => void save({ multiProviderEnabled: v }, v ? "Đã bật định tuyến Đa Nhà cung cấp AI" : "Đã chuyển về chế độ 1 nhà cung cấp")} />
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5">
          {TASK_DOMAINS.map((dom) => {
            const assigned = taskRouting[dom.id] ?? dom.rec;
            const st = provStatus[assigned];
            const isReady = assigned === "sandbox" || st?.ready === true;
            return (
              <div key={dom.id} className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-card/90 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span>{dom.icon}</span>
                    <span>{dom.label}</span>
                    <Badge tone={isReady ? "green" : "amber"}>{isReady ? "Sẵn sàng" : "Tự động dự phòng"}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{dom.desc}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select
                    className={cx(inputCls, "w-64 py-1.5 text-xs font-semibold")}
                    value={assigned}
                    onChange={(e) => void save({ taskRouting: { ...taskRouting, [dom.id]: e.target.value } }, `${dom.label} → ${PROVIDERS.find((p) => p.id === e.target.value)?.short ?? e.target.value}`)}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.short}{p.id === dom.rec ? " ★ (Khuyên dùng)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Priority Fallback Chain */}
        <div className="mt-4 rounded-xl border border-line bg-card/80 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-ink">Thứ tự Ưu tiên Dự phòng (Auto-Fallback Priority)</p>
              <p className="text-[11px] text-muted">Khi nhà cung cấp được chỉ định hết phiên hoặc chạm hạn mức tuần, hệ thống tự động gọi theo thứ tự ưu tiên bên dưới:</p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {priority.map((pid, idx) => {
              const p = PROVIDERS.find((x) => x.id === pid);
              const st = provStatus[pid];
              const ready = pid === "sandbox" || st?.ready === true;
              return (
                <div key={pid} className="flex items-center gap-1.5 rounded-xl border border-line bg-soft px-2.5 py-1.5 text-xs">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">#{idx + 1}</span>
                  <span className="font-semibold text-ink">{p?.short ?? pid}</span>
                  <span className={cx("h-2 w-2 rounded-full", ready ? "bg-emerald-500" : "bg-amber-500")} title={ready ? "Sẵn sàng" : (st?.reason ?? "Chưa đăng nhập")} />
                  <div className="ml-1 flex items-center gap-0.5">
                    <button onClick={() => movePriority(idx, -1)} disabled={idx === 0} className="rounded p-0.5 text-muted hover:bg-card hover:text-ink disabled:opacity-30" title="Tăng ưu tiên"><ArrowUp className="h-3 w-3" /></button>
                    <button onClick={() => movePriority(idx, 1)} disabled={idx === priority.length - 1} className="rounded p-0.5 text-muted hover:bg-card hover:text-ink disabled:opacity-30" title="Giảm ưu tiên"><ArrowDown className="h-3 w-3" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Primary Provider Selector */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Nhà cung cấp AI Mặc định & Quản lý Đăng nhập CLI trên máy</p>
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {PROVIDERS.map((p) => {
            const active = s.provider === p.id;
            const st = provStatus[p.id];
            const ready = p.id === "sandbox" || st?.ready === true;
            return (
              <button key={p.id} onClick={() => !active && save({ provider: p.id }, `Đã chuyển nhà cung cấp chính sang: ${p.label}`)} className={cx("rounded-xl border p-3 text-left transition", active ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/15" : "border-line hover:bg-soft")}>
                <div className="flex items-center justify-between gap-1.5">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">{active && <CheckCircle2 className="h-4 w-4 text-blue-600" />}{p.label}</p>
                  <Badge tone={ready ? "green" : "amber"}>{ready ? "LIVE" : "Chờ"}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{p.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      <AiAccounts selectedId={s.codexAccountId} available={!!data.codex?.available} onChange={reload} onSelect={async (id) => { await api.put("llm", { provider: "codex_cli", codexAccountId: id }); toast("Đã chọn tài khoản ChatGPT cho đội AI"); }} />

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-soft p-3 text-xs">
        <Terminal className="h-4 w-4 text-muted" />
        <span>
          {s.provider === "codex_cli" ? (
            <>Codex CLI: <Badge tone={data.codex?.available ? "green" : "red"}>{data.codex?.version ?? "chưa cài"}</Badge> · Hồ sơ: {data.selectedAccount?.name ?? "chưa chọn"}</>
          ) : s.provider === "gemini_cli" ? (
            <>Gemini CLI: <Badge tone={data.gemini?.available ? (data.gemini?.loggedIn ? "green" : "amber") : "red"}>{data.gemini?.available ? (data.gemini?.version || "đã cài") : "chưa cài"}</Badge> · Tài khoản Google: {data.gemini?.loggedIn ? "Đã đăng nhập" : "Chưa đăng nhập"}</>
          ) : (
            <>Claude CLI: {data.cli.available ? <Badge tone={data.cli.loggedIn === false ? "red" : data.cli.loggedIn === null ? "amber" : "green"}>{data.cli.version}</Badge> : <Badge tone="red">không tìm thấy lệnh `claude`</Badge>}</>
          )}
        </span>
        <span>· Trạng thái AI: <Badge tone={data.effective.provider === "sandbox" || data.effective.ready === false ? "amber" : "green"}>{data.effective.ready === false ? "Chưa sẵn sàng" : PROVIDERS.find((p) => p.id === data.effective.provider)?.label}</Badge></span>
        {data.effective.reason && <span className="text-amber-600">({data.effective.reason})</span>}
        {s.provider === "claude_cli" && data.cli.loggedIn === false && <span className="w-full text-rose-600">Hết phiên đăng nhập — mở Terminal, gõ <code className="rounded bg-white/60 px-1">claude</code> rồi <code className="rounded bg-white/60 px-1">/login</code>.{data.cli.authError ? ` (${data.cli.authError})` : ""}</span>}
        {s.provider === "gemini_cli" && !data.gemini?.available && <span className="w-full text-amber-600">Cài Gemini CLI bằng lệnh: <code className="rounded bg-white/60 px-1">npm install -g @google/gemini-cli</code> sau đó gõ <code className="rounded bg-white/60 px-1">gemini</code> để đăng nhập tài khoản Google.</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-2">Tầng</th><th>Dùng cho</th><th>Model</th><th className="text-right">Kiểm tra</th></tr></thead>
          <tbody className="divide-y divide-line">
            {TIERS.map((t) => {
              const model = s.models[t.key];
              const resultKey = `${s.provider}:${s.codexAccountId ?? ""}:${model}`;
              const r = results[resultKey];
              return (
                <tr key={t.key}>
                  <td className="py-2.5 font-medium">{t.label}</td>
                  <td className="text-xs text-muted">{t.use}</td>
                  <td className="py-2">
                    {s.provider === "codex_cli" ? <input key={`${t.key}-${model}`} className={cx(inputCls, "py-1.5 text-sm")} aria-label={`Model ${t.label}`} list="codex-models" defaultValue={model} onBlur={async (e) => { const field = e.currentTarget; const v = field.value.trim(); if (!v) field.value = model; else if (v !== model && !await save({ models: { [t.key]: v } }, `${t.label} → ${v}`)) field.value = model; }} /> : <select className={cx(inputCls, "py-1.5 text-sm")} value={model} onChange={(e) => save({ models: { [t.key]: e.target.value } }, `${t.label} → ${e.target.value}`)}>
                      {data.catalog.map((m: any) => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}
                    </select>}
                  </td>
                  <td className="text-right">
                    <Button size="sm" icon={PlugZap} loading={testing === resultKey} disabled={!!testing || data.effective.provider === "sandbox" || data.effective.ready === false} onClick={() => test(model)}>Thử</Button>
                    {r && <p className={cx("mt-1 text-[11px]", r.ok ? "text-emerald-600" : "text-rose-600")}>{r.ok ? `OK · ${(r.latencyMs / 1000).toFixed(1)}s` : "Lỗi"}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <datalist id="codex-models">{data.catalog.map((m: any) => <option key={m.id} value={m.id}>{m.label}</option>)}</datalist>
      {s.provider === "codex_cli" && <p className="text-xs text-muted">Giữ <code>default</code> để Codex chọn model theo tài khoản. Có thể nhập ID model GPT được tài khoản hỗ trợ rồi bấm Thử. Ngân Nguyệt, chat khách và các agent nội dung dùng kết nối này; công cụ điều khiển Chrome/Flow hiện dùng Claude CLI.</p>}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">Mức suy nghĩ (effort):</span>
        {(["low", "medium", "high"] as const).map((e) => (
          <button key={e} onClick={() => save({ effort: e }, `Effort: ${e}`)} className={cx("rounded-full px-3 py-1 text-xs", s.effort === e ? "bg-blue-600 text-white" : "bg-soft text-ink hover:bg-line")}>{e === "low" ? "Thấp (nhanh)" : e === "medium" ? "Vừa" : "Cao (kỹ hơn)"}</button>
        ))}
      </div>
      <p className="text-xs text-muted">Có thể chọn model riêng cho từng agent ở trang Agent & Tác vụ. Các lượt CLI tính vào hạn mức gói của tài khoản đã chọn. Codex CLI không báo chi phí tiền cho gói ChatGPT; hệ thống ghi token thực tế khi CLI cung cấp.</p>
    </div>
  );
}
