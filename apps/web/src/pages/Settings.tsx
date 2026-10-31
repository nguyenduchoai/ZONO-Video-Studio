import { LlmPanel } from "../components/LlmPanel";
import { AccountForm } from "../components/Account";
import { Badge, Card, Loading, PageHeader } from "../components/ui";
import { useApi } from "../lib/api";

export function Settings() {
  const { data: sys } = useApi<any>("system");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cấu Hình CLI AI & Tài Khoản Studio"
        subtitle="Quản lý kết nối Claude CLI, Gemini CLI, Codex CLI chạy ngầm trên máy cho Studio Phim AI & Xưởng Làm Video."
      />

      <Card title="Trạng thái Kết nối CLI AI hiện tại">
        {!sys ? (
          <Loading />
        ) : (
          <div className="space-y-2 rounded-xl border border-line p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-ink">CLI Agent (Claude CLI · Gemini CLI · ChatGPT Codex CLI)</p>
              {!sys.llm.enabled ? (
                <Badge tone="amber">Sandbox</Badge>
              ) : sys.llm.loggedIn === false ? (
                <Badge tone="red">HẾT PHIÊN</Badge>
              ) : sys.llm.loggedIn === null ? (
                <Badge tone="amber">Chưa rõ</Badge>
              ) : (
                <Badge tone="green">ĐANG KẾT NỐI (LIVE)</Badge>
              )}
            </div>
            <p className="text-sm text-muted">
              {sys.llm.provider === "sandbox"
                ? "Đang ở chế độ Sandbox — vui lòng chọn hoặc đăng nhập tài khoản CLI bên dưới."
                : sys.llm.loggedIn === false
                  ? "Tài khoản CLI đã hết phiên đăng nhập — vui lòng bấm Đăng nhập lại ở bảng bên dưới."
                  : sys.llm.provider === "codex_cli"
                    ? "Đang dùng OpenAI Codex CLI chạy ngầm trên máy."
                    : sys.llm.provider === "gemini_cli"
                      ? "Đang dùng Google Gemini CLI chạy ngầm trên máy."
                      : "Đang dùng Anthropic Claude CLI chạy ngầm trên máy."}
            </p>
            {sys.llm.authError && <p className="text-xs text-rose-600">{sys.llm.authError}</p>}
          </div>
        )}
      </Card>

      <Card title="Kết nối AI — Tài khoản CLI (Claude / Gemini / ChatGPT Codex) & Chọn Model">
        <LlmPanel />
      </Card>

      <Card title="Thông tin Tài khoản Studio">
        <AccountForm />
      </Card>
    </div>
  );
}
