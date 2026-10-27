import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { api, useApi } from "../lib/api";
import { TASK_STATUS, timeAgo } from "../lib/format";
import { Badge, Button, Card, Empty, Loading, useToast } from "./ui";

const DECISION = { scale: ["Tăng ngân sách", "green"], keep: ["Giữ nguyên", "gray"], fix: ["Sửa / giảm", "amber"], pause: ["Tắt", "red"] } as const;

/** Weekly analysis written by the Ads Agent (mkt-ads persona + facebook-ads-expert + toiuuquangcao). */
export function AdsReportCard() {
  const { data, reload } = useApi<any>("ads/report/latest", ["task.", "approval."]);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const run = async () => {
    setBusy(true);
    try { await api.post("ads/report"); toast("Ads Agent đang phân tích số liệu 7 ngày…", "info"); reload(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const o = data?.output;
  const st = data ? TASK_STATUS[data.status] : null;
  return (
    <Card title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" />Báo cáo Ads tuần · nhân viên Quảng cáo (skill mkt-ads)</span>}
      action={<Button size="sm" variant="primary" loading={busy || data?.status === "running"} onClick={run}>{data ? "Chạy lại phân tích" : "Chạy phân tích"}</Button>}>
      {data === undefined ? <Loading /> : !data ? <Empty>Chưa có báo cáo. Bấm "Chạy phân tích" để Ads Agent đọc số liệu 7 ngày và đề xuất.</Empty> : !o ? (
        <p className="text-sm text-muted">{st?.label ?? data.status}{data.step ? ` · ${data.step}` : ""} · {timeAgo(data.updated_at)}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm">{o.summary}</p>
          {o.alerts?.length > 0 && <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{o.alerts.map((a: string) => <p key={a}>⚠️ {a}</p>)}</div>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-2">Mẫu ads</th><th>Quyết định</th><th>Lý do</th></tr></thead>
              <tbody className="divide-y divide-line">
                {o.decisions.map((d: any) => (
                  <tr key={d.adName}><td className="py-2 font-medium">{d.adName}</td><td><Badge tone={DECISION[d.decision as keyof typeof DECISION][1] as any}>{DECISION[d.decision as keyof typeof DECISION][0]}{d.budgetChangePct ? ` ${d.budgetChangePct > 0 ? "+" : ""}${d.budgetChangePct}%` : ""}</Badge></td><td className="text-xs text-muted">{d.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {o.nextTests?.length > 0 && <div className="text-sm"><p className="font-medium">Thử nghiệm tiếp theo</p><ul className="list-disc pl-5 text-muted">{o.nextTests.map((t: string) => <li key={t}>{t}</li>)}</ul></div>}
          <p className="text-xs text-muted">Quyết định Tắt / Tăng / Giảm đã thành mục chờ duyệt (qua trần ngân sách). <Link to="/approvals" className="text-blue-600">Mở hộp duyệt →</Link> · cập nhật {timeAgo(data.updated_at)}</p>
        </div>
      )}
    </Card>
  );
}
