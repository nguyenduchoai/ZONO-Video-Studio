import { Link } from "react-router-dom";
import { CalendarDays, ChartNoAxesColumn, CirclePause, Database, KeyRound, Puzzle, Rocket, ShieldCheck } from "lucide-react";
import { Card, PageHeader } from "../components/ui";

const STEPS: [any, string, string, string][] = [
  [Puzzle, "Liên kết nền tảng", "Trung tâm tích hợp → Liên kết nền tảng → Facebook (token System User) hoặc chọn “Mô phỏng để test”. Sau đó bấm “Đồng bộ chiến dịch”.", "/ads/integrations"],
  [ShieldCheck, "Kiểm tra whitelist", "Chỉ tài khoản quảng cáo và Fanpage bật whitelist mới được luồng tự động tác động.", "/ads/integrations?p=whitelist"],
  [Database, "Đồng bộ dữ liệu", "Liên kết Google Sheets, tạo luồng Đồng bộ dữ liệu để số liệu tự đổ về Sheet theo lịch.", "/ads/flows?type=metrics_pull"],
  [CirclePause, "Dừng theo điều kiện", "Tạo luồng, ví dụ: chi tiêu hôm nay > 300.000đ và 0 kết quả → tạm dừng. Luồng luôn chạy thử trước.", "/ads/flows?type=auto_off"],
  [ChartNoAxesColumn, "Điều chỉnh chi tiêu", "Tăng 20% ngân sách khi CPA 3 ngày thấp hơn mục tiêu, có trần/ad và thời gian chờ 24 giờ.", "/ads/flows?type=budget"],
  [CalendarDays, "Khởi chạy theo lịch", "Bật quảng cáo 7:00 – tắt 23:00, hoặc tự đề xuất quảng cáo từ bài viết đạt điểm cao.", "/ads/flows?type=auto_run"],
  [Rocket, "Tạo chiến dịch nhanh", "Chọn bài trên Fanpage + mẫu trong Thư viện nội dung → tạo chiến dịch, nhóm, quảng cáo trong 1 phút.", "/ads/quick"],
  [KeyRound, "Cổng AI", "Cấp khóa cho Claude Desktop/Cursor để hỏi đáp và thao tác quảng cáo bằng tiếng Việt.", "/ads/ai-gateway"],
];
const FAQ: [string, string][] = [
  ["Luồng có tự tiêu tiền thật không?", "Không, cho tới khi Sếp bấm “Bật LIVE”. Trước đó luồng chỉ ghi “sẽ làm gì”. Kể cả khi LIVE vẫn luôn có trần tổng ngân sách/ngày, bước thay đổi tối đa, thời gian chờ, whitelist và nút Dừng khẩn cấp."],
  ["Token Facebook có an toàn không?", "Token được mã hoá khi lưu, không bao giờ hiển thị lại, và có thể ngắt kết nối bất cứ lúc nào trong Trung tâm tích hợp."],
  ["Muốn hoàn tác một thay đổi?", "Vào Thống kê → Nhật ký hành động → Hoàn tác. Mọi thay đổi đều được ghi ở Lịch sử hoạt động."],
  ["“Kết quả” được tính thế nào?", "Theo lựa chọn khi liên kết Facebook: tin nhắn bắt đầu, lead form, mua hàng hoặc lượt click liên kết."],
];

export function AdsHelp() {
  return (
    <div className="space-y-6">
      <PageHeader title="Trợ giúp" subtitle="8 bước để AI Agent Ads chạy thật cho ZONO — làm lần lượt từ trên xuống." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map(([Icon, t, d, to], i) => (
          <Link key={t} to={to} className="rounded-2xl border border-line bg-card p-5 shadow-sm transition hover:border-blue-400">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600"><Icon className="h-5 w-5" /></span><span className="text-xs font-semibold text-muted">BƯỚC {i + 1}</span></div>
            <p className="mt-3 font-semibold text-ink">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </Link>
        ))}
      </div>
      <Card title="Câu hỏi thường gặp">
        <div className="divide-y divide-line">
          {FAQ.map(([q, a]) => <div key={q} className="py-3"><p className="font-medium text-ink">{q}</p><p className="mt-1 text-sm text-muted">{a}</p></div>)}
        </div>
      </Card>
    </div>
  );
}
