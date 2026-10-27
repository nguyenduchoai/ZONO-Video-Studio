import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Plus, Clapperboard, FileText, PhoneCall,
  SlidersHorizontal, QrCode, Trash2, ExternalLink, Volume2, Bot, UserX, UserCheck,
  Store, CheckCircle2, Copy, RefreshCw, Sparkles, Paperclip, Mic, MicOff, UploadCloud,
  Puzzle, FolderOpen, Terminal, X, Search, Zap,
} from "lucide-react";
import { api, useApi } from "../lib/api";
import { Badge, Button, Modal, cx, useToast } from "./ui";

function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="brain-md text-[15px] leading-relaxed text-ink space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-3 mb-1.5 text-lg font-extrabold text-ink border-b border-line pb-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3 mb-1 text-base font-bold text-ink">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-2.5 mb-1 text-[15px] font-bold text-blue-700 dark:text-blue-300">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-2 mb-0.5 text-[15px] font-semibold text-ink">{children}</h4>
          ),
          p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
          em: ({ children }) => <em className="italic text-ink/90">{children}</em>,
          hr: () => <hr className="my-3 border-t border-line" />,
          blockquote: ({ children }) => (
            <blockquote className="my-2 rounded-r-xl border-l-4 border-violet-500 bg-soft/60 px-3.5 py-2 text-sm text-ink/90">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className?.includes("language-"));
            if (isBlock) {
              return (
                <pre className="my-2 overflow-x-auto rounded-xl border border-line bg-soft p-3 font-mono text-xs text-ink">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="rounded-md border border-line bg-soft px-1.5 py-0.5 font-mono text-[13px] font-semibold text-violet-700 dark:text-violet-300">
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-blue-600 underline hover:text-blue-700"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-xl border border-line">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-line bg-soft px-3 py-2 font-bold text-ink">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-line px-3 py-2 text-ink">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  mode?: "post" | "image" | "video" | "zalo_sale" | "general" | "rag_learn" | "zalo_qr";
  provider?: string;
  agentKey?: string;
  agentLabel?: string;
  agentEmoji?: string;
  skillKey?: string;
  skillName?: string;
  durationMs?: number;
  fallbackUsed?: boolean;
  tokensUsed?: number;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  zaloAccountName?: string;
  ragSources?: string[];
  refId?: string;
  aiPaused?: boolean;
  qrCodeImage?: string;
  qrSessionId?: string;
  qrStatus?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  auto: "⚡ Tự động (Multi-AI)",
  gemini_cli: "✨ Gemini CLI (Local)",
  codex_cli: "🟢 OpenAI Codex CLI (Local)",
  claude_cli: "🟣 Claude CLI (Local)",
};

const inputCls = "w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-blue-500";

export function MuseBasicWorkspace({
  onEnterAdvanced,
}: {
  onEnterAdvanced: (targetPath?: string) => void;
}) {
  const toast = useToast();
  const { data: quotaData, reload: reloadQuota } = useApi<any>("users-quota", ["user.", "llm.", "content.", "creative."]);
  const { data: coworkerData, reload: reloadCoworker } = useApi<any>("users-quota/coworker-state", ["llm.", "content.", "creative.", "skill."]);
  const { data: zaloData, reload: reloadZalo } = useApi<any>("zalo/accounts", ["conversation.", "zalo."]);

  const users: any[] = quotaData?.users ?? [];
  const zaloAccounts: any[] = zaloData?.accounts ?? [];
  const customerRules: any[] = zaloData?.customerAiRules ?? [];
  const pool = quotaData?.centralPool;
  const coworkerAgents: any[] = coworkerData?.agents ?? [];
  const coworkerSkills: any[] = coworkerData?.skills ?? [];
  const coworkerWorkspace = coworkerData?.workspace ?? { ragDocs: [], contentItems: [], creativeAssets: [], brainNotes: [] };
  const providersStatus = coworkerData?.providersStatus ?? pool?.providersStatus ?? {};

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedZaloId, setSelectedZaloId] = useState<string>("");
  const [taskMode, setTaskMode] = useState<"auto" | "post" | "image" | "video" | "zalo_sale">("auto");
  const [selectedProvider, setSelectedProvider] = useState<"auto" | "gemini_cli" | "codex_cli" | "claude_cli">("auto");
  const [selectedEffort, setSelectedEffort] = useState<"low" | "medium" | "high">("medium");
  const [attachedAgentKey, setAttachedAgentKey] = useState<string>("");
  const [attachedSkillKey, setAttachedSkillKey] = useState<string>("");
  const [rightDrawer, setRightDrawer] = useState<"none" | "skills_agents" | "workspace_files" | "core_hub">("none");
  const [coreHubTab, setCoreHubTab] = useState<"bundles" | "workflows" | "optimizer" | "automation_api">("bundles");
  const [workspaceTab, setWorkspaceTab] = useState<"content" | "rag" | "media" | "brain">("content");
  const [skillFilter, setSkillFilter] = useState<string>("");
  const [showSlashMenu, setShowSlashMenu] = useState<boolean>(false);
  const [showMentionMenu, setShowMentionMenu] = useState<boolean>(false);
  const [rescanningCli, setRescanningCli] = useState<boolean>(false);
  const [runningWorkflowId, setRunningWorkflowId] = useState<string>("");
  const [scanningInbox, setScanningInbox] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>("");
  const [testCustomerName, setTestCustomerName] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  // Multi-Zalo & Customer AI Rule Manager Modal
  const [zaloModalOpen, setZaloModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<"accounts" | "customers">("accounts");
  const [zcaQrSession, setZcaQrSession] = useState<any>(null);
  const [generatingQr, setGeneratingQr] = useState<boolean>(false);

  // Hộp thoại "Cài đặt Nhanh Thông tin Cửa hàng & Bảng giá" dành cho người không biết công nghệ
  const [shopModalOpen, setShopModalOpen] = useState<boolean>(false);
  const [savingShop, setSavingShop] = useState<boolean>(false);
  const [shopForm, setShopForm] = useState({
    brandName: "",
    industry: "",
    productsSummary: "",
    ragKnowledgeText: "",
  });
  const [showSetupSteps, setShowSetupSteps] = useState<boolean>(true);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [listeningVoice, setListeningVoice] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // New Customer AI Rule state (Bật/Tắt AI cho từng khách hàng cụ thể)
  const [newCustRule, setNewCustRule] = useState({
    customerName: "",
    customerPhone: "",
    zaloAccountId: "all",
    aiEnabled: false,
    note: "Khách quen / tự chat tay — Tắt AI trả lời tự động",
  });
  const [savingCustRule, setSavingCustRule] = useState(false);

  const [turns, setTurns] = useState<ChatTurn[]>(() => {
    try {
      localStorage.removeItem("zono.basic.turns.v2");
      localStorage.removeItem("zono.basic.turns.v3_clean");
      localStorage.removeItem("zono.basic.turns.v4_clean");
      const saved = localStorage.getItem("zono.basic.turns.v5_simple");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return [
      {
        id: "welcome",
        role: "assistant",
        at: new Date().toISOString(),
        mode: "general",
        provider: "Trợ lý Bán hàng",
        text: "Dạ con chào Cô/Chú, Anh/Chị ạ! 👋 Con là **Trợ lý Bán hàng AI** của nhà mình.\n\nMình không cần biết máy tính hay công nghệ đâu ạ — chỉ cần **bấm 1 trong 4 nút to ở trên** hoặc **nhắn việc cần làm vào ô bên dưới** (hoặc bấm nút **🎙️ Nói tiếng Việt**), con sẽ tự làm xong ngay tại đây ạ!",
      },
    ];
  });

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  useEffect(() => {
    if (!selectedZaloId && zaloAccounts.length > 0) {
      setSelectedZaloId(zaloAccounts[0].id);
    }
  }, [zaloAccounts, selectedZaloId]);

  useEffect(() => {
    try {
      localStorage.setItem("zono.basic.turns.v5_simple", JSON.stringify(turns.slice(-30)));
    } catch { /* ignore */ }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // Poll `zca-js` QR Login session status when waiting for user scan (updates both Modal and Inline Chat QR bubble!)
  useEffect(() => {
    if (!zcaQrSession?.sessionId) return;
    if (zcaQrSession.status !== "waiting_scan" && zcaQrSession.status !== "scanned" && zcaQrSession.status !== "generating_qr") return;
    const timer = setInterval(async () => {
      try {
        const s = await api.get(`zalo/zca-qr/${zcaQrSession.sessionId}`);
        setZcaQrSession(s);
        // Cập nhật luôn bong bóng QR ngay trong khung chat nếu người dùng lấy QR trong chat
        setTurns((prev) =>
          prev.map((t) => {
            if (t.qrSessionId !== s.sessionId) return t;
            if (s.status === "connected" && s.account) {
              return {
                ...t,
                qrStatus: "connected",
                text: `✅ **Đã kết nối xong Zalo của ${s.account.name} (${s.account.phone})!**\nTừ giờ con sẽ tự động phụ mình trả lời khách và báo giá trên Zalo này ạ.`,
              };
            }
            if (s.status === "scanned") {
              return {
                ...t,
                qrStatus: "scanned",
                text: `📲 **Đã nhận mã QR (${s.scannedName ?? "Zalo"})** — Mình bấm nút **"Đăng nhập"** trên màn hình điện thoại là xong nhé!`,
              };
            }
            return {
              ...t,
              qrCodeImage: s.qrCodeImage || t.qrCodeImage,
              qrStatus: s.status,
            };
          }),
        );
        if (s.status === "connected" && s.account) {
          toast(`Đã kết nối Zalo thành công: ${s.account.name} (${s.account.phone})!`, "ok");
          setSelectedZaloId(s.account.id);
          reloadZalo();
          clearInterval(timer);
        }
      } catch {
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [zcaQrSession?.sessionId, zcaQrSession?.status, reloadZalo, toast]);

  const handleStartZcaQr = async () => {
    setGeneratingQr(true);
    try {
      const s = await api.post("zalo/zca-qr/start", {
        assignedUserId: activeUser?.id,
        roleLabel: "Tư vấn & Chốt đơn Zalo cá nhân",
        autoReplyEnabled: true,
      });
      setZcaQrSession(s);
    } catch (e: any) {
      toast(e?.message ?? "Lỗi tạo mã QR Zalo", "err");
    } finally {
      setGeneratingQr(false);
    }
  };

  const activeUser = users.find((u) => u.id === selectedUserId) ?? users[0];
  const activeZalo = zaloAccounts.find((a) => a.id === selectedZaloId) ?? zaloAccounts[0];

  const detectIntent = (text: string): "post" | "image" | "video" | "zalo_sale" => {
    if (taskMode !== "auto") return taskMode;
    const lower = text.toLowerCase();
    if (lower.includes("video") || lower.includes("clip") || lower.includes("tiktok") || lower.includes("dựng") || lower.includes("hoạt hình")) {
      return "video";
    }
    if (/\b(vẽ|tạo ảnh|thiết kế ảnh|ảnh|poster|banner|minh hoạ|biếm hoạ|châm biếm|châm biếng|tranh)\b/i.test(lower)) {
      return "image";
    }
    if (lower.includes("zalo") || lower.includes("báo giá") || lower.includes("chốt đơn") || lower.includes("khách hỏi") || lower.includes("mua") || lower.includes("ship")) {
      return "zalo_sale";
    }
    return "post";
  };

  const handleToggleAccountAi = async (acc: any) => {
    const nextVal = !acc.autoReplyEnabled;
    try {
      await api.post(`zalo/accounts/${acc.id}/toggle-ai`, { autoReplyEnabled: nextVal });
      toast(
        nextVal
          ? `Đã BẬT AI trả lời tin nhắn riêng cho nick ${acc.name} (${acc.phone})`
          : `Đã TẮT AI trả lời tin nhắn riêng cho nick ${acc.name} (${acc.phone}) — chuyển sang tự chat tay`,
        nextVal ? "ok" : "info",
      );
      reloadZalo();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi cập nhật trạng thái AI", "err");
    }
  };

  const handleToggleGroupMentionAi = async (acc: any) => {
    const curVal = acc.groupMentionReplyEnabled ?? true;
    const nextVal = !curVal;
    try {
      await api.post(`zalo/accounts/${acc.id}/toggle-ai`, { groupMentionReplyEnabled: nextVal });
      toast(
        nextVal
          ? `Đã BẬT trả lời tự động trong Nhóm Zalo khi có người @tag nick ${acc.name}`
          : `Đã TẮT trả lời tự động trong Nhóm Zalo cho nick ${acc.name}`,
        nextVal ? "ok" : "info",
      );
      reloadZalo();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi cập nhật trạng thái Nhóm Zalo", "err");
    }
  };

  const handleToggleCustomerRule = async (rule: any) => {
    const nextVal = !rule.aiEnabled;
    try {
      await api.post("zalo/customer-rules", {
        ...rule,
        aiEnabled: nextVal,
        note: nextVal ? "Đã bật lại AI trả lời tự động" : "Tắt AI — Chủ shop tự chat riêng",
      });
      toast(
        nextVal
          ? `Đã BẬT lại AI trả lời tự động với khách "${rule.customerName}"`
          : `Đã TẮT AI với khách "${rule.customerName}" — AI sẽ không tự trả lời khách này`,
        nextVal ? "ok" : "info",
      );
      reloadZalo();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi cập nhật khách hàng", "err");
    }
  };

  const handleAddCustomerRule = async () => {
    if (!newCustRule.customerName.trim()) {
      toast("Vui lòng nhập Tên hoặc SĐT khách hàng Zalo", "err");
      return;
    }
    setSavingCustRule(true);
    try {
      await api.post("zalo/customer-rules", newCustRule);
      toast(
        newCustRule.aiEnabled
          ? `Đã thêm "${newCustRule.customerName}" vào danh sách Bật AI`
          : `Đã tắt trả lời AI tự động với khách "${newCustRule.customerName}"`,
        "ok",
      );
      setNewCustRule({
        customerName: "",
        customerPhone: "",
        zaloAccountId: "all",
        aiEnabled: false,
        note: "Khách quen / tự chat tay — Tắt AI trả lời tự động",
      });
      reloadZalo();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi lưu cài đặt khách hàng", "err");
    } finally {
      setSavingCustRule(false);
    }
  };

  const handleDeleteCustomerRule = async (rule: any) => {
    try {
      await api.del(`zalo/customer-rules/${rule.id}`);
      toast(`Đã xoá "${rule.customerName}" khỏi danh sách cấu hình riêng`, "ok");
      reloadZalo();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi xoá", "err");
    }
  };

  // 1. Hiện trực tiếp Mã QR Zalo ngay trong bong bóng Chat (Bà Ngoại chỉ cần nhìn vào khung chat quét cái là xong!)
  const handleSendQrInChat = async () => {
    const userTurn: ChatTurn = {
      id: `u_qr_${Date.now()}`,
      role: "user",
      text: "📱 Cho mình quét mã QR để kết nối tài khoản Zalo",
      at: new Date().toISOString(),
      mode: "zalo_qr",
    };
    setTurns((prev) => [...prev, userTurn]);
    setBusy(true);
    try {
      const s = await api.post("zalo/zca-qr/start", {
        assignedUserId: activeUser?.id,
        roleLabel: "Tư vấn & Chốt đơn Zalo cá nhân",
        autoReplyEnabled: true,
      });
      setZcaQrSession(s);
      const botTurn: ChatTurn = {
        id: `a_qr_${Date.now()}`,
        role: "assistant",
        text: "📱 **Mã QR Zalo của mình đây ạ!**\nMình mở ứng dụng **Zalo trên điện thoại** → Bấm biểu tượng **Quét mã QR** ở góc trên → Hướng camera vào hình vuông bên dưới là kết nối xong ngay (không cần gõ mật khẩu hay số điện thoại):",
        at: new Date().toISOString(),
        mode: "zalo_qr",
        provider: "Kết nối Zalo Trực tiếp",
        qrCodeImage: s.qrCodeImage,
        qrSessionId: s.sessionId,
        qrStatus: s.status,
      };
      setTurns((prev) => [...prev, botTurn]);
    } catch (e: any) {
      toast(e?.message ?? "Lỗi tạo mã QR Zalo", "err");
    } finally {
      setBusy(false);
    }
  };

  // 2. Kéo thả hoặc Chọn File ném thẳng vào ô Chat → Tự động biến thành bộ nhớ Bảng giá & Sản phẩm (RAG)
  const handleIngestFilesInChat = async (files: FileList | null) => {
    if (!files || files.length === 0 || busy) return;
    const targetUserId = activeUser?.id ?? users[0]?.id;
    if (!targetUserId) return;

    for (const file of Array.from(files)) {
      const userTurn: ChatTurn = {
        id: `u_file_${Date.now()}_${file.name}`,
        role: "user",
        text: `📎 Đã thả file vào khung chat: **${file.name}** (${Math.max(1, Math.round(file.size / 1024))} KB)`,
        at: new Date().toISOString(),
        mode: "rag_learn",
      };
      setTurns((prev) => [...prev, userTurn]);
      setBusy(true);

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Không đọc được file"));
          reader.readAsDataURL(file);
        });

        const res = await api.post(`users-quota/users/${targetUserId}/ingest-chat`, {
          fileName: file.name,
          fileBase64: base64,
        });

        const botTurn: ChatTurn = {
          id: `a_file_${Date.now()}`,
          role: "assistant",
          text: res.summaryMarkdown ?? `✅ Đã đọc và ghi nhớ xong file **${file.name}**!`,
          at: new Date().toISOString(),
          mode: "rag_learn",
          provider: "Bộ nhớ Cửa hàng",
        };
        setTurns((prev) => [...prev, botTurn]);
        toast(`Đã học xong file "${file.name}" (${res.chunksAdded ?? 0} mục)!`, "ok");
        reloadQuota();
      } catch (e: any) {
        setTurns((prev) => [
          ...prev,
          {
            id: `err_file_${Date.now()}`,
            role: "assistant",
            text: `⚠️ Không đọc được file "${file.name}": ${e?.message ?? "Vui lòng dùng file Word (.docx), .txt, .csv, .md hoặc dán chữ trực tiếp vào ô chat ạ."}`,
            at: new Date().toISOString(),
          },
        ]);
      } finally {
        setBusy(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // 3. Bấm nút Micro để nói bằng tiếng Việt (Dành cho người ngại gõ bàn phím)
  const handleToggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast("Trình duyệt này chưa hỗ trợ nhận diện giọng nói. Mình dùng Chrome hoặc Edge nhé!", "err");
      return;
    }
    if (listeningVoice && recognitionRef.current) {
      recognitionRef.current.stop();
      setListeningVoice(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "vi-VN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      setListeningVoice(true);
      toast("🎙️ Đang nghe... Mình cứ nói yêu cầu bằng tiếng Việt nhé!", "info");
    };
    rec.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onerror = () => {
      setListeningVoice(false);
    };
    rec.onend = () => {
      setListeningVoice(false);
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const handleRescanCli = async () => {
    setRescanningCli(true);
    try {
      const res = await api.post("users-quota/rescan-cli", {});
      reloadCoworker();
      reloadQuota();
      const readyList = Object.entries(res?.providersStatus ?? {})
        .filter(([k, v]: [string, any]) => k !== "sandbox" && v?.ready)
        .map(([k]) => PROVIDER_LABELS[k] || k);
      toast(
        readyList.length > 0
          ? `Đã quét CLI hệ thống! Sẵn sàng: ${readyList.join(", ")}`
          : "Đã quét xong CLI hệ thống.",
        "ok",
      );
    } catch (e: any) {
      toast(e?.message ?? "Lỗi quét CLI", "err");
    } finally {
      setRescanningCli(false);
    }
  };

  // Core 3: Kích hoạt Gói Nhân sự AI theo Ngành 1 chạm (Học từ agent-bundle/installer.ts của AICoworker.app)
  const handleApplyBundle = async (bundleId: string) => {
    setBusy(true);
    try {
      const res = await api.post("users-quota/bundles/apply", {
        userId: activeUser?.id,
        bundleId,
      });
      if (res?.defaultAgentKey) setAttachedAgentKey(res.defaultAgentKey);
      if (res?.defaultSkillKey) setAttachedSkillKey(res.defaultSkillKey);
      setTurns((prev) => [
        ...prev,
        {
          id: `bundle_${Date.now()}`,
          role: "assistant",
          at: new Date().toISOString(),
          mode: "general",
          provider: "Gói Nhân sự AI",
          agentKey: res?.defaultAgentKey,
          skillKey: res?.defaultSkillKey,
          text: res?.kickoffReplyMarkdown ?? `✅ Đã cài đặt xong Gói Nhân sự AI!`,
        },
      ]);
      toast(`Đã kích hoạt ${res?.bundle?.name ?? "Gói Nhân sự AI"}!`, "ok");
      reloadCoworker();
      reloadQuota();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi kích hoạt Gói Nhân sự AI", "err");
    } finally {
      setBusy(false);
    }
  };

  // Core 4A: Chạy Chuỗi Quy trình Đa Agent (Multi-Agent Workflow DAG) ngay trong khung chat
  const handleRunWorkflowChain = async (wf: any) => {
    const targetUserId = activeUser?.id ?? users[0]?.id;
    if (!targetUserId || busy) return;
    const topicText = prompt.trim() || activeUser?.quota?.productsSummary || activeUser?.quota?.brandName || wf.name;
    if (prompt.trim()) setPrompt("");

    setRunningWorkflowId(wf.id);
    setBusy(true);
    setTurns((prev) => [
      ...prev,
      {
        id: `u_wf_${Date.now()}`,
        role: "user",
        at: new Date().toISOString(),
        mode: "post",
        text: `${wf.emoji} Chạy chuỗi Đa Agent **${wf.name}** cho chủ đề: _"${topicText}"_`,
      },
    ]);

    try {
      const res = await api.post(`users-quota/users/${targetUserId}/workflow`, {
        workflowId: wf.id,
        topicPrompt: topicText,
        providerOverride: selectedProvider,
      });
      setTurns((prev) => [
        ...prev,
        {
          id: `a_wf_${Date.now()}`,
          role: "assistant",
          at: new Date().toISOString(),
          mode: "post",
          provider: res?.provider ?? selectedProvider,
          agentLabel: `Chuỗi ${wf.steps?.length ?? 3} Agents`,
          agentEmoji: wf.emoji,
          durationMs: res?.totalDurationMs,
          tokensUsed: res?.tokensDeducted ?? 0,
          refId: res?.createdRefId,
          text: res?.markdown ?? "Đã hoàn tất chuỗi Đa Agent.",
        },
      ]);
      toast(`Đã chạy xong chuỗi "${wf.name}"!`, "ok");
      reloadCoworker();
      reloadQuota();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi chạy chuỗi Đa Agent", "err");
    } finally {
      setRunningWorkflowId("");
      setBusy(false);
    }
  };

  // Core 1: Lưu chế độ Context Optimizer & Smart Skill Pruning
  const handleSaveOptimizerMode = async (mode: "aggressive" | "balanced" | "full") => {
    try {
      await api.post("users-quota/context-optimizer", { mode });
      toast(
        mode === "aggressive"
          ? "Đã bật Nén Token Tối Đa (Tiết kiệm ~65% hạn mức CLI)"
          : mode === "balanced"
          ? "Đã bật Nén Token Cân Bằng (Khuyên dùng)"
          : "Đã chuyển sang chế độ Ngữ cảnh Đầy đủ (Full Context)",
        "ok",
      );
      reloadCoworker();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi lưu cấu hình Context Optimizer", "err");
    }
  };

  // Core 2: Quét ngay thư mục Auto-Watch Inbox (`data/inbox-auto/`) & Bật/Tắt Event Trigger
  const handleScanInboxAuto = async () => {
    setScanningInbox(true);
    try {
      const res = await api.post("users-quota/inbox-scan", {});
      reloadCoworker();
      reloadQuota();
      if (res?.processedFiles?.length > 0) {
        toast(`Đã tự động đọc ${res.processedFiles.length} file từ thư mục inbox-auto (+${res.chunksAdded} mục RAG)!`, "ok");
      } else {
        toast("Thư mục data/inbox-auto/ hiện chưa có file mới nào chờ học.", "info");
      }
    } catch (e: any) {
      toast(e?.message ?? "Lỗi quét thư mục Auto-Watch", "err");
    } finally {
      setScanningInbox(false);
    }
  };

  const handleToggleTrigger = async (trg: any) => {
    try {
      await api.post(`users-quota/triggers/${trg.id}/toggle`, { enabled: !trg.enabled });
      toast(`${!trg.enabled ? "Đã BẬT" : "Đã TẮT"} tự động hóa: ${trg.name}`, "ok");
      reloadCoworker();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi cập nhật Trigger", "err");
    }
  };

  const handleSend = async (
    overrideText?: string,
    overrideMode?: "post" | "image" | "video" | "zalo_sale",
    overrideOpts?: { agentKey?: string; skillKey?: string },
  ) => {
    const text = (overrideText ?? prompt).trim();
    if (!text || busy) return;
    if (!overrideText) {
      setPrompt("");
      setShowSlashMenu(false);
      setShowMentionMenu(false);
    }

    const lower = text.toLowerCase();

    // 0. Lệnh điều khiển cục bộ nhanh (/clear, /doctor, /skills, /files) học từ AICoworker.app
    if (lower === "/clear" || lower === "/new") {
      setTurns([
        {
          id: `w_${Date.now()}`,
          role: "assistant",
          at: new Date().toISOString(),
          text: "🧹 Đã làm mới phiên trò chuyện! Mình có thể gõ `/` để chọn Kỹ năng Local (như `/rea`), gõ `@` để gọi Agent chuyên trách, hoặc nhắn yêu cầu bất kỳ.",
        },
      ]);
      return;
    }
    if (lower === "/doctor" || lower === "/scan") {
      await handleRescanCli();
      return;
    }
    if (lower === "/skills") {
      setRightDrawer("skills_agents");
      return;
    }
    if (lower === "/files" || lower === "/workspace") {
      setRightDrawer("workspace_files");
      return;
    }

    // A. Nếu người dùng gõ đòi đăng nhập Zalo / lấy mã QR ngay trong ô chat → Hiện luôn QR trong đoạn chat!
    if (
      !overrideMode &&
      (lower.includes("đăng nhập zalo") ||
        lower.includes("kết nối zalo") ||
        lower.includes("quét qr") ||
        lower.includes("lấy qr") ||
        lower.includes("mã qr zalo") ||
        lower.includes("thêm zalo") ||
        lower === "qr" ||
        lower === "/zalo" ||
        lower === "zalo qr")
    ) {
      await handleSendQrInChat();
      return;
    }

    // B. Nếu người dùng dán Link Website (http/https) hoặc bảo AI ghi nhớ bảng giá ngay trong ô chat → Tự nạp vào RAG!
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    const isTeachingRag =
      !overrideMode &&
      !overrideOpts?.skillKey &&
      !attachedSkillKey &&
      (Boolean(urlMatch && text.split(/\s+/).length <= 8) ||
        lower.startsWith("nhớ giúp") ||
        lower.startsWith("ghi nhớ") ||
        lower.startsWith("bảng giá:") ||
        lower.startsWith("học web"));

    if (isTeachingRag) {
      const userTurn: ChatTurn = {
        id: `u_rag_${Date.now()}`,
        role: "user",
        text,
        at: new Date().toISOString(),
        mode: "rag_learn",
      };
      setTurns((prev) => [...prev, userTurn]);
      setBusy(true);
      try {
        const targetUserId = activeUser?.id ?? users[0]?.id;
        const res = await api.post(`users-quota/users/${targetUserId}/ingest-chat`, {
          websiteUrl: urlMatch ? urlMatch[0] : undefined,
          rawText: urlMatch ? text.replace(urlMatch[0], "").trim() : text,
        });
        setTurns((prev) => [
          ...prev,
          {
            id: `a_rag_${Date.now()}`,
            role: "assistant",
            text: res.summaryMarkdown,
            at: new Date().toISOString(),
            mode: "rag_learn",
            provider: "Bộ nhớ Cửa hàng",
          },
        ]);
        reloadQuota();
        reloadCoworker();
      } catch (e: any) {
        setTurns((prev) => [
          ...prev,
          {
            id: `err_rag_${Date.now()}`,
            role: "assistant",
            text: `⚠️ Chưa đọc được nội dung: ${e?.message ?? "Mình có thể copy chữ dán trực tiếp vào ô chat hoặc thả file Word/Txt vào đây nhé!"}`,
            at: new Date().toISOString(),
          },
        ]);
      } finally {
        setBusy(false);
      }
      return;
    }

    const effectiveAgentKey = overrideOpts?.agentKey ?? (attachedAgentKey || undefined);
    const effectiveSkillKey = overrideOpts?.skillKey ?? (attachedSkillKey || undefined);
    const mode = overrideMode ?? detectIntent(text);
    const userTurn: ChatTurn = {
      id: `u_${Date.now()}`,
      role: "user",
      text: mode === "zalo_sale" && testCustomerName ? `[Khách Zalo: ${testCustomerName}] ${text}` : text,
      at: new Date().toISOString(),
      mode,
      agentKey: effectiveAgentKey,
      skillKey: effectiveSkillKey,
    };
    setTurns((prev) => [...prev, userTurn]);
    setBusy(true);

    try {
      const targetUserId = activeUser?.id;
      if (mode === "zalo_sale" && !effectiveSkillKey && !effectiveAgentKey) {
        if (activeZalo) {
          const isGroupMentionSim = /@(ai|bot|shop|zono|trợ\s*lý|tro\s*ly|tư\s*vấn|admin|ad)\b/i.test(text) || text.trim().startsWith("@");
          const res = await api.post(`zalo/accounts/${activeZalo.id}/send-test`, {
            customerName: testCustomerName.trim() || (isGroupMentionSim ? "Khách trong Nhóm Zalo" : "Khách Zalo"),
            customerMessage: text,
            isGroup: isGroupMentionSim,
            groupName: isGroupMentionSim ? "Nhóm Zalo Khách Hàng" : undefined,
            mentionedInGroup: isGroupMentionSim ? true : undefined,
          });
          const rag = res.ragResult;
          const botTurn: ChatTurn = {
            id: `a_${Date.now()}`,
            role: "assistant",
            text: rag?.markdown ?? "Đã xử lý tin nhắn Zalo cá nhân.",
            at: new Date().toISOString(),
            mode: "zalo_sale",
            provider: rag?.provider ?? selectedProvider,
            agentKey: rag?.agentKey ?? "chat",
            agentLabel: rag?.agentLabel ?? "Chat Agent",
            durationMs: rag?.durationMs,
            tokensUsed: rag?.tokensDeducted ?? 0,
            zaloAccountName: `${activeZalo.name} (${activeZalo.phone})`,
            ragSources: rag?.ragSources ?? [],
            refId: res.conversationId,
            aiPaused: Boolean(res.aiPaused),
          };
          setTurns((prev) => [...prev, botTurn]);
        } else if (targetUserId) {
          const ragRes = await api.post(`users-quota/users/${targetUserId}/run`, {
            mode: "zalo_sale",
            prompt: text,
            providerOverride: selectedProvider,
            effort: selectedEffort,
          });
          const botTurn: ChatTurn = {
            id: `a_${Date.now()}`,
            role: "assistant",
            text: ragRes?.markdown ?? "Đã soạn câu trả lời tư vấn Zalo.",
            at: new Date().toISOString(),
            mode: "zalo_sale",
            provider: ragRes?.provider ?? selectedProvider,
            agentKey: ragRes?.agentKey,
            agentLabel: ragRes?.agentLabel,
            agentEmoji: ragRes?.agentEmoji,
            durationMs: ragRes?.durationMs,
            tokensUsed: ragRes?.tokensDeducted ?? 0,
            ragSources: ragRes?.ragSources ?? [],
            refId: ragRes?.createdRefId,
          };
          setTurns((prev) => [...prev, botTurn]);
        }
      } else {
        const ragRes = await api.post(`users-quota/users/${targetUserId ?? users[0]?.id}/run`, {
          mode,
          prompt: text,
          agentKey: effectiveAgentKey,
          skillKey: effectiveSkillKey,
          providerOverride: selectedProvider,
          effort: selectedEffort,
        });

        const botTurn: ChatTurn = {
          id: `a_${Date.now()}`,
          role: "assistant",
          text: ragRes?.markdown ?? "Đã thực hiện xong yêu cầu.",
          at: new Date().toISOString(),
          mode: ragRes?.mode ?? mode,
          provider: ragRes?.provider ?? "AI",
          agentKey: ragRes?.agentKey,
          agentLabel: ragRes?.agentLabel,
          agentEmoji: ragRes?.agentEmoji,
          skillKey: ragRes?.skillKey,
          skillName: ragRes?.skillName,
          durationMs: ragRes?.durationMs,
          fallbackUsed: ragRes?.fallbackUsed,
          tokensUsed: ragRes?.tokensDeducted ?? 0,
          imageUrl: ragRes?.imageUrl,
          videoUrl: ragRes?.videoUrl,
          audioUrl: ragRes?.audioUrl,
          ragSources: ragRes?.ragSources ?? [],
          refId: ragRes?.createdRefId,
        };
        setTurns((prev) => [...prev, botTurn]);
      }
      reloadQuota();
      reloadCoworker();
      reloadZalo();
    } catch (e: any) {
      setTurns((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          text: `⚠️ Lỗi khi thực thi: ${e?.message ?? "Không thể kết nối máy chủ"}`,
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const openQrModal = (tab: "accounts" | "customers" = "accounts") => {
    setModalTab(tab);
    setZaloModalOpen(true);
    if (tab === "accounts") {
      void handleStartZcaQr();
    }
  };

  const openShopModal = () => {
    if (activeUser) {
      setShopForm({
        brandName: activeUser.quota?.brandName || activeUser.name || "",
        industry: activeUser.quota?.industry || "Bán lẻ & Dịch vụ",
        productsSummary: activeUser.quota?.productsSummary || "",
        ragKnowledgeText: activeUser.quota?.ragKnowledgeText || "",
      });
    }
    setShopModalOpen(true);
  };

  const handleSaveShopInfo = async () => {
    if (!activeUser) return;
    if (!shopForm.brandName.trim()) {
      toast("Vui lòng nhập Tên Cửa hàng hoặc Thương hiệu", "err");
      return;
    }
    setSavingShop(true);
    try {
      await api.post("users-quota/users", {
        id: activeUser.id,
        name: activeUser.name,
        email: activeUser.email,
        role: activeUser.role,
        status: activeUser.status,
        planId: activeUser.quota?.planId ?? "growth",
        ...activeUser.quota,
        brandName: shopForm.brandName.trim(),
        industry: shopForm.industry.trim(),
        productsSummary: shopForm.productsSummary.trim(),
        ragKnowledgeText: shopForm.ragKnowledgeText.trim(),
      });
      toast("Đã lưu Thông tin Cửa hàng & Bảng giá! AI đã học xong và sẵn sàng tư vấn/viết bài.", "ok");
      setShopModalOpen(false);
      reloadQuota();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi lưu thông tin cửa hàng", "err");
    } finally {
      setSavingShop(false);
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Đã sao chép! Anh/chị chỉ cần bấm Dán (Ctrl+V) lên Facebook hoặc Zalo.", "ok");
    } catch {
      toast("Không thể sao chép tự động", "err");
    }
  };

  const handleDeleteZalo = async (acc: any) => {
    if (!confirm(`Xoá tài khoản Zalo "${acc.name}" (${acc.phone})?`)) return;
    try {
      await api.del(`zalo/accounts/${acc.id}`);
      toast(`Đã xoá ${acc.name}`, "ok");
      reloadZalo();
    } catch (e: any) {
      toast(e?.message ?? "Lỗi xoá", "err");
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-surface">
      {/* Cột trái: Thiết kế Tối giản, Chữ To Rõ, Bà Ngoại Cũng Xài Được */}
      <aside className="hidden w-76 shrink-0 flex-col justify-between border-r border-line bg-card p-4 md:flex">
        <div className="space-y-4 overflow-y-auto pr-1 scroll-thin">
          {/* Nút Tạo Cuộc Trò Chuyện Mới — To, Rõ Ràng */}
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("zono.basic.turns.v5_simple");
              setTurns([
                {
                  id: `w_${Date.now()}`,
                  role: "assistant",
                  at: new Date().toISOString(),
                  text: "Dạ con đã mở trang trò chuyện mới! Mình cần **Viết bài bán hàng**, **Làm Video**, hay **Trả lời khách Zalo** cứ bấm nút mẫu ở trên hoặc nhắn vào ô bên dưới nhé ạ.",
                },
              ]);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-5 w-5" />
            <span>Bắt đầu cuộc trò chuyện mới</span>
          </button>

          {/* Thẻ 1: Zalo Bán Hàng Của Mình */}
          <div className="rounded-3xl border border-line bg-soft/40 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-ink flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-blue-600" />
                Zalo bán hàng
              </span>
              <button
                type="button"
                onClick={() => void handleSendQrInChat()}
                className="rounded-xl bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-500/20 transition"
              >
                + Quét mã QR
              </button>
            </div>

            {zaloAccounts.length === 0 ? (
              <button
                type="button"
                onClick={() => void handleSendQrInChat()}
                className="w-full rounded-2xl border-2 border-dashed border-blue-500/40 bg-blue-500/5 p-3.5 text-center text-sm font-bold text-blue-600 hover:bg-blue-500/10 transition"
              >
                📱 Bấm vào đây để hiện Mã QR nối Zalo
              </button>
            ) : (
              <div className="space-y-2">
                {zaloAccounts.map((acc) => {
                  const isSel = acc.id === activeZalo?.id;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedZaloId(acc.id)}
                      className={cx(
                        "cursor-pointer rounded-2xl border p-3 transition space-y-2",
                        isSel
                          ? "border-blue-500 bg-blue-500/10 text-ink"
                          : "border-line bg-card hover:bg-soft",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-ink">{acc.name}</div>
                          <div className="text-xs text-muted">📱 {acc.phone}</div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleAccountAi(acc);
                          }}
                          className={cx(
                            "shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-bold transition shadow-2xs",
                            acc.autoReplyEnabled
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-rose-600 text-white hover:bg-rose-700",
                          )}
                        >
                          {acc.autoReplyEnabled ? "🤖 ĐANG BẬT" : "⏸️ ĐANG TẮT"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setModalTab("customers");
                setZaloModalOpen(true);
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-3 py-2.5 text-xs font-semibold text-ink hover:border-amber-500 transition"
            >
              <span>👤 Tắt AI với người quen ({customerRules.length})</span>
              <span className="font-bold text-blue-600">Cài đặt →</span>
            </button>
          </div>

          {/* Thẻ 2: Bảng Giá & Mặt Hàng Của Cửa Hàng */}
          <div className="rounded-3xl border border-line bg-soft/40 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-ink flex items-center gap-2">
                <Store className="h-4 w-4 text-violet-600" />
                Cửa hàng & Bảng giá
              </span>
              {activeUser?.quota?.productsSummary ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  ✓ Đã nhớ giá
                </span>
              ) : null}
            </div>

            {users.length > 1 && (
              <select
                className={cx(inputCls, "py-2 text-sm font-bold")}
                value={activeUser?.id ?? ""}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    🏪 {u.quota?.brandName || u.name}
                  </option>
                ))}
              </select>
            )}

            <div className="rounded-2xl border border-line bg-card p-3 text-xs text-ink space-y-1">
              <div className="font-bold text-sm text-ink">
                🏪 {activeUser?.quota?.brandName || activeUser?.name || "Cửa hàng của mình"}
              </div>
              <div className="line-clamp-3 text-muted leading-relaxed">
                {activeUser?.quota?.productsSummary || "Chưa có bảng giá — hãy bấm nút bên dưới để thêm bảng giá cho AI học."}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-2xl border border-violet-500/40 bg-violet-500/10 px-3 py-2.5 text-xs font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 transition"
              >
                <Paperclip className="h-4 w-4" />
                <span>Chọn file Bảng giá (Word / Txt)</span>
              </button>
              <button
                type="button"
                onClick={openShopModal}
                className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-card px-3 py-2.5 text-xs font-bold text-ink hover:border-violet-500 transition"
              >
                <span>✏️ Tự gõ tên hàng & giá bán</span>
              </button>
            </div>
          </div>
        </div>

        {/* Nút dưới cùng: Mở Công cụ Chuyên sâu (ẩn gọn để không làm rối mắt) */}
        <div className="border-t border-line pt-3 space-y-2">
          <button
            type="button"
            onClick={() => setRightDrawer(rightDrawer === "none" ? "core_hub" : "none")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-soft px-3 py-2.5 text-xs font-bold text-ink hover:border-blue-500 transition"
          >
            <Zap className="h-4 w-4 text-emerald-600" />
            <span>⚙️ Mở Công cụ Chuyên sâu (AI / Kỹ năng)</span>
          </button>
        </div>
      </aside>

      {/* Giữa màn hình: 1 Khung Chat Hiện Đại, Thoáng Đãng, Chữ Lớn Dễ Đọc */}
      <div
        className="relative flex min-w-0 flex-1 flex-col"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleIngestFilesInChat(e.dataTransfer.files);
        }}
      >
        {/* Lớp phủ khi kéo thả File vào khung chat */}
        {dragOver && (
          <div className="pointer-events-none absolute inset-4 z-50 flex flex-col items-center justify-center rounded-3xl border-4 border-dashed border-blue-500 bg-blue-600/15 backdrop-blur-xs text-center p-6">
            <UploadCloud className="mb-3 h-16 w-16 text-blue-600 animate-bounce" />
            <div className="text-2xl font-bold text-ink">
              📂 Thả file vào đây để Trợ lý AI tự đọc và nhớ Bảng giá!
            </div>
            <p className="mt-2 text-base text-muted">
              Nhận file Word (.docx), .txt, .csv — thả vào là thuộc lòng ngay.
            </p>
          </div>
        )}

        {/* Input chọn file ẩn */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".docx,.doc,.txt,.csv,.md,.markdown,.html,.htm,.json,.rtf"
          className="hidden"
          onChange={(e) => void handleIngestFilesInChat(e.target.files)}
        />

        {/* Thanh trên cùng siêu gọn, thân thiện, không có thuật ngữ kỹ thuật */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card/70 px-4 py-2.5 text-xs sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openShopModal}
              className="inline-flex items-center gap-2 rounded-2xl border border-line bg-soft px-3.5 py-1.5 text-xs font-bold text-ink hover:border-violet-500 transition"
            >
              <span>🏪 {activeUser?.quota?.brandName || activeUser?.name || "Cửa hàng của tôi"}</span>
              <span className="rounded-lg bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-700 dark:text-violet-300">
                ✏️ Sửa bảng giá
              </span>
            </button>

            {activeZalo && (
              <button
                type="button"
                onClick={() => void handleToggleAccountAi(activeZalo)}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold transition",
                  activeZalo.autoReplyEnabled
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
                )}
              >
                <span>📱 Zalo {activeZalo.name}:</span>
                <span>{activeZalo.autoReplyEnabled ? "🤖 Đang tự trả lời khách" : "⏸️ Đang tắt tự động"}</span>
              </button>
            )}
          </div>

          {/* 3 Nút tiện ích gọn gàng bên phải */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCoreHubTab("bundles");
                setRightDrawer(rightDrawer === "core_hub" && coreHubTab === "bundles" ? "none" : "core_hub");
              }}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold transition",
                rightDrawer === "core_hub"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-line bg-soft text-ink hover:border-emerald-500",
              )}
            >
              <span>📦 Chọn mẫu Ngành hàng</span>
            </button>

            <button
              type="button"
              onClick={() => setRightDrawer(rightDrawer === "workspace_files" ? "none" : "workspace_files")}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold transition",
                rightDrawer === "workspace_files"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-line bg-soft text-ink hover:border-blue-500",
              )}
            >
              <FolderOpen className="h-3.5 w-3.5 text-blue-600" />
              <span>Bài & Ảnh đã làm</span>
            </button>

            <button
              type="button"
              onClick={() => setRightDrawer(rightDrawer === "skills_agents" ? "none" : "skills_agents")}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-bold transition",
                rightDrawer === "skills_agents"
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-line bg-soft text-muted hover:text-ink",
              )}
              title="Mở kho 83 Kỹ năng chuyên sâu (/rea, pháp lý, marketing...) và chọn AI"
            >
              <Puzzle className="h-3.5 w-3.5 text-violet-600" />
              <span>⚙️ Chuyên sâu</span>
            </button>
          </div>
        </div>

        {/* Luồng tin nhắn & 4 Thẻ Bấm Nhanh Siêu Dễ Hiểu */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-thin">
          {/* 4 Thẻ Hành Động Lớn, Chữ To, Rõ Ràng Ở Đầu Trang */}
          <div className="mx-auto max-w-3xl space-y-4 pt-1">
            <div className="text-center space-y-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-ink">
                Hôm nay mình cần Trợ lý phụ việc gì ạ?
              </h2>
              <p className="text-sm text-muted">
                Chỉ cần bấm nhẹ vào 1 trong 4 ô bên dưới (hoặc nhắn tin ở thanh dưới cùng):
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Ô 1: Dạy AI nhớ bảng giá */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group flex items-start gap-3.5 rounded-3xl border border-line bg-card p-4 text-left shadow-xs hover:border-violet-500 hover:shadow-md transition"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-2xl">
                  📎
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-extrabold text-ink group-hover:text-violet-600 transition">
                      1. Cho AI học Bảng giá
                    </span>
                    {activeUser?.quota?.productsSummary && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        ✓ Đã nhớ
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-muted leading-relaxed">
                    Bấm để chọn file Bảng giá (Word / Txt) trên máy giúp AI thuộc lòng sản phẩm.
                  </p>
                </div>
              </button>

              {/* Ô 2: Quét mã QR nối Zalo */}
              <button
                type="button"
                onClick={() => void handleSendQrInChat()}
                className="group flex items-start gap-3.5 rounded-3xl border border-line bg-card p-4 text-left shadow-xs hover:border-blue-500 hover:shadow-md transition"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-500/15 text-2xl">
                  📱
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-extrabold text-ink group-hover:text-blue-600 transition">
                      2. Quét mã QR nối Zalo
                    </span>
                    {zaloAccounts.length > 0 && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        ✓ Đã nối
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-muted leading-relaxed">
                    Hiện hình mã QR to rõ ngay bên dưới — cầm điện thoại quét cái là xong!
                  </p>
                </div>
              </button>

              {/* Ô 3: Viết bài đăng bán hàng */}
              <button
                type="button"
                onClick={() =>
                  void handleSend(
                    "Viết giúp mình 1 bài đăng Facebook và Zalo bán hàng thật thu hút, gần gũi kèm giá bán và ưu đãi hôm nay",
                    "post",
                  )
                }
                className="group flex items-start gap-3.5 rounded-3xl border border-line bg-card p-4 text-left shadow-xs hover:border-emerald-500 hover:shadow-md transition"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/15 text-2xl">
                  ✍️
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-extrabold text-ink group-hover:text-emerald-600 transition">
                    3. Viết bài đăng bán hàng
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-muted leading-relaxed">
                    Tự động viết bài giới thiệu sản phẩm hay, rõ ràng để đăng lên Facebook / Zalo.
                  </p>
                </div>
              </button>

              {/* Ô 4: Làm Video & Trả lời khách */}
              <button
                type="button"
                onClick={() =>
                  void handleSend(
                    "Tạo video ngắn giới thiệu sản phẩm của cửa hàng kèm giọng đọc tiếng Việt và lời mời nhắn Zalo đặt hàng",
                    "video",
                  )
                }
                className="group flex items-start gap-3.5 rounded-3xl border border-line bg-card p-4 text-left shadow-xs hover:border-amber-500 hover:shadow-md transition"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-2xl">
                  🎬
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-extrabold text-ink group-hover:text-amber-600 transition">
                    4. Làm Video có giọng đọc
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-muted leading-relaxed">
                    Tự dựng video bán hàng có giọng đọc tiếng Việt rõ ràng phát ngay tại đây.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Danh sách bong bóng hội thoại — Thoáng đãng, Chữ lớn 15px, Không rối mắt */}
          <div className="mx-auto max-w-3xl space-y-4">
            {turns.map((t) => (
              <div
                key={t.id}
                className={cx(
                  "flex flex-col rounded-3xl border p-5 shadow-xs",
                  t.role === "user"
                    ? "ml-auto max-w-[85%] border-blue-500/30 bg-blue-500/10 text-ink"
                    : t.aiPaused
                    ? "mr-auto w-full border-amber-500/40 bg-amber-500/5 text-ink"
                    : "mr-auto w-full border-line bg-card text-ink",
                )}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-ink">
                      {t.role === "user"
                        ? "👤 Mình nhắn:"
                        : `${t.agentEmoji ?? "🤖"} ${t.agentLabel ?? "Trợ lý Bán hàng AI"}`}
                    </span>
                    {t.skillKey && (
                      <Badge tone="violet">🧩 Kỹ năng: /{t.skillKey}</Badge>
                    )}
                    {t.aiPaused && (
                      <Badge tone="amber">⏸️ Đã tắt AI (Để mình tự nhắn riêng)</Badge>
                    )}
                  </div>
                </div>

                <ChatMarkdown text={t.text} />

                {/* Nếu tin nhắn có Mã QR Zalo trực tiếp trong đoạn chat — Bà Ngoại chỉ việc cầm điện thoại quét! */}
                {t.qrCodeImage && t.qrStatus !== "connected" && (
                  <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border-2 border-blue-500/30 bg-blue-500/5 p-5 text-center space-y-3">
                    <img
                      src={t.qrCodeImage}
                      alt="Mã QR Zalo"
                      className="h-60 w-60 rounded-2xl border border-line bg-white p-3 shadow-sm object-contain"
                    />
                    <div className="text-sm font-bold text-blue-600">
                      {t.qrStatus === "scanned"
                        ? "📲 Đã quét xong! Hãy bấm nút 'Đăng nhập' trên màn hình điện thoại nhé ạ."
                        : "📱 Mở ứng dụng Zalo trên điện thoại → Quét hình mã QR này là xong!"}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => void handleSendQrInChat()}>
                      <QrCode className="mr-1.5 h-4 w-4 text-blue-600" /> Lấy lại mã QR mới
                    </Button>
                  </div>
                )}

                {/* Nếu kết quả có Ảnh thiết kế AI thì hiển thị ngay trong khung chat */}
                {t.imageUrl && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-soft p-3.5">
                    <div className="mb-2.5 flex items-center justify-between text-sm font-bold text-ink">
                      <span>🎨 Hình ảnh vừa vẽ xong:</span>
                      <a
                        href={t.imageUrl}
                        download={`anh-ban-hang-${t.id}.jpg`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        ⬇️ Lưu ảnh về máy
                      </a>
                    </div>
                    <img
                      src={t.imageUrl}
                      alt="Ảnh AI"
                      className="mx-auto max-h-[460px] w-auto rounded-2xl border border-line bg-card object-contain shadow-sm"
                    />
                  </div>
                )}

                {/* Nếu kết quả có Video hoặc Audio thì nhúng trực tiếp ngay trong khung chat */}
                {(t.videoUrl || t.audioUrl) && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 rounded-2xl border border-line bg-soft p-3.5">
                    {t.videoUrl && (
                      <div>
                        <div className="mb-1.5 text-sm font-bold text-ink">🎬 Bấm nút tam giác để xem Video:</div>
                        <video
                          src={t.videoUrl}
                          controls
                          className="max-h-60 w-full rounded-xl border border-line bg-black object-contain"
                        />
                      </div>
                    )}
                    {t.audioUrl && (
                      <div className="flex flex-col justify-center">
                        <div className="mb-1.5 text-sm font-bold text-ink flex items-center gap-1.5">
                          <Volume2 className="h-4 w-4 text-violet-600" /> Nghe thử giọng đọc tiếng Việt:
                        </div>
                        <audio src={t.audioUrl} controls className="w-full" />
                      </div>
                    )}
                  </div>
                )}

                {/* Thanh nút hành động to, rõ ràng dưới mỗi câu trả lời của AI */}
                {t.role === "assistant" && t.id !== "welcome" && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyText(t.text)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition"
                      >
                        <Copy className="h-4 w-4" /> Sao chép chữ (Để dán lên Zalo / Facebook)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleSend(
                            `Hãy viết lại nội dung vừa rồi ngắn gọn, dễ hiểu và gần gũi hơn nữa`,
                            t.mode === "video" || t.mode === "zalo_sale" ? t.mode : "post",
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-soft px-3 py-2 text-xs font-bold text-ink hover:bg-card transition"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-muted" /> Viết lại ngắn gọn hơn
                      </button>
                      {!t.imageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleSend(
                              `Vẽ giúp mình 1 bức ảnh minh hoạ thật đẹp và nổi bật cho nội dung vừa rồi`,
                              "image",
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-soft px-3 py-2 text-xs font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition"
                        >
                          🎨 Vẽ thêm hình minh hoạ
                        </button>
                      )}
                      {t.videoUrl && (
                        <a
                          href={t.videoUrl}
                          download="video-ban-hang.mp4"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-700 transition"
                        >
                          ⬇️ Tải Video về máy
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="mx-auto max-w-3xl rounded-3xl border border-blue-500/30 bg-blue-500/5 p-5 text-sm font-semibold text-blue-700 dark:text-blue-300 animate-pulse">
                🤖 Trợ lý đang làm việc cho cửa hàng <b>{activeUser?.quota?.brandName || activeUser?.name}</b>, mình chờ vài giây nhé ạ...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Thanh Nhắn Tin Hiện Đại Ở Dưới Cùng — Gọn Gàng Như Nhắn Zalo, Có Nút Nói Tiếng Việt To Rõ */}
        <div className="relative border-t border-line bg-card/95 p-3 sm:px-6 sm:py-4">
          <div className="mx-auto max-w-3xl space-y-2">
            {/* Popup Menu chọn nhanh /Skill khi gõ dấu '/' */}
            {showSlashMenu && (
              <div className="mb-2 max-h-64 overflow-y-auto rounded-2xl border border-violet-500/40 bg-card p-2 shadow-xl scroll-thin">
                <div className="mb-1.5 flex items-center justify-between px-2 py-1 text-[11px] font-bold text-violet-600">
                  <span>🧩 Chọn Kỹ năng chuyên sâu (/Skill) hoặc Lệnh nhanh:</span>
                  <button
                    type="button"
                    onClick={() => setShowSlashMenu(false)}
                    className="rounded p-0.5 text-muted hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {[
                    {
                      cmd: "/rea",
                      skillKey: "reverse-engineer-anything",
                      title: "🔬 /rea (reverse-engineer-anything v50)",
                      desc: "Dịch ngược ứng dụng, phân tích kiến trúc binary/Electron/Web & tái tạo hệ thống",
                    },
                    {
                      cmd: "/vn-legal-check",
                      skillKey: "vn-legal-check",
                      title: "⚖️ /vn-legal-check",
                      desc: "Rà soát pháp lý quảng cáo & nội dung theo quy định Việt Nam",
                    },
                    {
                      cmd: "/doctor",
                      skillKey: "",
                      title: "🩺 /doctor (Kiểm tra AI trên máy)",
                      desc: "Tự động dò tìm lại Claude CLI, Gemini CLI, OpenAI Codex CLI trên máy",
                    },
                    {
                      cmd: "/clear",
                      skillKey: "",
                      title: "🧹 /clear (Làm mới đoạn chat)",
                      desc: "Xoá lịch sử hiển thị hiện tại để bắt đầu cuộc trò chuyện mới",
                    },
                  ].map((item) => (
                    <button
                      key={item.cmd}
                      type="button"
                      onClick={() => {
                        setShowSlashMenu(false);
                        if (item.skillKey) {
                          setAttachedSkillKey(item.skillKey);
                          if (prompt.startsWith("/")) setPrompt("");
                        } else {
                          void handleSend(item.cmd);
                        }
                      }}
                      className="flex flex-col rounded-xl border border-line bg-soft/60 p-2 text-left text-xs hover:border-violet-500 hover:bg-violet-500/10 transition"
                    >
                      <span className="font-bold text-ink">{item.title}</span>
                      <span className="text-[11px] text-muted line-clamp-1">{item.desc}</span>
                    </button>
                  ))}

                  {coworkerSkills
                    .filter((s) => {
                      const qStr = prompt.startsWith("/") ? prompt.slice(1).toLowerCase() : "";
                      if (!qStr) return true;
                      return s.key.toLowerCase().includes(qStr) || s.name.toLowerCase().includes(qStr);
                    })
                    .slice(0, 14)
                    .map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => {
                          setAttachedSkillKey(s.key);
                          setShowSlashMenu(false);
                          if (prompt.startsWith("/")) setPrompt("");
                        }}
                        className="flex flex-col rounded-xl border border-line bg-card p-2 text-left text-xs hover:border-violet-500 hover:bg-violet-500/10 transition"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-violet-700 dark:text-violet-300 truncate">
                            /{s.key}
                          </span>
                          {s.isRea && <Badge tone="violet">REA v{s.version}</Badge>}
                        </div>
                        <span className="text-[11px] text-muted line-clamp-1">
                          {s.description || s.name}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Popup Menu chọn nhanh @Agent khi gõ '@' */}
            {showMentionMenu && (
              <div className="mb-2 max-h-60 overflow-y-auto rounded-2xl border border-blue-500/40 bg-card p-2 shadow-xl scroll-thin">
                <div className="mb-1.5 flex items-center justify-between px-2 py-1 text-[11px] font-bold text-blue-600">
                  <span>🤖 Chọn Nhân sự AI chuyên trách:</span>
                  <button
                    type="button"
                    onClick={() => setShowMentionMenu(false)}
                    className="rounded p-0.5 text-muted hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {coworkerAgents.map((ag) => (
                    <button
                      key={ag.key}
                      type="button"
                      onClick={() => {
                        setAttachedAgentKey(ag.key);
                        setShowMentionMenu(false);
                        if (prompt.endsWith("@")) setPrompt(prompt.slice(0, -1));
                      }}
                      className="flex items-start gap-2 rounded-xl border border-line bg-card p-2 text-left text-xs hover:border-blue-500 hover:bg-blue-500/10 transition"
                    >
                      <span className="text-base">{ag.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-ink">
                          {ag.label} <span className="text-[10.5px] font-normal text-blue-600">@{ag.key}</span>
                        </div>
                        <div className="text-[11px] text-muted line-clamp-1">{ag.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chỉ hiển thị thanh nhỏ nếu người dùng đang chủ động gắn @Agent hoặc /Skill */}
            {(attachedAgentKey || attachedSkillKey) && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-violet-500/30 bg-violet-500/5 px-3 py-1.5 text-xs">
                <span className="text-[11px] font-semibold text-muted">Đang dùng công cụ chuyên sâu:</span>
                {attachedAgentKey && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    🤖 @{attachedAgentKey}
                    <button
                      type="button"
                      onClick={() => setAttachedAgentKey("")}
                      className="ml-0.5 rounded-full hover:bg-white/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {attachedSkillKey && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    🧩 /{attachedSkillKey}
                    <button
                      type="button"
                      onClick={() => setAttachedSkillKey("")}
                      className="ml-0.5 rounded-full hover:bg-white/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* 1 Thanh Nhập Liệu Duy Nhất, Bo Tròn Hiện Đại, Chữ To Rõ */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-3xl border-2 border-line bg-soft/60 p-2 shadow-sm focus-within:border-blue-500 focus-within:bg-card transition"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-violet-500/10 px-3.5 text-xs font-bold text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 transition"
                title="Gửi file Bảng giá Word/Txt cho AI học"
              >
                <Paperclip className="h-4 w-4" />
                <span>Gửi File</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSendQrInChat()}
                disabled={busy}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-blue-500/10 px-3.5 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition"
                title="Hiện hình mã QR Zalo ngay trong đoạn chat"
              >
                <QrCode className="h-4 w-4" />
                <span>QR Zalo</span>
              </button>

              <input
                className="min-w-[180px] flex-1 bg-transparent px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted"
                value={prompt}
                onChange={(e) => {
                  const val = e.target.value;
                  setPrompt(val);
                  if (val.startsWith("/") && !val.includes(" ")) {
                    setShowSlashMenu(true);
                    setShowMentionMenu(false);
                  } else if (val.endsWith("@")) {
                    setShowMentionMenu(true);
                    setShowSlashMenu(false);
                  } else {
                    setShowSlashMenu(false);
                    setShowMentionMenu(false);
                  }
                }}
                placeholder="Nhắn việc cần làm vào đây (hoặc bấm nút 🎙️ Nói tiếng Việt)..."
                disabled={busy}
              />

              <button
                type="button"
                onClick={handleToggleVoiceInput}
                className={cx(
                  "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 text-xs font-bold transition",
                  listeningVoice
                    ? "border-rose-500 bg-rose-600 text-white animate-pulse"
                    : "border-line bg-card text-ink hover:border-rose-500/50",
                )}
                title="Bấm để nói bằng giọng nói tiếng Việt"
              >
                {listeningVoice ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-rose-600" />}
                <span>{listeningVoice ? "Đang nghe..." : "Nói"}</span>
              </button>

              <Button type="submit" variant="primary" disabled={busy || !prompt.trim()} className="h-11 px-6 rounded-2xl text-sm font-bold">
                <Send className="mr-1.5 h-4 w-4" /> Gửi
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Cột phải (Chỉ hiện khi bấm nút 'Chọn mẫu Ngành hàng', 'Bài & Ảnh đã làm' hoặc '⚙️ Chuyên sâu') */}
      {rightDrawer !== "none" && (
        <aside className="flex w-88 shrink-0 flex-col border-l border-line bg-card p-3.5 overflow-hidden">
          {rightDrawer === "skills_agents" ? (
            <div className="flex h-full flex-col space-y-3 overflow-hidden">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <Puzzle className="h-4 w-4 text-violet-600" />
                  <span>⚙️ Công cụ Chuyên sâu ({coworkerSkills.length} Kỹ năng)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRightDrawer("none")}
                  className="rounded-lg p-1 text-muted hover:bg-soft hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Hộp điều khiển CLI AI Local & Độ sâu suy luận (Chỉ nằm trong ngăn Chuyên sâu để không làm rối màn hình chính) */}
              <div className="rounded-2xl border border-line bg-soft/60 p-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink flex items-center gap-1">
                    <Terminal className="h-3.5 w-3.5 text-emerald-600" /> Bộ não AI trên máy:
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleRescanCli()}
                    disabled={rescanningCli}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300"
                  >
                    <RefreshCw className={cx("h-3 w-3", rescanningCli && "animate-spin")} />
                    <span>Quét lại CLI</span>
                  </button>
                </div>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as any)}
                  className="w-full rounded-xl border border-line bg-card px-2.5 py-1.5 text-xs font-bold text-ink outline-none"
                >
                  <option value="auto">⚡ Tự động chọn AI tốt nhất (Multi-CLI)</option>
                  <option value="gemini_cli">
                    ✨ Gemini CLI {providersStatus?.gemini_cli?.ready ? "✓ Sẵn sàng" : "⚠️"}
                  </option>
                  <option value="codex_cli">
                    🟢 OpenAI Codex CLI {providersStatus?.codex_cli?.ready ? "✓ Sẵn sàng" : "⚠️"}
                  </option>
                  <option value="claude_cli">
                    🟣 Claude CLI {providersStatus?.claude_cli?.ready ? "✓ Sẵn sàng" : "⏳ Chờ hạn mức"}
                  </option>
                </select>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[11px] text-muted">Độ sâu suy luận:</span>
                  <div className="inline-flex rounded-xl border border-line bg-card p-0.5 text-[11px]">
                    {(
                      [
                        { id: "low", label: "Nhanh" },
                        { id: "medium", label: "Chuẩn" },
                        { id: "high", label: "Sâu" },
                      ] as const
                    ).map((ef) => (
                      <button
                        key={ef.id}
                        type="button"
                        onClick={() => setSelectedEffort(ef.id)}
                        className={cx(
                          "rounded-lg px-2 py-0.5 font-semibold transition",
                          selectedEffort === ef.id ? "bg-blue-600 text-white" : "text-muted hover:text-ink",
                        )}
                      >
                        {ef.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ô tìm kiếm kỹ năng */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  className="w-full rounded-xl border border-line bg-soft pl-8 pr-3 py-1.5 text-xs text-ink outline-none focus:border-violet-500"
                  placeholder="Tìm kỹ năng (VD: rea, legal, seo, video...)"
                  value={skillFilter}
                  onChange={(e) => setSkillFilter(e.target.value)}
                />
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1 scroll-thin">
                {/* Khối 1: Bộ Kỹ năng REA (Reverse Engineer Anything v50) vừa cài đặt */}
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-violet-700 dark:text-violet-300">
                    <span>🔬 Bộ Kỹ năng REA (morluto/rea v50)</span>
                    <Badge tone="violet">Local</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {coworkerSkills
                      .filter(
                        (s) =>
                          s.isRea &&
                          (!skillFilter.trim() ||
                            s.key.toLowerCase().includes(skillFilter.toLowerCase()) ||
                            s.description.toLowerCase().includes(skillFilter.toLowerCase())),
                      )
                      .map((s) => {
                        const isAttached = attachedSkillKey === s.key;
                        return (
                          <div
                            key={s.key}
                            className={cx(
                              "rounded-xl border p-2 text-xs transition",
                              isAttached
                                ? "border-violet-500 bg-violet-500/15"
                                : "border-line bg-card hover:border-violet-500/50",
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-ink truncate">/{s.key}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setAttachedSkillKey(isAttached ? "" : s.key)}
                                  className={cx(
                                    "rounded-lg px-2 py-0.5 text-[10px] font-bold transition",
                                    isAttached
                                      ? "bg-violet-600 text-white"
                                      : "bg-soft text-violet-700 dark:text-violet-300 hover:bg-violet-500/20",
                                  )}
                                >
                                  {isAttached ? "✓ Đang gắn" : "+ Gắn vào Chat"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAttachedSkillKey(s.key);
                                    void handleSend(
                                      `Áp dụng kỹ năng /${s.key} để phân tích kiến trúc và đề xuất cải tiến cho hệ thống hiện tại`,
                                      "post",
                                      { skillKey: s.key, agentKey: attachedAgentKey || "market_research" },
                                    );
                                  }}
                                  className="rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                                  title="Chạy trực tiếp kỹ năng này ngay trong khung chat"
                                >
                                  ▶ Chạy
                                </button>
                              </div>
                            </div>
                            <p className="mt-1 text-[10.5px] text-muted line-clamp-2">{s.description}</p>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Khối 2: Đội ngũ @Agent chuyên trách */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-ink px-1">
                    🤖 Đội ngũ @Agent chuyên trách ({coworkerAgents.length})
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {coworkerAgents.map((ag) => {
                      const isSel = attachedAgentKey === ag.key;
                      return (
                        <div
                          key={ag.key}
                          onClick={() => setAttachedAgentKey(isSel ? "" : ag.key)}
                          className={cx(
                            "cursor-pointer rounded-xl border p-2 text-xs transition flex items-center justify-between gap-2",
                            isSel
                              ? "border-blue-500 bg-blue-500/15"
                              : "border-line bg-soft/40 hover:bg-soft",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-ink flex items-center gap-1">
                              <span>{ag.emoji}</span>
                              <span className="truncate">{ag.label}</span>
                              <span className="text-[10px] font-normal text-blue-600">@{ag.key}</span>
                            </div>
                            <div className="text-[10.5px] text-muted line-clamp-1">{ag.description}</div>
                          </div>
                          <span
                            className={cx(
                              "shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold",
                              isSel ? "bg-blue-600 text-white" : "bg-card text-muted",
                            )}
                          >
                            {isSel ? "Đang chọn" : "Chọn"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Khối 3: Toàn bộ Kỹ năng Marketing, Pháp lý, SEO, Bán hàng Local */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-ink px-1">
                    🧩 Kho Kỹ năng Nghiệp vụ ({coworkerSkills.filter((s) => !s.isRea).length})
                  </div>
                  <div className="space-y-1.5">
                    {coworkerSkills
                      .filter(
                        (s) =>
                          !s.isRea &&
                          (!skillFilter.trim() ||
                            s.key.toLowerCase().includes(skillFilter.toLowerCase()) ||
                            s.name.toLowerCase().includes(skillFilter.toLowerCase()) ||
                            s.description.toLowerCase().includes(skillFilter.toLowerCase())),
                      )
                      .slice(0, 40)
                      .map((s) => {
                        const isAttached = attachedSkillKey === s.key;
                        return (
                          <div
                            key={s.key}
                            className={cx(
                              "rounded-xl border p-2 text-xs transition",
                              isAttached
                                ? "border-violet-500 bg-violet-500/15"
                                : "border-line bg-card hover:bg-soft/60",
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold text-ink truncate">/{s.key}</span>
                              <button
                                type="button"
                                onClick={() => setAttachedSkillKey(isAttached ? "" : s.key)}
                                className={cx(
                                  "shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold",
                                  isAttached
                                    ? "bg-violet-600 text-white"
                                    : "bg-soft text-violet-700 dark:text-violet-300 hover:bg-violet-500/20",
                                )}
                              >
                                {isAttached ? "✓ Đang gắn" : "+ Gắn"}
                              </button>
                            </div>
                            <div className="mt-0.5 text-[10.5px] text-muted line-clamp-2">
                              {s.description || s.name}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>
          ) : rightDrawer === "workspace_files" ? (
            /* Khay Tệp & Kết quả Local (Học từ WorkspacePanel.tsx của AICoworker.app) */
            <div className="flex h-full flex-col space-y-3 overflow-hidden">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <FolderOpen className="h-4 w-4 text-blue-600" />
                  <span>Tệp & Kết quả Local</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRightDrawer("none")}
                  className="rounded-lg p-1 text-muted hover:bg-soft hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1 rounded-xl bg-soft p-1 text-[11px] font-semibold">
                {(
                  [
                    { id: "content", label: `Bài (${coworkerWorkspace.contentItems?.length ?? 0})` },
                    { id: "rag", label: `RAG (${coworkerWorkspace.ragDocs?.length ?? 0})` },
                    { id: "media", label: `Ảnh (${coworkerWorkspace.creativeAssets?.length ?? 0})` },
                    { id: "brain", label: `Note (${coworkerWorkspace.brainNotes?.length ?? 0})` },
                  ] as const
                ).map((tb) => (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setWorkspaceTab(tb.id)}
                    className={cx(
                      "rounded-lg py-1 text-center transition",
                      workspaceTab === tb.id ? "bg-card text-blue-600 shadow-xs" : "text-muted hover:text-ink",
                    )}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto pr-1 scroll-thin text-xs">
                {workspaceTab === "content" &&
                  (coworkerWorkspace.contentItems?.length ? (
                    coworkerWorkspace.contentItems.map((c: any) => (
                      <div key={c.id} className="rounded-xl border border-line bg-soft/40 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-ink truncate">{c.title || "Bài viết AI"}</span>
                          <Badge tone="blue">@{c.agentKey}</Badge>
                        </div>
                        <p className="text-[11px] text-muted line-clamp-3 whitespace-pre-wrap">{c.snippet}</p>
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => void handleCopyText(c.snippet)}
                            className="text-[11px] font-semibold text-blue-600 hover:underline"
                          >
                            📋 Sao chép
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrompt(`Hãy cải tiến và mở rộng nội dung này: "${String(c.title || "").slice(0, 80)}"`)}
                            className="text-[11px] font-semibold text-violet-600 hover:underline"
                          >
                            💬 Đưa vào Chat →
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-line p-4 text-center text-muted">
                      Chưa có bài viết nào được lưu. Mình chỉ cần nhắn yêu cầu trong khung chat là kết quả sẽ tự lưu tại đây!
                    </div>
                  ))}

                {workspaceTab === "rag" &&
                  (coworkerWorkspace.ragDocs?.length ? (
                    coworkerWorkspace.ragDocs.map((d: any) => (
                      <div key={d.id} className="rounded-xl border border-line bg-soft/40 p-2.5 space-y-1">
                        <div className="font-bold text-ink">{d.title}</div>
                        <div className="text-[10.5px] text-emerald-600 font-medium">Nguồn: {d.source}</div>
                        <p className="text-[11px] text-muted line-clamp-3 whitespace-pre-wrap">{d.snippet}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-line p-4 text-center text-muted">
                      Chưa có tài liệu RAG. Hãy kéo thả file Word/Txt vào ô chat để AI học nhé!
                    </div>
                  ))}

                {workspaceTab === "media" &&
                  (coworkerWorkspace.creativeAssets?.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {coworkerWorkspace.creativeAssets.map((a: any) => (
                        <a
                          key={a.id}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-xl border border-line bg-soft p-1.5 hover:border-blue-500 transition"
                        >
                          <img src={a.url} alt="Asset" className="h-28 w-full rounded-lg object-cover bg-card" />
                          <div className="mt-1 truncate text-[10px] text-muted">{a.kind}</div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line p-4 text-center text-muted">
                      Chưa có ảnh thiết kế nào. Hãy gõ &quot;Vẽ ảnh...&quot; trong ô chat để tạo ảnh!
                    </div>
                  ))}

                {workspaceTab === "brain" &&
                  (coworkerWorkspace.brainNotes?.length ? (
                    coworkerWorkspace.brainNotes.map((n: any) => (
                      <div key={n.id} className="rounded-xl border border-line bg-soft/40 p-2.5 space-y-1">
                        <div className="font-bold text-ink">{n.title}</div>
                        <p className="text-[11px] text-muted line-clamp-3">{n.snippet}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-line p-4 text-center text-muted">
                      Chưa có ghi chú Brain nào.
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            /* Khay ⚡ Core Hub: 4 Phân hệ Core học từ AICoworker.app (Gói Ngành, Chuỗi Đa Agent, Nén Token CLI, Auto-Inbox & OpenAI API) */
            <div className="flex h-full flex-col space-y-3 overflow-hidden">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <Zap className="h-4 w-4 text-emerald-600" />
                  <span>Trung tâm 4 Phân hệ Core Local</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRightDrawer("none")}
                  className="rounded-lg p-1 text-muted hover:bg-soft hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1 rounded-xl bg-soft p-1 text-[10.5px] font-bold">
                {(
                  [
                    { id: "bundles", label: "📦 Gói Ngành" },
                    { id: "workflows", label: "🔗 Đa Agent" },
                    { id: "optimizer", label: "✂️ Nén Token" },
                    { id: "automation_api", label: "📂 Tự động" },
                  ] as const
                ).map((tb) => (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setCoreHubTab(tb.id)}
                    className={cx(
                      "rounded-lg py-1.5 text-center transition",
                      coreHubTab === tb.id ? "bg-card text-emerald-600 shadow-xs" : "text-muted hover:text-ink",
                    )}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 scroll-thin text-xs">
                {/* TAB 1: Core 3 — 1-Click Industry Agent Bundles */}
                {coreHubTab === "bundles" && (
                  <div className="space-y-2.5">
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-2.5 text-[11px] text-muted">
                      📦 <b>Đóng gói & Cài đặt Nhân sự AI 1 chạm:</b> Chọn đúng ngành của anh/chị để hệ thống tự cấu hình `@Agent`, bộ `/Skills` chuyên ngành và kịch bản tư vấn mẫu ngay lập tức.
                    </div>
                    {(coworkerData?.bundles?.catalog ?? []).map((b: any) => {
                      const isActive = coworkerData?.bundles?.activeBundleId === b.id;
                      return (
                        <div
                          key={b.id}
                          className={cx(
                            "rounded-2xl border p-3 space-y-2 transition",
                            isActive
                              ? "border-emerald-500 bg-emerald-500/10"
                              : "border-line bg-card hover:border-emerald-500/50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-ink flex items-center gap-1.5">
                                <span className="text-base">{b.emoji}</span>
                                <span>{b.name}</span>
                              </div>
                              <div className="text-[10.5px] text-emerald-600 font-medium mt-0.5">
                                Agent chính: @{b.defaultAgentKey} · {b.pinnedSkills?.length ?? 0} kỹ năng
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleApplyBundle(b.id)}
                              className={cx(
                                "shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold transition",
                                isActive
                                  ? "bg-emerald-600 text-white"
                                  : "bg-blue-600 text-white hover:bg-blue-700",
                              )}
                            >
                              {isActive ? "✓ Đang dùng" : "⚡ Cài 1 chạm"}
                            </button>
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed">{b.tagline}</p>
                          <div className="flex flex-wrap gap-1">
                            {(b.pinnedSkills ?? []).map((sk: string) => (
                              <span
                                key={sk}
                                className="rounded-md border border-line bg-soft px-1.5 py-0.5 text-[10px] font-medium text-ink"
                              >
                                /{sk}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    <a
                      href="/v1/users-quota/bundles/export"
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-soft py-2 text-xs font-bold text-ink hover:border-blue-500 transition"
                    >
                      ⬇️ Xuất cấu hình Cửa hàng hiện tại thành Gói (.json)
                    </a>
                  </div>
                )}

                {/* TAB 2: Core 4A — 1-Click Multi-Agent Workflow Chains (DAG) */}
                {coreHubTab === "workflows" && (
                  <div className="space-y-2.5">
                    <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-2.5 text-[11px] text-muted">
                      🔗 <b>Chuỗi Phối hợp Đa Agent (DAG Workflow):</b> Bấm 1 nút để nhiều Agent chuyên trách tự động nối tiếp nhau xử lý trọn gói và trả báo cáo ngay trong khung chat.
                    </div>
                    {(coworkerData?.workflows ?? []).map((wf: any) => {
                      const isRunning = runningWorkflowId === wf.id;
                      return (
                        <div
                          key={wf.id}
                          className="rounded-2xl border border-line bg-card p-3 space-y-2 hover:border-violet-500/50 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-ink flex items-center gap-1.5">
                              <span className="text-base">{wf.emoji}</span>
                              <span>{wf.name}</span>
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleRunWorkflowChain(wf)}
                              className="shrink-0 rounded-xl bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                            >
                              {isRunning ? "⏳ Đang chạy..." : "▶ Chạy chuỗi"}
                            </button>
                          </div>
                          <p className="text-[11px] text-muted">{wf.description}</p>
                          <div className="space-y-1 rounded-xl bg-soft/60 p-2 text-[10.5px]">
                            {(wf.steps ?? []).map((st: any) => (
                              <div key={st.stepNumber} className="flex items-center gap-1.5 text-ink">
                                <span className="font-bold text-violet-600">B{st.stepNumber}:</span>
                                <span className="truncate">{st.title}</span>
                                <Badge tone="blue">@{st.agentKey}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* TAB 3: Core 1 — Context Optimizer & Smart Skill Pruning */}
                {coreHubTab === "optimizer" && (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                      <div className="font-bold text-ink flex items-center justify-between">
                        <span>✂️ Bộ Nén Ngữ Cảnh & Tiết Kiệm Token CLI</span>
                        <Badge tone="green">Đang bật</Badge>
                      </div>
                      <p className="text-[11px] text-muted">
                        Tự động chấm điểm và chỉ giữ lại các đoạn RAG + mục `SKILL.md` sát nhất với câu hỏi trước khi gọi `Claude CLI`, `Gemini CLI`, `OpenAI Codex CLI`.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="rounded-xl border border-line bg-card p-2 text-center">
                          <div className="text-[10px] text-muted">Số lượt đã tối ưu</div>
                          <div className="text-sm font-bold text-ink">
                            {(coworkerData?.contextOptimizer?.totalRunsOptimized ?? 0).toLocaleString("vi-VN")} lượt
                          </div>
                        </div>
                        <div className="rounded-xl border border-line bg-card p-2 text-center">
                          <div className="text-[10px] text-muted">Token CLI tiết kiệm</div>
                          <div className="text-sm font-bold text-emerald-600">
                            +{(coworkerData?.contextOptimizer?.totalTokensSaved ?? 0).toLocaleString("vi-VN")}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-bold text-ink">Chọn mức độ nén ngữ cảnh:</div>
                      {(
                        [
                          {
                            id: "aggressive",
                            title: "⚡ Nén Tối Đa (Tiết kiệm ~65% Quota CLI)",
                            desc: "Giữ 3 đoạn RAG sát nhất + 3.200 ký tự trọng tâm của Skill. Phản hồi cực nhanh.",
                          },
                          {
                            id: "balanced",
                            title: "⚖️ Cân Bằng Thông Minh (Khuyên dùng)",
                            desc: "Giữ 5 đoạn RAG sát nhất + 6.500 ký tự Skill Playbook. Đủ sâu và tiết kiệm ~45% Token.",
                          },
                          {
                            id: "full",
                            title: "📚 Đầy Đủ Toàn Bộ (Full Context)",
                            desc: "Nạp tối đa 10 đoạn RAG + 14.000 ký tự Skill cho các bài toán phân tích/dịch ngược phức tạp.",
                          },
                        ] as const
                      ).map((m) => {
                        const isCur = (coworkerData?.contextOptimizer?.mode ?? "balanced") === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => void handleSaveOptimizerMode(m.id)}
                            className={cx(
                              "w-full rounded-xl border p-2.5 text-left transition",
                              isCur
                                ? "border-emerald-500 bg-emerald-500/10"
                                : "border-line bg-card hover:bg-soft",
                            )}
                          >
                            <div className="flex items-center justify-between font-bold text-ink">
                              <span>{m.title}</span>
                              {isCur && <Badge tone="green">Đang chọn</Badge>}
                            </div>
                            <p className="mt-0.5 text-[10.5px] text-muted">{m.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 4: Core 2 & Core 4B — Auto-Watch Inbox Folder, Event Triggers & OpenAI-Compatible Local API */}
                {coreHubTab === "automation_api" && (
                  <div className="space-y-3">
                    {/* Auto-Watch Folder */}
                    <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink">📂 Thư mục Tự động Học (Auto-Watch)</span>
                        <button
                          type="button"
                          onClick={() => void handleScanInboxAuto()}
                          disabled={scanningInbox}
                          className="rounded-lg bg-blue-600 px-2 py-0.5 text-[10.5px] font-bold text-white hover:bg-blue-700"
                        >
                          {scanningInbox ? "Đang quét..." : "🔄 Quét ngay"}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted">
                        Cứ chép bất kỳ file Bảng giá (`.docx`, `.txt`, `.csv`, `.md`) vào thư mục dưới đây trên máy Mac là ZONO tự động đọc nạp vào RAG:
                      </p>
                      <div className="flex items-center justify-between gap-1 rounded-lg border border-line bg-card px-2 py-1.5 font-mono text-[10px] text-ink">
                        <span className="truncate">{coworkerData?.automation?.inboxAutoDir ?? "data/inbox-auto"}</span>
                        <button
                          type="button"
                          onClick={() => void handleCopyText(coworkerData?.automation?.inboxAutoDir ?? "data/inbox-auto")}
                          className="shrink-0 text-blue-600 font-sans font-bold hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {/* Event Triggers */}
                    <div className="space-y-1.5">
                      <div className="font-bold text-ink">⚡ Quy tắc Tự động hóa theo Sự kiện (Event Triggers):</div>
                      {(coworkerData?.automation?.triggers ?? []).map((trg: any) => (
                        <div key={trg.id} className="rounded-xl border border-line bg-card p-2.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-ink">{trg.name}</span>
                            <button
                              type="button"
                              onClick={() => void handleToggleTrigger(trg)}
                              className={cx(
                                "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                                trg.enabled ? "bg-emerald-600 text-white" : "bg-line text-muted",
                              )}
                            >
                              {trg.enabled ? "ĐANG BẬT" : "ĐÃ TẮT"}
                            </button>
                          </div>
                          <p className="text-[10.5px] text-muted">{trg.description}</p>
                        </div>
                      ))}
                    </div>

                    {/* OpenAI-Compatible Local Agent API */}
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-3 space-y-1.5">
                      <div className="font-bold text-ink flex items-center justify-between">
                        <span>🔌 Cổng OpenAI-Compatible Local API</span>
                        <Badge tone="violet">Sẵn sàng</Badge>
                      </div>
                      <p className="text-[10.5px] text-muted">
                        Cắm trực tiếp vào n8n, Make, Cursor, Raycast hoặc Zalo Mini App theo chuẩn OpenAI SDK:
                      </p>
                      <div className="rounded-lg border border-line bg-card p-2 font-mono text-[10px] text-ink space-y-1">
                        <div className="flex justify-between">
                          <span className="truncate">POST http://localhost:8787/v1/chat/completions</span>
                          <button
                            type="button"
                            onClick={() => void handleCopyText("http://localhost:8787/v1/chat/completions")}
                            className="text-violet-600 font-sans font-bold hover:underline"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="text-muted">
                          Model: <b>zono-local-auto</b> | <b>zono-skill:reverse-engineer-anything</b>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Hộp thoại Cài đặt Nhanh Thông tin Cửa hàng & Bảng giá (Dành cho người không biết công nghệ) */}
      <Modal
        open={shopModalOpen}
        onClose={() => setShopModalOpen(false)}
        title="🏪 Cài đặt Thông tin Cửa hàng & Bảng giá sản phẩm (Dạy AI trong 30 giây)"
        footer={
          <>
            <Button onClick={() => setShopModalOpen(false)}>Đóng</Button>
            <Button variant="primary" loading={savingShop} onClick={() => void handleSaveShopInfo()}>
              💾 Lưu cho AI nhớ ngay
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3 text-xs text-muted">
            💡 <b>Mẹo nhỏ:</b> Anh/chị chỉ cần ghi ngắn gọn như đang nhắn tin cho nhân viên mới. AI sẽ tự động dùng đúng bảng giá và chính sách này khi <b>viết bài đăng</b>, <b>làm video</b> và <b>trả lời khách trên Zalo</b>.
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink">
              1. Tên Cửa hàng hoặc Thương hiệu của anh/chị
            </label>
            <input
              className={inputCls}
              value={shopForm.brandName}
              onChange={(e) => setShopForm({ ...shopForm, brandName: e.target.value })}
              placeholder="VD: Mỹ phẩm DermaGlow / Kho Gia Dụng Minh Anh..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink">
              2. Ngành hàng kinh doanh
            </label>
            <input
              className={inputCls}
              value={shopForm.industry}
              onChange={(e) => setShopForm({ ...shopForm, industry: e.target.value })}
              placeholder="VD: Mỹ phẩm, Thời trang, Bất động sản, Đào tạo..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink">
              3. Danh sách Sản phẩm & Giá bán (Dán hoặc gõ bình thường)
            </label>
            <textarea
              rows={3}
              className={inputCls}
              value={shopForm.productsSummary}
              onChange={(e) => setShopForm({ ...shopForm, productsSummary: e.target.value })}
              placeholder="VD: Serum B5 giá 389k, Kem chống nắng 420k (Mua 2 tặng 1 mặt nạ)..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink">
              4. Cách xưng hô với khách & Chính sách giao hàng / bảo hành
            </label>
            <textarea
              rows={4}
              className={inputCls}
              value={shopForm.ragKnowledgeText}
              onChange={(e) => setShopForm({ ...shopForm, ragKnowledgeText: e.target.value })}
              placeholder="VD: Xưng 'em', gọi khách là 'anh/chị'. Miễn phí giao hàng đơn từ 350k. Đổi trả trong 7 ngày. Luôn xin SĐT + Địa chỉ để lên đơn..."
            />
          </div>
        </div>
      </Modal>

      {/* Modal Đăng nhập Đa Tài khoản Zalo & Bật/Tắt AI theo từng Khách hàng */}
      <Modal
        open={zaloModalOpen}
        onClose={() => setZaloModalOpen(false)}
        title="📱 Quản lý Zalo bán hàng & Tắt AI với người quen"
        wide
      >
        <div className="space-y-4">
          {/* Thanh chuyển Tab trong Modal — Chia 2 cột cân đối, không bao giờ tràn khung */}
          <div className="grid grid-cols-1 gap-2 rounded-2xl bg-soft p-1.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setModalTab("accounts")}
              className={cx(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold transition",
                modalTab === "accounts"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-ink/80 hover:bg-card hover:text-ink",
              )}
            >
              <span>📱 1. Kết nối Zalo ({zaloAccounts.length} nick)</span>
            </button>
            <button
              type="button"
              onClick={() => setModalTab("customers")}
              className={cx(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold transition",
                modalTab === "customers"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-ink/80 hover:bg-card hover:text-ink",
              )}
            >
              <span>👤 2. Tắt AI với người quen ({customerRules.length} người)</span>
            </button>
          </div>

          {modalTab === "accounts" ? (
            <div className="space-y-4">
              {/* Khung Quét Mã QR Đăng Nhập Zalo Trực Tiếp — Hiện lên ngay lập tức, không cần gõ SĐT */}
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-blue-500/30 bg-blue-500/5 p-5 text-center space-y-3">
                <div className="text-sm font-bold text-ink">
                  📱 Mở ứng dụng Zalo trên điện thoại → Quét mã QR để đăng nhập thêm tài khoản
                </div>
                <p className="text-xs text-muted max-w-lg">
                  Sau khi quét QR, hệ thống tự động nhận Tên Zalo, Số điện thoại và lưu phiên chạy ngầm (không cần nhập số điện thoại hay gõ thông tin).
                </p>

                {zcaQrSession?.qrCodeImage ? (
                  <div className="space-y-2">
                    <img
                      src={zcaQrSession.qrCodeImage}
                      alt="Mã QR Đăng nhập Zalo"
                      className="mx-auto h-52 w-52 rounded-2xl border border-line bg-white p-2 shadow-sm object-contain"
                    />
                    <div className="text-xs font-bold text-blue-600">
                      {zcaQrSession.status === "scanned"
                        ? `📲 Đã quét (${zcaQrSession.scannedName ?? "Zalo"}) — Hãy bấm "Đăng nhập" trên điện thoại!`
                        : zcaQrSession.status === "connected"
                        ? "✅ Đã đăng nhập thành công!"
                        : "Đang chờ quét mã QR..."}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-52 w-52 flex-col items-center justify-center rounded-2xl border border-line bg-card p-4 text-xs text-muted">
                    <QrCode className="mb-2 h-10 w-10 animate-pulse text-blue-600" />
                    <span>{generatingQr ? "Đang tải mã QR từ Zalo..." : "Bấm nút dưới để lấy mã QR"}</span>
                  </div>
                )}

                <Button size="sm" variant="secondary" onClick={() => void handleStartZcaQr()} disabled={generatingQr}>
                  <QrCode className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                  {generatingQr ? "Đang tạo QR..." : "Lấy mã QR mới (Đăng nhập thêm nick khác)"}
                </Button>
              </div>

              {/* Danh sách các nick Zalo đã đăng nhập */}
              <div className="grid gap-3 sm:grid-cols-2">
                {zaloAccounts.map((acc) => (
                  <div key={acc.id} className="rounded-2xl border border-line bg-card p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-ink">{acc.name}</span>
                          <Badge tone={acc.status === "connected" ? "green" : "amber"}>
                            {acc.status === "connected" ? "Đang trực" : "Chờ quét QR"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted mt-0.5">
                          SĐT Zalo: <b className="text-ink">{acc.phone}</b> · Phụ trách: <b>{acc.assignedUserName}</b>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteZalo(acc)}
                        className="rounded-lg p-1 text-muted hover:bg-soft hover:text-rose-600"
                        title="Xoá tài khoản Zalo này"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 2 Nút Bật / Tắt Trả lời AI: (1) Nhắn riêng 1-1 & (2) Trong Nhóm khi được @tag */}
                    <div className="space-y-1.5 rounded-xl border border-line bg-soft/60 p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink">💬 Khách nhắn tin riêng (1-1):</span>
                        <button
                          type="button"
                          onClick={() => void handleToggleAccountAi(acc)}
                          className={cx(
                            "rounded-lg px-2.5 py-1 text-xs font-bold transition",
                            acc.autoReplyEnabled
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "bg-rose-600 text-white hover:bg-rose-700",
                          )}
                        >
                          {acc.autoReplyEnabled ? "🤖 BẬT AI" : "⏸️ TẮT (Chat tay)"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-1.5">
                        <span className="font-medium text-ink">👥 Trong Nhóm khi có người @tag:</span>
                        <button
                          type="button"
                          onClick={() => void handleToggleGroupMentionAi(acc)}
                          className={cx(
                            "rounded-lg px-2.5 py-1 text-xs font-bold transition",
                            (acc.groupMentionReplyEnabled ?? true)
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "bg-slate-500 text-white hover:bg-slate-600",
                          )}
                        >
                          {(acc.groupMentionReplyEnabled ?? true) ? "🏷️ BẬT @TAG" : "⏸️ TẮT NHÓM"}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-line pt-2 text-xs">
                      <span className="text-muted">
                        Hôm nay: <b>{acc.todayMessages}</b> tin · <b>{acc.todayOrders}</b> đơn
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => void handleStartZcaQr()}>
                        <QrCode className="mr-1 h-3.5 w-3.5 text-blue-600" /> Quét lại QR
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Tab 2: Bật / Tắt AI trả lời với từng Khách hàng cụ thể */
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-ink space-y-1">
                <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <UserX className="h-4 w-4" /> Tắt trả lời AI tự động với một số Khách hàng cụ thể (Chuyển sang tự chat tay):
                </div>
                <p className="text-muted">
                  Khi một khách hàng (theo Tên Zalo hoặc Số điện thoại) được đặt ở trạng thái <b>AI: TẮT</b>, bot sẽ không tự động trả lời khi người đó nhắn tin vào Zalo cá nhân của anh — giúp anh thoải mái trò chuyện riêng với bạn bè, đối tác hoặc khách VIP.
                </p>
              </div>

              {/* Form thêm nhanh khách hàng cần Tắt / Bật AI — Chia 2x2 rộng rãi, không bị cắt chữ */}
              <div className="rounded-2xl border border-line bg-soft/50 p-4 space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                  ➕ Thêm người quen / khách cần Tắt (hoặc Bật) trả lời AI riêng
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">1. Tên Zalo của người này</label>
                    <input
                      className={inputCls}
                      value={newCustRule.customerName}
                      onChange={(e) => setNewCustRule({ ...newCustRule, customerName: e.target.value })}
                      placeholder="VD: Anh Tuấn Đại Lý"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">2. Số điện thoại (Nếu có)</label>
                    <input
                      className={inputCls}
                      value={newCustRule.customerPhone}
                      onChange={(e) => setNewCustRule({ ...newCustRule, customerPhone: e.target.value })}
                      placeholder="0909111222"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">3. Áp dụng trên Nick Zalo</label>
                    <select
                      className={inputCls}
                      value={newCustRule.zaloAccountId}
                      onChange={(e) => setNewCustRule({ ...newCustRule, zaloAccountId: e.target.value })}
                    >
                      <option value="all">Tất cả tài khoản Zalo của mình</option>
                      {zaloAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-ink">4. Chế độ AI với người này</label>
                    <select
                      className={inputCls}
                      value={newCustRule.aiEnabled ? "on" : "off"}
                      onChange={(e) => setNewCustRule({ ...newCustRule, aiEnabled: e.target.value === "on" })}
                    >
                      <option value="off">⏸️ TẮT AI (Để mình tự nhắn riêng)</option>
                      <option value="on">🤖 BẬT AI trả lời tự động</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button variant="primary" onClick={() => void handleAddCustomerRule()} disabled={savingCustRule}>
                    <Plus className="mr-1.5 h-4 w-4" /> Lưu cài đặt
                  </Button>
                </div>
              </div>

              {/* Danh sách khách hàng đang cấu hình */}
              <div className="space-y-2">
                {customerRules.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">{r.customerName}</span>
                        {r.customerPhone && <Badge tone="gray">📱 {r.customerPhone}</Badge>}
                        <Badge tone={r.aiEnabled ? "green" : "red"}>
                          {r.aiEnabled ? "🤖 AI Tự trả lời: BẬT" : "⏸️ Đã TẮT AI (Tự chat tay)"}
                        </Badge>
                      </div>
                      <p className="text-muted">{r.note}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={r.aiEnabled ? "secondary" : "primary"}
                        onClick={() => void handleToggleCustomerRule(r)}
                      >
                        {r.aiEnabled ? (
                          <>
                            <UserX className="mr-1 h-3.5 w-3.5" /> Tắt AI khách này
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-1 h-3.5 w-3.5" /> Bật lại AI
                          </>
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCustomerRule(r)}
                        className="rounded-lg p-1.5 text-muted hover:bg-soft hover:text-rose-600"
                        title="Xoá khỏi danh sách"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
