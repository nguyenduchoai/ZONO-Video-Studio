import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Radio, Telescope, HeartHandshake, PlaneTakeoff,
  Bell, BookOpen, BrainCircuit, Clapperboard, FileClock, FileText, Home, Library, Link2, Bot, CalendarDays, ChartLine, CheckCircle2,
  Menu, MessageCircle, MessagesSquare, MonitorCog, Moon, Network, Octagon, PanelLeftClose, PanelLeftOpen, Route, Send, Settings, SlidersHorizontal, Sparkles, Sun, Target, Users, X,
} from "lucide-react";
import { api, useApi, useEvents } from "../lib/api";
import { timeAgo } from "../lib/format";
import { Button, Chevron, Collapse, Modal, cx, useOpen, useToast } from "./ui";
import { AccountMenu, PROFILE_EVENT } from "./Account";
import { BusinessSwitcher } from "./BusinessSwitcher";
import { CloudHeaderButton } from "./CloudRemotePanel";
import { MuseBasicWorkspace } from "./MuseBasicWorkspace";

type NavItem = { to: string; label: string; icon: any; badge?: "unread" | "approvals"; special?: boolean; children?: { to: string; label: string; icon: any }[] };

/** Menu Quản trị Tinh gọn: Rõ ràng, có Studio Phim AI (MoonReel × FrameWeaver × 26Flow) nổi bật */
const CORE_NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Quản lý Cửa hàng",
    items: [
      { to: "/", label: "Bảng điều khiển", icon: Home },
      { to: "/studio", label: "Studio Phim AI (Mới)", icon: Sparkles, special: true },
      { to: "/users-quota", label: "Cửa hàng & Bảng giá", icon: Users },
      { to: "/zalo", label: "Zalo & Khách hàng", icon: MessagesSquare, badge: "unread" },
      { to: "/content", label: "Bài viết bán hàng", icon: FileText },
      { to: "/video-flow", label: "Xưởng làm Video", icon: Clapperboard },
      { to: "/skills", label: "Kho Kỹ Năng AI", icon: BookOpen },
      { to: "/settings", label: "Cài đặt hệ thống", icon: Settings },
    ],
  },
];

const EXTRA_NAV: { title: string; items: NavItem[] }[] = [];
/** Bottom bar on phones: the four things checked most often + "Menu" for everything else. */
const TABBAR: { to: string; label: string; icon: any; badge?: "unread" | "approvals" }[] = [
  { to: "/", label: "Tổng quan", icon: Home },
  { to: "/studio", label: "Studio AI", icon: Sparkles },
  { to: "/content", label: "Nội dung", icon: FileText },
  { to: "/zalo", label: "Zalo", icon: MessagesSquare, badge: "unread" },
];

const railStore = {
  get: (): boolean => { try { const v = localStorage.getItem("ui.sidebar"); return v ? v === "rail" : window.innerWidth < 1280; } catch { return false; } },
  set: (rail: boolean) => { try { localStorage.setItem("ui.sidebar", rail ? "rail" : "full"); } catch { /* storage unavailable */ } },
};

