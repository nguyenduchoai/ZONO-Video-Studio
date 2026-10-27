import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, Sparkles, Database, Cpu, FileText, Clapperboard, MessageCircle,
  Plus, Trash2, Edit3, PhoneCall, ShoppingBag, ArrowRight, RefreshCw,
} from "lucide-react";
import { api, useApi } from "../lib/api";
import { Badge, Button, Card, Modal, PageHeader, cx, useToast } from "../components/ui";

type PlanTierKey = "starter" | "growth" | "pro" | "enterprise";

interface UserQuotaMeta {
  planId: PlanTierKey;
  tokenLimit: number;
  videoLimit: number;
  postLimit: number;
  zaloMsgLimit: number;
  tokensUsed: number;
  videosUsed: number;
  postsUsed: number;
  zaloMsgsUsed: number;
  preferredProvider: "auto" | "claude_cli" | "codex_cli" | "gemini_cli" | "local_studio";
  ragEnabled: boolean;
  zaloPersonalPhone: string;
  zaloAutoFollowUp: boolean;
  pancakeSyncEnabled: boolean;
  brandName: string;
  industry: string;
  productsSummary: string;
  ragKnowledgeText: string;
}

interface EnrichedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastActiveAt: string;
  plan: {
    id: PlanTierKey;
    name: string;
    priceVnd: number;
    tokenLimit: number;
    videoLimit: number;
    postLimit: number;
    zaloMsgLimit: number;
    description: string;
  };
  quota: UserQuotaMeta;
  tokenPct: number;
  videoPct: number;
  postPct: number;
}

interface EditUserForm {
  id?: string;
  name: string;
  email: string;
  role: string;
  status: string;
  planId: PlanTierKey;
  tokenLimit: number;
  videoLimit: number;
  postLimit: number;
  zaloMsgLimit: number;
  preferredProvider: "auto" | "claude_cli" | "codex_cli" | "gemini_cli" | "local_studio";
  ragEnabled: boolean;
  zaloPersonalPhone: string;
  zaloAutoFollowUp: boolean;
  pancakeSyncEnabled: boolean;
  brandName: string;
  industry: string;
  productsSummary: string;
  ragKnowledgeText: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  auto: "Tự động phân luồng (Claude / Gemini / OpenAI / Veo 3 Local)",
  gemini_cli: "Gemini 2.5 Pro (SEO & Bài viết)",
  claude_cli: "Claude Sonnet 4.5 (Tư vấn & Chốt đơn Zalo)",
  codex_cli: "OpenAI GPT-5 / DALL-E (Ảnh & Sáng tạo)",
  local_studio: "Veo 3 + Remotion + VieNeu-TTS (Video Local)",
};

const inputCls = "w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-blue-500";

