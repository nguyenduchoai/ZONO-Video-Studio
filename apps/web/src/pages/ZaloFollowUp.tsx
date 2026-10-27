import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, FlaskConical, MessageCircle, Plus, QrCode, RefreshCw, Save, Send, Square, Trash2, Users } from "lucide-react";
import { api, useApi } from "../lib/api";
import { LEAD, ddmm, hhmm, timeAgo, type Tone } from "../lib/format";
import { Badge, Button, Card, Empty, Field, Loading, Modal, PageHeader, Stat, Toggle, cx, inputCls, useToast } from "../components/ui";

const PLAN: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Đã lên lịch", tone: "blue" }, awaiting_approval: { label: "Chờ Sếp duyệt", tone: "amber" },
  done: { label: "Hoàn tất", tone: "green" }, stopped: { label: "Đã dừng", tone: "gray" },
};
const STATE: Record<string, string> = { awaiting_customer: "Chờ khách trả lời", human_active: "Nhân viên đang xử lý", opted_out: "Khách từ chối nhận tin", bot_active: "Đang xử lý", new: "Mới" };

export function ZaloFollowUp() {
  const toast = useToast();
  const { data, reload } = useApi<any>("zalo", ["conversation.", "approval.", "alert."]);
  const { data: plans, reload: reloadPlans } = useApi<any[]>("zalo/followups", ["conversation.", "approval."]);
  const { data: convs, reload: reloadConvs } = useApi<any[]>("zalo/conversations", ["conversation.", "lead."]);
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sim, setSim] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [zcaQrSession, setZcaQrSession] = useState<any>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [newCust, setNewCust] = useState({ customerName: "", customerPhone: "", aiEnabled: false });
  useEffect(() => { if (data) setF(data.settings); }, [data]);
  const all = () => { reload(); reloadPlans(); reloadConvs(); };

  const startQrLogin = async () => {
    setAddOpen(true);
    setGeneratingQr(true);
    try {
      const s = await api.post("zalo/zca-qr/start", {
        roleLabel: "Tư vấn & Chốt đơn Zalo cá nhân",
        autoReplyEnabled: true,
      });
      setZcaQrSession(s);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setGeneratingQr(false);
    }
  };

  useEffect(() => {
    if (!addOpen || !zcaQrSession?.sessionId) return;
    if (zcaQrSession.status !== "waiting_scan" && zcaQrSession.status !== "scanned" && zcaQrSession.status !== "generating_qr") return;
    const timer = setInterval(async () => {
      try {
        const s = await api.get(`zalo/zca-qr/${zcaQrSession.sessionId}`);
        setZcaQrSession(s);
        if (s.status === "connected" && s.account) {
          toast(`Đã đăng nhập Zalo: ${s.account.name} (${s.account.phone})!`);
          all();
          setAddOpen(false);
          clearInterval(timer);
        }
      } catch {
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [addOpen, zcaQrSession?.sessionId, zcaQrSession?.status]);
  const run = async (key: string, fn: () => Promise<any>, ok?: (r: any) => string) => {
    setBusy(key);
    try { const r = await fn(); if (ok) toast(ok(r)); all(); return r; } catch (e: any) { toast(e.message, "err"); } finally { setBusy(null); }
  };

  if (!data) return <Loading />;
  const conn = data.connection;
  const st = data.stats;
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  return (
    <div className="space-y-6">
      <PageHeader title="Quản lý Đa Tài khoản Zalo Cá nhân & Follow-up" subtitle="Đăng nhập không giới hạn tài khoản Zalo cá nhân bằng mã QR trực tiếp, gắn DNA/RAG tự động tư vấn, follow-up và đẩy đơn sang Pancake POS."
        actions={conn && <>
          <Button icon={QrCode} onClick={() => void startQrLogin()}>+ Quét QR thêm Zalo</Button>
          {conn.mode === "sandbox" && <Button icon={FlaskConical} onClick={() => setSim({ customerName: "Anh Minh", customerText: "Chào em, khóa AI Business System học phí bao nhiêu? Công ty anh 30 người", staffText: "Dạ em gửi anh thông tin chương trình ạ. Anh muốn học đợt tháng mấy ạ?" })}>Mô phỏng hội thoại</Button>}
          <Button icon={RefreshCw} loading={busy === "sync"} onClick={() => run("sync", () => api.post("zalo/sync"), (r) => r.skipped ?? (r.initialized ? "Bắt đầu theo dõi từ bây giờ" : r.text))}>Đồng bộ ngay</Button>
          <Button variant="primary" icon={Send} loading={busy === "run"} onClick={() => run("run", () => api.post("zalo/run"), (r) => `Soạn ${r.drafted} · gửi ${r.sent} · dừng ${r.stopped}`)}>Chạy follow-up đến hạn</Button>
        </>} />

      {/* Trung tâm Đăng nhập & Quản lý Nhiều Tài khoản Zalo Cá nhân */}
      <Card
        title={`Danh sách Tài khoản Zalo Cá nhân đang quản lý (${(data.personalAccounts ?? []).length} nick)`}
        action={<Button size="sm" variant="primary" icon={QrCode} onClick={() => void startQrLogin()}>+ Quét QR thêm Zalo</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data.personalAccounts ?? []).map((acc: any) => (
            <div key={acc.id} className="rounded-2xl border border-line bg-soft/40 p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-sm text-ink">{acc.name}</p>
                  <p className="text-xs text-muted">SĐT Zalo: <b className="text-ink">{acc.phone}</b> · Phụ trách: <b>{acc.assignedUserName}</b></p>
                </div>
                <Badge tone={acc.status === "connected" ? "green" : "amber"}>
                  {acc.status === "connected" ? "Đang trực" : "Chờ QR"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-card px-3 py-1.5 text-xs">
                <span className="font-medium text-ink">Trả lời khách tự động bằng AI:</span>
                <button
                  type="button"
                  onClick={() =>
                    run(
                      `ai:${acc.id}`,
                      () => api.post(`zalo/accounts/${acc.id}/toggle-ai`, { autoReplyEnabled: !acc.autoReplyEnabled }),
                      () => (!acc.autoReplyEnabled ? `Đã BẬT AI trả lời tự động cho ${acc.name}` : `Đã TẮT AI cho ${acc.name} (Chuyển sang tự chat tay)`),
                    )
                  }
                  className={cx(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-bold transition",
                    acc.autoReplyEnabled ? "bg-emerald-600 text-white" : "bg-rose-600 text-white",
                  )}
                >
                  {acc.autoReplyEnabled ? "🤖 AI: BẬT" : "⏸️ AI: TẮT"}
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2 text-xs">
                <span className="text-muted">Hôm nay: <b>{acc.todayMessages}</b> tin</span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={QrCode}
                    onClick={() => void startQrLogin()}
                  >
                    Quét lại QR
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => run(`del:${acc.id}`, () => api.del(`zalo/accounts/${acc.id}`), () => `Đã xoá ${acc.name}`)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Bật / Tắt trả lời AI riêng với từng Khách hàng Zalo cụ thể */}
      <Card
        title={`Bật / Tắt trả lời AI theo từng Khách hàng Zalo cụ thể (${(data.customerAiRules ?? []).length} khách)`}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">Tên Zalo của khách hàng</label>
              <input
                className={inputCls}
                value={newCust.customerName}
                onChange={(e) => setNewCust({ ...newCust, customerName: e.target.value })}
                placeholder="VD: Anh Hùng Đối Tác / Chị Hoa"
              />
            </div>
            <div className="w-44">
              <label className="mb-1 block text-xs font-medium text-muted">SĐT khách (Nếu có)</label>
              <input
                className={inputCls}
                value={newCust.customerPhone}
                onChange={(e) => setNewCust({ ...newCust, customerPhone: e.target.value })}
                placeholder="0909111222"
              />
            </div>
            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-muted">Chế độ AI với khách này</label>
              <select
                className={inputCls}
                value={newCust.aiEnabled ? "on" : "off"}
                onChange={(e) => setNewCust({ ...newCust, aiEnabled: e.target.value === "on" })}
              >
                <option value="off">⏸️ Tắt AI (Tự chat tay)</option>
                <option value="on">🤖 Bật AI trả lời tự động</option>
              </select>
            </div>
            <Button
              variant="primary"
              icon={Plus}
              loading={busy === "add_cust_rule"}
              onClick={() => {
                if (!newCust.customerName.trim()) {
                  toast("Nhập tên khách hàng Zalo", "err");
                  return;
                }
                void run("add_cust_rule", () => api.post("zalo/customer-rules", newCust), () => `Đã lưu cấu hình AI cho khách ${newCust.customerName}`).then((r) => {
                  if (r) setNewCust({ customerName: "", customerPhone: "", aiEnabled: false });
                });
              }}
            >
              Thêm khách
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(data.customerAiRules ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-soft/40 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{r.customerName}</p>
                  <p className="truncate text-[11px] text-muted">{r.customerPhone || "Tất cả SĐT"} · {r.note}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      run(
                        `crule:${r.id}`,
                        () => api.post("zalo/customer-rules", { ...r, aiEnabled: !r.aiEnabled }),
                        () => (!r.aiEnabled ? `Đã BẬT lại AI cho ${r.customerName}` : `Đã TẮT AI với ${r.customerName}`),
                      )
                    }
                    className={cx(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-bold transition",
                      r.aiEnabled ? "bg-emerald-600 text-white" : "bg-rose-600 text-white",
                    )}
                  >
                    {r.aiEnabled ? "AI: BẬT" : "AI: TẮT"}
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => run(`cdel:${r.id}`, () => api.del(`zalo/customer-rules/${r.id}`), () => "Đã xoá")}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {!conn ? (
        <Card>
          <div className="py-10 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-blue-500" />
            <p className="mt-3 text-lg font-semibold text-ink">Chưa kết nối ZL-CRM</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted">Cần địa chỉ ZL-CRM + Public API key (ZL-CRM › Cài đặt › API & Webhook). Có thể chọn "Mô phỏng để test" để thử toàn bộ luồng trước.</p>
            <Link to="/ads/integrations?p=zlcrm" className="mt-4 inline-block"><Button variant="primary">Kết nối ZL-CRM</Button></Link>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0068FF] font-bold text-white">Z</span>
              {conn.config?.web_url && <a href={conn.config.web_url} target="_blank" rel="noreferrer" className="order-last"><Button size="sm" variant="primary">Mở ZL-CRM ↗</Button></a>}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{conn.display_name} {conn.mode === "live" ? <Badge tone="blue">Kết nối thật</Badge> : <Badge tone="amber">Mô phỏng</Badge>} {conn.status !== "active" && <Badge tone="red">{conn.status}</Badge>}</p>
                <p className="text-xs text-muted">{data.accounts.length} nick: {data.accounts.map((a: any) => `${a.name}${a.status !== "connected" ? " (mất kết nối)" : ""}`).join(", ") || "—"} · đồng bộ {data.lastSyncAt ? timeAgo(data.lastSyncAt) : "chưa"}{data.lastSync?.text ? ` — ${data.lastSync.text}` : ""}</p>
                {conn.last_error && <p className="mt-1 text-xs text-rose-600">{conn.last_error}</p>}
                {conn.mode === "live" && data.accounts.length === 0 && <p className="mt-1 rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">ZL-CRM chưa có nick Zalo nào — mở ZL-CRM › Tài khoản Zalo › Thêm tài khoản › quét QR bằng app Zalo trên điện thoại.</p>}
                {conn.mode === "live" && data.hasAccountField === false && data.accounts.length > 1 && <p className="mt-1 rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">ZL-CRM chưa trả về nick của hội thoại → follow-up chỉ gửi được khi có 1 nick. Cần cập nhật ZL-CRM (nhánh feat/public-api-conversation-account).</p>}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat icon={Users} tone="blue" label="Hội thoại Zalo đã phân tích" value={st.conversations} sub={`${st.hot} nóng · ${st.warm} ấm`} />
            <Stat icon={CalendarClock} tone="violet" label="Follow-up đã lên lịch" value={st.scheduled} sub={`${st.waiting} khách đang im lặng`} />
            <Stat icon={CheckCircle2} tone="amber" label="Chờ Sếp duyệt" value={st.awaitingApproval} sub={<Link to="/approvals?type=follow_up" className="text-blue-600">Mở mục duyệt</Link>} />
            <Stat icon={Send} tone="green" label="Đã gửi hôm nay" value={st.sentToday} sub={`Tổng ${st.sentTotal} · ${st.replied} khách trả lời lại`} />
          </div>

          <div className="grid gap-6 wide:grid-cols-[minmax(0,1fr)_400px]">
            <Card title="Hàng đợi follow-up">
              {!plans ? <Loading /> : plans.length === 0 ? <Empty>Chưa có follow-up. Khi nhân viên trả lời khách trên ZL-CRM mà khách im lặng quá {f?.delay1Hours ?? 6} giờ, hệ thống sẽ soạn tin ở đây.</Empty> : (
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead><tr className="border-b border-line text-left text-xs text-muted">{["Khách", "Lead", "Lần", "Lịch / trạng thái", "Nội dung", ""].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-line">
                      {plans.map((p) => (
                        <tr key={p.id} className="align-top">
                          <td className="px-2 py-2.5"><p className="font-medium text-ink">{p.customer_name}</p><p className="text-xs text-muted">{p.ext?.zaloAccountName ?? "—"}</p></td>
                          <td className="px-2 py-2.5">{p.lead_grade ? <Badge tone={LEAD[p.lead_grade]?.tone ?? "gray"}>{LEAD[p.lead_grade]?.label ?? p.lead_grade}</Badge> : "—"}</td>
                          <td className="px-2 py-2.5 tabular-nums">{p.step + (p.status === "done" ? 0 : 1)}</td>
                          <td className="px-2 py-2.5"><Badge tone={PLAN[p.status]?.tone ?? "gray"}>{PLAN[p.status]?.label ?? p.status}</Badge>{p.status === "active" && <p className="mt-1 text-xs text-muted">{ddmm(p.next_at)} {hhmm(p.next_at)}</p>}{p.meta?.reason && <p className="mt-1 max-w-[200px] text-xs text-muted">{p.meta.reason}</p>}</td>
                          <td className="max-w-[300px] px-2 py-2.5 text-xs text-muted"><span className="line-clamp-3">{p.meta?.draft ?? p.meta?.lastText ?? p.last_preview}</span></td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-right">
                            {p.approval_id && <Link to={`/approvals?id=${p.approval_id}`}><Button size="sm" variant="primary">Duyệt</Button></Link>}
                            {(p.status === "active" || p.status === "awaiting_approval") && <Button size="sm" variant="ghost" icon={Square} loading={busy === `s:${p.id}`} onClick={() => run(`s:${p.id}`, () => api.post(`zalo/followups/${p.id}/stop`), () => "Đã dừng follow-up")}>Dừng</Button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Cài đặt follow-up" action={f && <Button size="sm" variant="primary" icon={Save} loading={busy === "save"} onClick={() => run("save", () => api.put("zalo/settings", { ...f, delay1Hours: Number(f.delay1Hours), delay2Hours: Number(f.delay2Hours), maxPerDay: Number(f.maxPerDay), maxSteps: Number(f.maxSteps), quietStart: Number(f.quietStart), quietEnd: Number(f.quietEnd) }), () => "Đã lưu cài đặt")}>Lưu</Button>}>
              {!f ? <Loading /> : (
                <div className="space-y-4">
                  <Row label="Bật follow-up tự động" hint="Tắt = chỉ phân tích lead, không soạn tin"><Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} /></Row>
                  <Row label="Sếp duyệt trước khi gửi" hint="Khuyến nghị bật: mỗi tin vào mục Duyệt"><Toggle checked={f.requireApproval} onChange={(v) => set("requireApproval", v)} /></Row>
                  <Field label="Bot trả lời tin khách?" hint="Mặc định: nhân viên chat trên ZL-CRM, hệ thống chỉ follow-up">
                    <select className={inputCls} value={f.replyMode} onChange={(e) => set("replyMode", e.target.value)}><option value="follow_up_only">Không — chỉ phân tích & follow-up</option><option value="auto_reply">Có — bot trả lời ngay (cẩn thận trùng với nhân viên)</option></select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Lần 1 sau (giờ)"><input type="number" min={0.25} step={0.5} className={inputCls} value={f.delay1Hours} onChange={(e) => set("delay1Hours", e.target.value)} /></Field>
                    <Field label="Lần tiếp sau (giờ)"><input type="number" min={1} className={inputCls} value={f.delay2Hours} onChange={(e) => set("delay2Hours", e.target.value)} /></Field>
                    <Field label="Số lần tối đa"><input type="number" min={1} max={3} className={inputCls} value={f.maxSteps} onChange={(e) => set("maxSteps", e.target.value)} /></Field>
                    <Field label="Tối đa tin/ngày"><input type="number" min={1} max={200} className={inputCls} value={f.maxPerDay} onChange={(e) => set("maxPerDay", e.target.value)} /></Field>
                  </div>
                  <Field label="Chỉ follow-up khách"><select className={inputCls} value={f.minGrade} onChange={(e) => set("minGrade", e.target.value)}><option value="hot">Lead nóng</option><option value="warm">Lead nóng + ấm (khuyến nghị)</option><option value="all">Tất cả khách</option></select></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Không gửi từ (giờ)"><input type="number" min={0} max={23} className={inputCls} value={f.quietStart} onChange={(e) => set("quietStart", e.target.value)} /></Field>
                    <Field label="đến (giờ)"><input type="number" min={0} max={23} className={inputCls} value={f.quietEnd} onChange={(e) => set("quietEnd", e.target.value)} /></Field>
                  </div>
                  <p className="text-xs text-muted">Luôn áp dụng: khách nhắn lại thì hủy follow-up · khách từ chối nhận tin thì không gửi nữa · nút Dừng khẩn cấp chat chặn mọi tin.</p>
                </div>
              )}
            </Card>
          </div>

          <Card title="Hội thoại Zalo gần đây">
            {!convs ? <Loading /> : convs.length === 0 ? <Empty>Chưa có hội thoại. Hệ thống chỉ đọc tin mới sau thời điểm kết nối.</Empty> : (
              <div className="divide-y divide-line">
                {convs.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1"><p className="font-medium text-ink">{c.customer_name} <span className="text-xs font-normal text-muted">· {c.ext?.zaloAccountName ?? "nick ?"} · {timeAgo(c.last_message_at)}</span></p><p className="truncate text-xs text-muted">{c.last_preview}</p></div>
                    {c.lead_grade && <Badge tone={LEAD[c.lead_grade]?.tone ?? "gray"}>{LEAD[c.lead_grade]?.label ?? c.lead_grade}</Badge>}
                    <span className="text-xs text-muted">{STATE[c.state] ?? c.state}</span>
                    {c.followup && <Badge tone={PLAN[c.followup]?.tone ?? "gray"}>{PLAN[c.followup]?.label}</Badge>}
                    {c.state === "awaiting_customer" && c.followup !== "active" && c.followup !== "awaiting_approval" && <Button size="sm" loading={busy === `p:${c.id}`} onClick={() => run(`p:${c.id}`, () => api.post(`zalo/conversations/${c.id}/follow-up`), () => "Đã lên lịch — bấm 'Chạy follow-up đến hạn' để soạn ngay")}>Follow-up ngay</Button>}
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy === `mute:${c.id}`}
                      onClick={() =>
                        run(
                          `mute:${c.id}`,
                          () => api.post("zalo/customer-rules", { customerName: c.customer_name, aiEnabled: false, note: "Tắt AI từ danh sách hội thoại Zalo" }),
                          () => `Đã TẮT AI tự trả lời với khách "${c.customer_name}"`,
                        )
                      }
                    >
                      ⏸️ Tắt AI khách này
                    </Button>
                    <Link to={`/chat?id=${c.id}`}><Button size="sm" variant="ghost">Xem</Button></Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <Modal open={!!sim} onClose={() => setSim(null)} title="Mô phỏng hội thoại Zalo" wide
        footer={<><Button onClick={() => setSim(null)}>Hủy</Button><Button variant="primary" icon={FlaskConical} loading={busy === "sim"} onClick={() => run("sim", () => api.post("zalo/simulate", sim), (r) => `Lead ${r.grade ?? "?"} · ${r.drafted ? "đã soạn follow-up, xem mục Duyệt" : "chưa soạn (xem lý do trong hàng đợi)"}`).then((r) => r && setSim(null))}>Chạy mô phỏng</Button></>}>
        {sim && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Giả lập: khách nhắn → nhân viên trả lời trên ZL-CRM → khách im lặng. Follow-up được soạn ngay (bỏ qua thời gian chờ) để Sếp xem chất lượng.</p>
            <Field label="Tên khách"><input className={inputCls} value={sim.customerName} onChange={(e) => setSim({ ...sim, customerName: e.target.value })} /></Field>
            <Field label="Tin khách gửi"><textarea className={cx(inputCls, "min-h-20")} value={sim.customerText} onChange={(e) => setSim({ ...sim, customerText: e.target.value })} /></Field>
            <Field label="Nhân viên trả lời"><textarea className={cx(inputCls, "min-h-20")} value={sim.staffText} onChange={(e) => setSim({ ...sim, staffText: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Quét Mã QR Đăng nhập Zalo Cá nhân"
        footer={
          <>
            <Button onClick={() => setAddOpen(false)}>Đóng</Button>
            <Button
              variant="primary"
              icon={QrCode}
              loading={generatingQr}
              onClick={() => void startQrLogin()}
            >
              Lấy mã QR mới
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center justify-center py-4 text-center space-y-3">
          <p className="text-sm font-medium text-ink">
            Mở ứng dụng <b>Zalo</b> trên điện thoại → Quét mã QR bên dưới để đăng nhập
          </p>
          <p className="text-xs text-muted max-w-md">
            Hệ thống tự động nhận diện Tên Zalo, Số điện thoại và lưu phiên chạy ngầm ngay sau khi quét.
          </p>
          {zcaQrSession?.qrCodeImage ? (
            <div className="space-y-2">
              <img
                src={zcaQrSession.qrCodeImage}
                alt="Mã QR Đăng nhập Zalo"
                className="mx-auto h-56 w-56 rounded-2xl border border-line bg-white p-2 shadow-sm object-contain"
              />
              <p className="text-xs font-bold text-blue-600">
                {zcaQrSession.status === "scanned"
                  ? `📲 Đã quét (${zcaQrSession.scannedName ?? "Zalo"}) — Hãy bấm "Đăng nhập" trên điện thoại!`
                  : zcaQrSession.status === "connected"
                  ? "✅ Đã đăng nhập thành công!"
                  : "Đang chờ quét mã QR..."}
              </p>
            </div>
          ) : (
            <div className="flex h-56 w-56 flex-col items-center justify-center rounded-2xl border border-line bg-soft p-4 text-xs text-muted">
              <QrCode className="mb-2 h-10 w-10 animate-pulse text-blue-600" />
              <span>{generatingQr ? "Đang tải mã QR từ Zalo..." : "Đang chuẩn bị mã QR..."}</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span><span className="block text-sm font-medium text-ink">{label}</span>{hint && <span className="text-xs text-muted">{hint}</span>}</span>{children}</div>;
}