export function Layout({ children }: { children: ReactNode }) {
  const { data: sys, reload } = useApi<any>("system", ["approval.", "conversation.", "lead.", "alert.", "llm."]);
  useEffect(() => {
    const r = () => void reload();
    window.addEventListener(PROFILE_EVENT, r);
    return () => window.removeEventListener(PROFILE_EVENT, r);
  }, [reload]);
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(railStore.get);
  const nav = useNavigate();
  // Default to "basic" (Muse single-chat workspace) unless the user switched to "advanced"
  const [workspaceMode, setWorkspaceMode] = useState<"basic" | "advanced">(() => {
    try { return (localStorage.getItem("ui.workspaceMode") as "basic" | "advanced") || "basic"; } catch { return "basic"; }
  });
  const switchWorkspaceMode = (mode: "basic" | "advanced", targetPath?: string) => {
    setWorkspaceMode(mode);
    try { localStorage.setItem("ui.workspaceMode", mode); } catch { /* ignore */ }
    if (targetPath) nav(targetPath);
  };
  const [showExtraNav, setShowExtraNav] = useState(() => {
    try { return localStorage.getItem("ui.showExtraNav") === "1"; } catch { return false; }
  });
  const toggleExtraNav = () => setShowExtraNav((v) => {
    const next = !v;
    try { localStorage.setItem("ui.showExtraNav", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });
  const activeNav = showExtraNav ? [...CORE_NAV, ...EXTRA_NAV] : CORE_NAV;
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("theme") === "dark"; } catch { return false; }
  });
  const [notes, setNotes] = useState<{ text: string; at: string; level?: string }[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  const [killOpen, setKillOpen] = useState(false);
  const toast = useToast();
  const loc = useLocation();
  // "Mở như app": install as a desktop app (Chrome/Edge PWA install prompt)
  const [installEvt, setInstallEvt] = useState<any>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  const standalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
  useEffect(() => {
    setOpen(false);
    setShowNotes(false);
  }, [loc.pathname]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch { /* storage unavailable */ }
  }, [dark]);
  useEffect(() => {
    if (!open && !showNotes) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setShowNotes(false); } };
    const away = (e: MouseEvent) => { if (showNotes && notesRef.current && !notesRef.current.contains(e.target as Node)) setShowNotes(false); };
    window.addEventListener("keydown", esc);
    window.addEventListener("mousedown", away);
    return () => { window.removeEventListener("keydown", esc); window.removeEventListener("mousedown", away); };
  }, [open, showNotes]);

  useEvents((e) => {
    const map: Record<string, (p: any) => string | null> = {
      "approval.created": (p) => `Cần duyệt: ${p.title ?? "mục mới"}`,
      "conversation.handoff": (p) => `Chuyển người: ${(p.reasons ?? []).join(", ")}`,
      "post.published": (p) => (p.simulated ? `Mô phỏng (CHƯA đăng thật lên ${p.channel ?? "kênh"}): ${p.title}` : `Đã đăng: ${p.title}`),
      "action.executed": (p) => `Đã thực hiện ${p.type} · ${p.target ?? ""}`,
      "alert.raised": (p) => p.text,
      "proposal.created": (p) => `Đề xuất học: ${p.title}`,
    };
    const f = map[e.type];
    const text = f?.(e.payload);
    if (text) setNotes((n) => [{ text, at: new Date().toISOString(), level: e.payload.level }, ...n].slice(0, 30));
  });

  const killed = sys?.killSwitch && Object.values(sys.killSwitch).some(Boolean);
  const setKill = async (area: string, on: boolean) => {
    await api.post("kill-switch", { area, on });
    toast(on ? `Đã DỪNG khẩn cấp: ${area}` : `Đã mở lại: ${area}`, on ? "err" : "ok");
    reload();
  };
  const toggleRail = () => setRail((r) => { railStore.set(!r); return !r; });

  /** `compact` = icon-only rail (tablet); the drawer on phones always uses the full layout. */
  const sidebar = (compact: boolean) => (
    <nav aria-label="Điều hướng chính" className={cx("min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3 scroll-thin space-y-1.5", compact ? "px-2" : "px-3")}>
      {CORE_NAV[0].items.map((n) => {
        const count = n.badge ? sys?.counts?.[n.badge] : 0;
        return (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            title={compact ? n.label : undefined}
            aria-label={compact ? n.label : undefined}
            className={({ isActive }) =>
              cx(
                "group relative flex min-h-11 items-center rounded-2xl text-sm font-bold transition-colors",
                compact ? "justify-center px-0" : "gap-3 px-3.5",
                isActive
                  ? n.special
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm"
                    : "bg-blue-600 text-white shadow-xs"
                  : n.special
                    ? "border border-violet-500/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
                    : "text-ink/85 hover:bg-soft hover:text-ink",
              )
            }
          >
            <n.icon className="h-5 w-5 shrink-0" aria-hidden />
            {!compact && <span className="min-w-0 flex-1 truncate">{n.label}</span>}
            {count ? (
              compact ? (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-card" />
              ) : (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">
                  {count}
                </span>
              )
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );

  const status = (compact: boolean) => (
    <div className={cx("shrink-0 border-t border-line p-3", compact && "flex justify-center")}>
      <button
        type="button"
        onClick={() => switchWorkspaceMode("basic")}
        className={cx(
          "flex items-center justify-center gap-2 rounded-2xl bg-blue-500/10 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition",
          compact ? "h-10 w-10" : "w-full px-3 py-2.5",
        )}
        title="Quay về Giao diện Chat Đơn giản"
      >
        <Sparkles className="h-4 w-4 shrink-0" />
        {!compact && <span>Quay về Giao diện Đơn giản</span>}
      </button>
    </div>
  );
  const pendingTotal = (sys?.counts?.approvals ?? 0) + (sys?.counts?.unread ?? 0);

  const showAdvanced = workspaceMode === "advanced" || loc.pathname !== "/";

  return (
    <div className="flex h-full">
      <a href="#main" className="sr-only z-[100] rounded-lg bg-card px-3 py-2 text-sm font-medium text-ink shadow-pop focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Bỏ qua điều hướng</a>
      {/* Tablet / desktop: show full orchestration sidebar in "advanced" mode or on any deep route */}
      {showAdvanced && (
        <aside className={cx("hidden shrink-0 flex-col border-r border-line bg-card transition-[width] duration-200 md:flex", rail ? "w-[68px]" : "w-60")}>
          <Brand compact={rail} />
          {sidebar(rail)}
          {status(rail)}
        </aside>
      )}
      {/* Phones: slide-in drawer */}
      {open && showAdvanced && (
        <div className="fixed inset-0 z-[60] bg-slate-950/50 animate-fade-in md:hidden" onClick={() => setOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label="Menu" className="flex h-full w-[min(20rem,86vw)] flex-col bg-card shadow-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pr-2"><Brand /><button onClick={() => setOpen(false)} aria-label="Đóng menu" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-soft"><X className="h-5 w-5" /></button></div>
            {sidebar(false)}
            {status(false)}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card/90 px-4 backdrop-blur-md md:px-6">
          {showAdvanced ? (
            <>
              <button className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink md:hidden" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu className="h-5 w-5" /></button>
              <button className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink md:grid" onClick={toggleRail} aria-label={rail ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} title={rail ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}>{rail ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}</button>
            </>
          ) : (
            <div className="flex items-center gap-2.5 pr-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold tracking-tight text-ink">ZONO</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    🟢 Trợ lý Bán hàng
                  </span>
                </div>
                <p className="hidden text-xs text-muted sm:block">Nhắn việc như nhắn Zalo · Tự viết bài, làm video & báo giá khách</p>
              </div>
            </div>
          )}

          {/* Nút chuyển đổi Giao diện Đơn giản <-> Studio Phim AI <-> Quản trị Chuyên sâu */}
          <div className="flex items-center rounded-2xl border border-line bg-soft p-1 text-xs">
            <button
              type="button"
              onClick={() => switchWorkspaceMode("basic", "/")}
              className={cx(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition",
                !showAdvanced
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-muted hover:text-ink",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Giao diện Đơn giản</span>
            </button>
            <button
              type="button"
              onClick={() => switchWorkspaceMode("advanced", "/studio")}
              className={cx(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition",
                showAdvanced && loc.pathname.startsWith("/studio")
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs"
                  : "text-violet-700 hover:bg-violet-500/10 dark:text-violet-300",
              )}
            >
              <Clapperboard className="h-3.5 w-3.5" />
              <span>🎬 Studio Phim AI</span>
            </button>
            <button
              type="button"
              onClick={() => switchWorkspaceMode("advanced", loc.pathname.startsWith("/studio") ? "/" : undefined)}
              className={cx(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition",
                showAdvanced && !loc.pathname.startsWith("/studio")
                  ? "bg-violet-600 text-white shadow-xs"
                  : "text-muted hover:text-ink",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Quản trị Chuyên sâu</span>
            </button>
          </div>
          <div className="flex-1" />
          <button onClick={() => setDark(!dark)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-soft hover:text-ink" aria-label="Đổi giao diện sáng/tối" title="Đổi chế độ Sáng / Tối">{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
          <div className="relative" ref={notesRef}>
            <button onClick={() => setShowNotes(!showNotes)} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-soft hover:text-ink" aria-label="Thông báo" aria-expanded={showNotes} title="Thông báo">
              <Bell className="h-5 w-5" />
              {notes.length > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">{notes.length}</span>}
            </button>
            {showNotes && (
              <div className="absolute right-[-3.5rem] top-12 z-30 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-card p-2 shadow-pop animate-pop-in sm:right-0">
                <p className="px-2 py-1.5 text-sm font-semibold">Thông báo mới</p>
                {notes.length === 0 ? <p className="px-2 py-3 text-sm text-muted">Chưa có thông báo mới.</p> : (
                  <div className="max-h-[60vh] overflow-y-auto scroll-thin">
                    {notes.map((n, i) => (
                      <div key={i} className="rounded-lg px-2 py-2 text-sm hover:bg-soft"><p className={cx("break-words", n.level === "urgent" && "text-danger-ink")}>{n.text}</p><p className="text-xs text-muted">{timeAgo(n.at)}</p></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <AccountMenu profile={sys?.profile} canLogout={false} onLogout={() => {}} />
        </header>
        {!showAdvanced ? (
          <main id="main" tabIndex={-1} className="flex-1 overflow-hidden outline-none">
            <MuseBasicWorkspace onEnterAdvanced={(targetPath) => switchWorkspaceMode("advanced", targetPath)} />
          </main>
        ) : (
          <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto scroll-thin outline-none">
            {/* One consistent page frame: max width, gutters, bottom room for the assistant chip + phone tab bar. */}
            <div className="mx-auto w-full max-w-[1600px] px-4 pb-[calc(var(--bottom-nav-h)+6rem)] pt-5 sm:px-6 md:pb-24 md:pt-6 lg:px-8">
              {children}
            </div>
          </main>
        )}
      </div>

      {/* Phones: bottom tab bar (thumb reach) */}
      <nav aria-label="Điều hướng nhanh" className="pb-safe fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-line bg-card/95 backdrop-blur md:hidden">
        {TABBAR.map((t) => {
          const c = t.badge ? sys?.counts?.[t.badge] : 0;
          return (
            <NavLink key={t.to} to={t.to} end={t.to === "/"} className={({ isActive }) => cx("relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors", isActive ? "text-blue-700 dark:text-blue-300" : "text-muted")}>
              <span className="relative"><t.icon className="h-5 w-5" aria-hidden />{c ? <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">{c}</span> : null}</span>
              <span className="max-w-full truncate px-1">{t.label}</span>
            </NavLink>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted" aria-label="Mở toàn bộ menu">
          <Menu className="h-5 w-5" aria-hidden /><span>Menu</span>
          {pendingTotal > 0 && <span className="sr-only">{pendingTotal} mục cần xử lý</span>}
        </button>
      </nav>

      <Modal open={killOpen} onClose={() => setKillOpen(false)} title="Nút dừng khẩn cấp (kill switch)" description="Dừng ngay mọi tác động ra ngoài của nhóm tương ứng. Việc đang xếp hàng sẽ bị chặn; Sếp mở lại bất cứ lúc nào.">
        <div className="space-y-2">
          {[["publish", "Đăng bài"], ["chat", "Chat bot (chuyển hết sang người)"], ["all", "Toàn hệ thống"]].map(([k, l]) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
              <span className="min-w-0 text-sm font-medium">{l}</span>
              <Button size="sm" variant={sys?.killSwitch?.[k] ? "success" : "danger"} onClick={() => setKill(k, !sys?.killSwitch?.[k])}>{sys?.killSwitch?.[k] ? "Mở lại" : "Dừng"}</Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

/** Sidebar section that folds away; the section holding the current page always stays open. */
function NavGroup({ title, active, alert, children }: { title: string; active: boolean; alert: number; children: ReactNode }) {
  const [open, toggle] = useOpen(false, `nav.${title}`);
  const shown = open || active;
  return (
    <div className="py-0.5">
      <button type="button" onClick={() => toggle(!shown)} aria-expanded={shown} className={cx("flex min-h-9 w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider hover:bg-soft hover:text-ink", shown ? "text-ink" : "text-muted")}>
        <span className="flex-1">{title}</span>
        {!shown && alert > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold normal-case tracking-normal text-white">{alert}</span>}
        <Chevron open={shown} className="h-3.5 w-3.5" />
      </button>
      <Collapse open={shown}><div className="space-y-0.5">{children}</div></Collapse>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className={cx("flex h-14 shrink-0 items-center gap-2.5 border-b border-line/60", compact ? "justify-center" : "px-4")}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-white shadow-sm ring-1 ring-white/20">
        <Sparkles className="h-[18px] w-[18px]" aria-hidden />
      </span>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-extrabold tracking-tight text-ink">ZONO</span>
            <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Agentic AI</span>
          </div>
          <p className="truncate text-[11px] text-muted">Marketing & Sales OS</p>
        </div>
      )}
    </div>
  );
}
function ModeRow({ label, on, offText, onText = "LIVE", compact }: { label: string; on?: boolean; offText: string; onText?: string; compact?: boolean }) {
  if (compact) return <span title={`${label}: ${on ? onText : offText}`} className={cx("h-2.5 w-2.5 rounded-full", on ? "bg-ok" : "bg-warn")} />;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate">{label}</span>
      <span className={cx("inline-flex shrink-0 items-center gap-1.5 font-medium", on ? "text-ok-ink" : "text-warn-ink")}><span className={cx("h-1.5 w-1.5 rounded-full", on ? "bg-ok" : "bg-warn")} />{on ? onText : offText}</span>
    </div>
  );
}