export function UsersQuota() {
  const { data, reload, loading } = useApi<any>("users-quota", ["user.", "llm.", "content.", "creative."]);
  const toast = useToast();

  const [editing, setEditing] = useState<EditUserForm | null>(null);
  const [saving, setSaving] = useState(false);

  // Per-user live test state
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [testMode, setTestMode] = useState<"post" | "video" | "zalo_sale">("post");
  const [testTopic, setTestTopic] = useState<string>("Giải pháp AI tự động đăng bài, làm video và chăm khách Zalo cá nhân 24/7");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const users: EnrichedUser[] = data?.users ?? [];
  const plans: any[] = data?.plans ?? [];
  const pool = data?.centralPool;

  const openNewUser = () => {
    setEditing({
      name: "",
      email: "",
      role: "subscriber",
      status: "active",
      planId: "growth",
      tokenLimit: 2_000_000,
      videoLimit: 30,
      postLimit: 120,
      zaloMsgLimit: 1500,
      preferredProvider: "auto",
      ragEnabled: true,
      zaloPersonalPhone: "0909888777",
      zaloAutoFollowUp: true,
      pancakeSyncEnabled: true,
      brandName: "",
      industry: "Thương mại điện tử & Dịch vụ",
      productsSummary: "Gói Cơ bản (499.000đ), Gói Chuyên nghiệp (1.290.000đ)",
      ragKnowledgeText: "Cam kết hoàn tiền 100% trong 7 ngày nếu không hài lòng. Miễn phí giao hàng toàn quốc và hỗ trợ kỹ thuật 1-1 qua Zalo cá nhân.",
    });
  };

  const openEditUser = (u: EnrichedUser) => {
    setEditing({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      planId: u.quota.planId,
      tokenLimit: u.quota.tokenLimit,
      videoLimit: u.quota.videoLimit,
      postLimit: u.quota.postLimit,
      zaloMsgLimit: u.quota.zaloMsgLimit,
      preferredProvider: u.quota.preferredProvider,
      ragEnabled: u.quota.ragEnabled,
      zaloPersonalPhone: u.quota.zaloPersonalPhone,
      zaloAutoFollowUp: u.quota.zaloAutoFollowUp,
      pancakeSyncEnabled: u.quota.pancakeSyncEnabled,
      brandName: u.quota.brandName,
      industry: u.quota.industry,
      productsSummary: u.quota.productsSummary,
      ragKnowledgeText: u.quota.ragKnowledgeText,
    });
  };

  const handleSaveUser = async () => {
    if (!editing?.name || !editing?.email) {
      toast("Vui lòng nhập Tên và Email của User", "err");
      return;
    }
    setSaving(true);
    try {
      await api.post("users-quota/users", editing);
      toast(editing.id ? "Đã cập nhật User, Kho RAG & Hạn mức Token" : "Đã tạo User mới & nạp DNA vào RAG", "ok");
      setEditing(null);
      reload();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi lưu User", "err");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (u: EnrichedUser) => {
    if (!confirm(`Xoá User "${u.name}" (${u.email})?`)) return;
    try {
      await api.del(`users-quota/users/${u.id}`);
      toast(`Đã xoá ${u.name}`, "ok");
      reload();
    } catch (e: any) {
      toast(e?.message ?? "Không thể xoá", "err");
    }
  };

  const handleRunUserRag = async (u: EnrichedUser, modeOverride?: "post" | "video" | "zalo_sale") => {
    const mode = modeOverride ?? testMode;
    setActiveUserId(u.id);
    setTestMode(mode);
    setRunningId(`${u.id}:${mode}`);
    try {
      const res = await api.post(`users-quota/users/${u.id}/run`, {
        mode,
        prompt: testTopic,
      });
      setLastResult(res);
      toast(
        mode === "post"
          ? `Đã tạo bài viết từ DNA+RAG cho ${u.name} (-${res.tokensDeducted} tokens)`
          : mode === "video"
          ? `Đã khởi tạo Video AI từ DNA+RAG cho ${u.name} (-${res.tokensDeducted} tokens)`
          : `Đã sinh phản hồi chốt đơn Zalo cá nhân cho ${u.name} (-${res.tokensDeducted} tokens)`,
        "ok",
      );
      reload();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi chạy tác vụ AI theo User", "err");
    } finally {
      setRunningId(null);
    }
  };

  const providersList = Object.entries(pool?.providersStatus ?? {}).map(([id, info]: [string, any]) => ({
    id,
    ready: Boolean(info?.ready),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        title="🏪 Cửa hàng, Bảng giá & Tài khoản"
        subtitle="Quản lý thông tin cửa hàng, mặt hàng, bảng giá và chính sách bán hàng để Trợ lý AI tự động viết bài và báo giá Zalo chính xác."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => reload()} disabled={loading}>
              <RefreshCw className={cx("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Làm mới
            </Button>
            <Button onClick={openNewUser}>
              <Plus className="mr-1.5 h-4 w-4" /> Thêm Cửa hàng / Nhân sự
            </Button>
          </div>
        }
      />

      {/* Danh sách Cửa hàng / Tài khoản — Gọn gàng, Dễ nhìn */}
      <div className="grid gap-5 lg:grid-cols-2">
        {users.map((u) => {
          const q = u.quota;
          return (
            <Card
              key={u.id}
              className="flex flex-col justify-between space-y-4 rounded-3xl p-5"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-extrabold text-ink">
                        🏪 {q.brandName || u.name}
                      </h3>
                      <Badge tone={u.status === "active" ? "green" : "gray"}>
                        {u.status === "active" ? "Đang hoạt động" : "Tạm khoá"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      Phụ trách: <b className="text-ink">{u.name}</b> ({u.email}) · Ngành: {q.industry || "Bán lẻ"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="primary" onClick={() => openEditUser(u)}>
                      <Edit3 className="mr-1 h-3.5 w-3.5" /> Sửa Bảng giá
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(u)}>
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                </div>

                {/* Bảng giá & Chính sách đang áp dụng */}
                <div className="space-y-2 text-xs">
                  <div className="rounded-2xl border border-line bg-soft/50 p-3 text-ink">
                    <div className="font-bold text-violet-700 dark:text-violet-300 mb-1">
                      📦 Mặt hàng & Bảng giá:
                    </div>
                    <p className="leading-relaxed">
                      {q.productsSummary || "Chưa có bảng giá — bấm nút 'Sửa Bảng giá' để nhập."}
                    </p>
                  </div>

                  {q.ragKnowledgeText && (
                    <div className="rounded-2xl border border-line bg-soft/30 p-3 text-muted">
                      <div className="font-bold text-ink mb-1">
                        💬 Chính sách bảo hành & Ưu đãi khi tư vấn khách:
                      </div>
                      <p className="line-clamp-3 leading-relaxed">{q.ragKnowledgeText}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Thống kê gọn gàng ở chân thẻ */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
                <div className="flex flex-wrap items-center gap-3">
                  <span>📝 Đã viết: <b className="text-ink">{q.postsUsed} bài</b></span>
                  <span>🎬 Video: <b className="text-ink">{q.videosUsed} clip</b></span>
                  <span>📱 Zalo: <b className="text-ink">{q.zaloPersonalPhone || "Chưa gắn SĐT"}</b></span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={runningId !== null}
                  onClick={() => handleRunUserRag(u, "post")}
                >
                  <FileText className="mr-1 h-3.5 w-3.5 text-blue-600" />
                  {runningId === `${u.id}:post` ? "Đang viết..." : "Thử viết 1 bài"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal Thêm / Sửa Cửa hàng & Bảng giá — Ngôn ngữ bình dân, dễ hiểu */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? `✏️ Sửa Bảng giá & Cửa hàng: ${editing.brandName || editing.name}` : "➕ Thêm Cửa hàng & Bảng giá mới"}
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-ink">1. Tên Cửa hàng / Thương hiệu</label>
                <input
                  className={inputCls}
                  value={editing.brandName}
                  onChange={(e) => setEditing({ ...editing, brandName: e.target.value })}
                  placeholder="VD: Tạp hoá Cô Ba / Mỹ phẩm ZONO"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-ink">2. Ngành hàng kinh doanh</label>
                <input
                  className={inputCls}
                  value={editing.industry}
                  onChange={(e) => setEditing({ ...editing, industry: e.target.value })}
                  placeholder="VD: Mỹ phẩm, Thời trang, Đồ ăn, Bất động sản..."
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Tên người phụ trách</label>
                <input
                  className={inputCls}
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="VD: Chị Lan"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Email liên hệ</label>
                <input
                  className={inputCls}
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  placeholder="lan@cuahang.vn"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">SĐT Zalo bán hàng</label>
                <input
                  className={inputCls}
                  value={editing.zaloPersonalPhone}
                  onChange={(e) => setEditing({ ...editing, zaloPersonalPhone: e.target.value })}
                  placeholder="0988123456"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-ink">
                3. Danh sách Mặt hàng & Giá bán (Để AI báo giá cho khách)
              </label>
              <textarea
                rows={3}
                className={inputCls}
                value={editing.productsSummary}
                onChange={(e) => setEditing({ ...editing, productsSummary: e.target.value })}
                placeholder="VD: Kem chống nắng 250.000đ, Sữa rửa mặt 180.000đ, Mua 2 tặng 1..."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-ink">
                4. Chính sách giao hàng, bảo hành & Ưu đãi của cửa hàng
              </label>
              <textarea
                rows={4}
                className={inputCls}
                value={editing.ragKnowledgeText}
                onChange={(e) => setEditing({ ...editing, ragKnowledgeText: e.target.value })}
                placeholder="VD: Miễn phí giao hàng đơn từ 300k. Đổi trả trong 7 ngày..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Đóng</Button>
              <Button variant="primary" onClick={handleSaveUser} disabled={saving}>
                {saving ? "Đang lưu..." : "💾 Lưu thông tin Cửa hàng"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
