import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useApi } from "../lib/api";
import { AGENT_LABEL, ddmm, hhmm } from "../lib/format";
import { Card, Empty, Loading, PageHeader, cx, inputCls } from "../components/ui";

/** Audit log viewer: every change made by the CEO, agents, rules, automations and MCP keys. */
const GROUPS: [string, string, (e: string) => boolean][] = [
  ["all", "Tất cả", () => true],
  ["ads", "Quảng cáo", (e) => /^(action|ad|ads|rule|automation)\./.test(e)],
  ["connect", "Kết nối", (e) => /^(connection|whitelist|mcp_key)\./.test(e)],
  ["approval", "Duyệt", (e) => e.startsWith("approval.")],
  ["agent", "Agent & nội dung", (e) => /^(task|goal|content|publish|creative|post)\./.test(e)],
  ["system", "Hệ thống", (e) => /^(settings|kill_switch|schedule|llm|agent_config)\./.test(e)],
];
const EVENT: Record<string, string> = {
  "connection.created": "Thêm kết nối", "connection.updated": "Cập nhật kết nối", "connection.revoked": "Ngắt kết nối", "connection.tested": "Kiểm tra kết nối",
  "whitelist.added": "Thêm vào whitelist", "whitelist.removed": "Bỏ khỏi whitelist", "ads.imported": "Đồng bộ chiến dịch", "ad.quick_publish": "Đăng quảng cáo nhanh",
  "automation.created": "Tạo cấu hình", "automation.updated": "Sửa cấu hình", "automation.deleted": "Xóa cấu hình", "automation.enabled": "Bật cấu hình", "automation.paused": "Tắt cấu hình",
  "rule.run": "Chạy rule", "rule.mode_changed": "Đổi chế độ rule", "action.executed": "Thực hiện hành động", "action.reverted": "Hoàn tác",
  "mcp_key.created": "Tạo MCP key", "mcp_key.revoked": "Thu hồi MCP key", "kill_switch.on": "BẬT dừng khẩn cấp", "kill_switch.off": "Tắt dừng khẩn cấp",
  "approval.approved": "Duyệt", "approval.rejected": "Từ chối", "approval.edited": "Sửa & duyệt", "settings.changed": "Đổi cài đặt",
};

export function Logs() {
  const { data } = useApi<any[]>("audit-log?limit=500", ["action.", "approval.", "alert.", "automation."]);
  const [g, setG] = useState("all");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const f = GROUPS.find((x) => x[0] === g)![2];
    const s = search.toLowerCase();
    return (data ?? []).filter((a) => f(a.event) && (!s || JSON.stringify(a).toLowerCase().includes(s)));
  }, [data, g, search]);
  return (
    <div className="space-y-6">
      <PageHeader title="Lịch sử hoạt động" subtitle="Mọi thay đổi của Sếp, Agent, rule, cấu hình tự động và MCP key — không thể sửa, dùng để truy vết." />
      <Card bodyClass="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <div className="relative min-w-[220px] flex-1 md:max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" /><input className={cx(inputCls, "pl-9")} placeholder="Tìm trong nhật ký..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {GROUPS.map(([k, l]) => <button key={k} onClick={() => setG(k)} className={cx("rounded-xl border px-3 py-2 text-sm", g === k ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300" : "border-line text-ink")}>{l}</button>)}
        </div>
        {!data ? <div className="p-5"><Loading /></div> : rows.length === 0 ? <div className="p-5"><Empty>Không có sự kiện.</Empty></div> : (
          <div className="max-h-[70vh] overflow-auto scroll-thin">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-card"><tr className="border-b border-line text-left text-xs text-muted">{["Thời gian", "Tác nhân", "Sự kiện", "Chi tiết"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => (
                  <tr key={a.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-muted">{ddmm(a.at)} {hhmm(a.at)}</td>
                    <td className="px-4 py-2 text-ink">{AGENT_LABEL[a.actor] ?? a.actor}</td>
                    <td className="px-4 py-2"><span className="text-ink">{EVENT[a.event] ?? a.event}</span><code className="ml-2 rounded bg-soft px-1 text-[11px] text-muted">{a.event}</code></td>
                    <td className="max-w-[420px] px-4 py-2 text-xs text-muted"><span className="line-clamp-2 break-all">{a.data && Object.keys(a.data).length ? JSON.stringify(a.data) : a.ref_type ? `${a.ref_type} · ${String(a.ref_id ?? "").slice(-8)}` : "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
