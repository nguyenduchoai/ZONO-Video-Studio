import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Clapperboard, Eye, FileText, MessageSquareText, MessagesSquare, Sparkles, Store, Target } from "lucide-react";
import { api, useApi } from "../lib/api";
import { CONV_STATE, LEAD, num, timeAgo, vnd } from "../lib/format";
import { Avatar, Badge, Button, Card, Empty, Loading, PlatformIcon, Stat, useToast } from "../components/ui";

export function Overview() {
  const { data: d, reload } = useApi<any>("overview", ["task.", "approval.", "conversation.", "lead.", "metrics.", "post.", "action."]);
  const { data: sys } = useApi<any>("system");
  const toast = useToast();
  if (!d) return <Loading />;

  const quickDecide = async (id: string, decision: "approve" | "reject") => {
    try {
      await api.post(`approvals/${id}/decide`, {
        decision,
        note: decision === "reject" ? "Từ chối nhanh từ trang tổng quan" : undefined,
      });
      toast(decision === "approve" ? "Đã duyệt" : "Đã từ chối");
      reload();
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Lời chào đơn giản, thoáng đãng */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-card p-6 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            Bảng quản lý cửa hàng · {sys?.biz?.name ?? "ZONO"} 👋
          </h1>
          <p className="mt-1 text-sm text-muted">
            Xem nhanh tình hình bán hàng, tin nhắn khách Zalo và các bài đăng trong tuần.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/dna">
            <Button variant="secondary" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">
              <Target className="mr-1.5 h-4 w-4" /> 🧬 Mục tiêu & DNA Thương hiệu
            </Button>
          </Link>
          <Link to="/studio">
            <Button variant="primary" className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
              <Sparkles className="mr-1.5 h-4 w-4" /> 🎬 Mở Studio Phim AI (MoonReel × FrameWeaver)
            </Button>
          </Link>
          <Link to="/users-quota">
            <Button variant="secondary">
              <Store className="mr-1.5 h-4 w-4" /> Sửa Bảng giá & Cửa hàng
            </Button>
          </Link>
        </div>
      </div>

      {/* Banner Studio Phim AI mới */}
      <Link
        to="/studio"
        className="group flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-violet-500/30 bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-blue-600/10 p-5 shadow-xs transition hover:border-violet-500 hover:shadow-md"
      >
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold text-ink group-hover:text-violet-600">
                ✨ Studio Phim AI · MoonReel × FrameWeaver × 26Flow × Muse2API
              </h2>
              <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                MỚI TÍCH HỢP
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Giải mã Video Mẫu (Decode nhịp cắt, góc quay, Hook 3s đầu bằng Local FFmpeg + Whisper) · Học theo Video Decode để dựng phim mới từ Video Quay Sẵn bằng Claude AI · 6 Ngách & 10 Phong cách.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-xs group-hover:bg-violet-700">
          Vào Studio ngay <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      {/* 3 Con số quan trọng nhất */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          icon={BarChart3}
          tone="blue"
          label="Doanh thu (7 ngày qua)"
          value={vnd(d.kpis.revenue.value)}
          delta={d.kpis.revenue.delta}
        />
        <Stat
          icon={MessageSquareText}
          tone="green"
          label="Khách hàng nhắn mới"
          value={num(d.kpis.newCustomers.value)}
          delta={d.kpis.newCustomers.delta}
        />
        <Stat
          icon={Eye}
          tone="violet"
          label="Lượt khách xem bài"
          value={num(d.kpis.reach.value)}
          delta={d.kpis.reach.delta}
        />
      </div>

      {/* 4 Ô Quản lý Chính — To, Rõ Ràng, Bấm Là Mở */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/users-quota"
          className="group flex flex-col justify-between rounded-3xl border border-line bg-card p-5 shadow-xs hover:border-violet-500 hover:shadow-md transition"
        >
          <div className="space-y-2">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-600">
              <Store className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-ink group-hover:text-violet-600">
              1. Cửa hàng & Bảng giá
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Cập nhật tên cửa hàng, mặt hàng, bảng giá và nạp tài liệu cho AI học.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-violet-600">
            Mở quản lý <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        <Link
          to="/zalo"
          className="group flex flex-col justify-between rounded-3xl border border-line bg-card p-5 shadow-xs hover:border-blue-500 hover:shadow-md transition"
        >
          <div className="space-y-2">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-600">
              <MessagesSquare className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-ink group-hover:text-blue-600">
              2. Zalo & Khách hàng
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Quét mã QR nối Zalo, bật/tắt AI trả lời tự động và xem lịch sử báo giá.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-blue-600">
            Mở Zalo <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        <Link
          to="/content"
          className="group flex flex-col justify-between rounded-3xl border border-line bg-card p-5 shadow-xs hover:border-emerald-500 hover:shadow-md transition"
        >
          <div className="space-y-2">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-ink group-hover:text-emerald-600">
              3. Bài viết bán hàng
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Xem lại toàn bộ bài viết AI đã soạn, chỉnh sửa và đăng lên Facebook / Zalo.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
            Xem bài viết <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        <Link
          to="/video-flow"
          className="group flex flex-col justify-between rounded-3xl border border-line bg-card p-5 shadow-xs hover:border-amber-500 hover:shadow-md transition"
        >
          <div className="space-y-2">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
              <Clapperboard className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-ink group-hover:text-amber-600">
              4. Xưởng làm Video
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Tạo và tải về các video bán hàng ngắn có giọng đọc tiếng Việt tự động.
            </p>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-600">
            Mở xưởng Video <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </div>

      {/* 2 Danh sách gọn gàng: Tin nhắn khách hàng & Bài chờ duyệt */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="💬 Tin nhắn khách hàng gần đây"
          action={
            <Link to="/zalo" className="text-xs font-bold text-blue-600">
              Xem tất cả →
            </Link>
          }
        >
          {d.inbox.length === 0 ? (
            <Empty>Chưa có tin nhắn khách hàng mới.</Empty>
          ) : (
            <div className="space-y-3">
              {d.inbox.slice(0, 5).map((c: any) => (
                <Link
                  key={c.id}
                  to={`/chat?id=${c.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-soft/40 p-3 hover:bg-soft transition"
                >
                  <div className="relative shrink-0">
                    <Avatar name={c.customer_name} />
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <PlatformIcon p={c.channel === "pancake" ? "pancake" : c.channel} size={16} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <p className="truncate text-sm font-bold text-ink">{c.customer_name}</p>
                      <span className="text-xs text-muted">{timeAgo(c.last_message_at)}</span>
                    </div>
                    <p className="truncate text-xs text-muted mt-0.5">{c.last_preview}</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <Badge tone={CONV_STATE[c.state]?.tone}>{CONV_STATE[c.state]?.label}</Badge>
                      {c.lead_grade && <Badge tone={LEAD[c.lead_grade]?.tone}>{LEAD[c.lead_grade]?.label}</Badge>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              ✅ Nội dung chờ mình duyệt{" "}
              <Badge tone="blue">{sys?.counts?.approvals ?? d.approvals.length}</Badge>
            </span>
          }
          action={
            <Link to="/approvals" className="text-xs font-bold text-blue-600">
              Xem tất cả →
            </Link>
          }
        >
          {d.approvals.length === 0 ? (
            <Empty>Tất cả bài viết đã được duyệt xong 🎉</Empty>
          ) : (
            <div className="space-y-3">
              {d.approvals.slice(0, 4).map((a: any) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-soft/40 p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/approvals?id=${a.id}`}
                      className="block truncate text-sm font-bold text-ink hover:text-blue-600"
                    >
                      {a.title}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="success" onClick={() => quickDecide(a.id, "approve")}>
                      Duyệt ngay
                    </Button>
                    <Link to={`/approvals?id=${a.id}`}>
                      <Button size="sm" variant="secondary">
                        Xem
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
