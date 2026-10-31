import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Clapperboard,
  Film,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Sun,
  Target,
  X,
} from "lucide-react";
import { useApi } from "../lib/api";
import { cx } from "./ui";
import { AccountMenu, PROFILE_EVENT } from "./Account";
import { BusinessSwitcher } from "./BusinessSwitcher";

type NavItem = { to: string; label: string; subtitle: string; icon: any; special?: boolean };

/** Menu Độc Lập 100% Tập Trung Làm Video: Studio Decode Phim AI + Xưởng Làm Video + DNA Sản Phẩm + CLI AI */
const VIDEO_NAV: NavItem[] = [
  {
    to: "/",
    label: "Studio Phim AI (Decode)",
    subtitle: "Giải mã video mẫu & Chat đạo diễn",
    icon: Sparkles,
    special: true,
  },
  {
    to: "/video-flow",
    label: "Xưởng Làm Video",
    subtitle: "Dựng clip thô, lồng tiếng & phụ đề",
    icon: Clapperboard,
  },
  {
    to: "/dna",
    label: "DNA Sản Phẩm & Brand",
    subtitle: "Thông tin sản phẩm cho kịch bản",
    icon: Target,
  },
  {
    to: "/settings",
    label: "Cấu Hình CLI AI",
    subtitle: "Claude CLI · Gemini CLI · Codex CLI",
    icon: Settings,
  },
];

const railStore = {
  get: (): boolean => {
    try {
      const v = localStorage.getItem("ui.video_sidebar");
      return v ? v === "rail" : window.innerWidth < 1280;
    } catch {
      return false;
    }
  },
  set: (rail: boolean) => {
    try {
      localStorage.setItem("ui.video_sidebar", rail ? "rail" : "full");
    } catch {
      /* ignore */
    }
  },
};

export function Layout({ children }: { children: ReactNode }) {
  const { data: sys, reload } = useApi<any>("system", ["llm."]);
  useEffect(() => {
    const r = () => void reload();
    window.addEventListener(PROFILE_EVENT, r);
    return () => window.removeEventListener(PROFILE_EVENT, r);
  }, [reload]);

  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(railStore.get);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });
  const loc = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [dark]);

  const toggleRail = () =>
    setRail((r) => {
      railStore.set(!r);
      return !r;
    });

  const renderNavItem = (n: NavItem, compact: boolean) => {
    const isStudioRoot = n.to === "/" && (loc.pathname === "/" || loc.pathname.startsWith("/studio"));
    return (
      <NavLink
        key={n.to}
        to={n.to}
        end={n.to === "/"}
        title={compact ? `${n.label} — ${n.subtitle}` : undefined}
        className={({ isActive }) => {
          const active = isActive || isStudioRoot;
          return cx(
            "group relative flex min-h-12 items-center rounded-2xl text-sm font-bold transition-colors",
            compact ? "justify-center px-0" : "gap-3 px-3.5 py-2",
            active
              ? n.special
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm"
                : "bg-indigo-600 text-white shadow-xs"
              : n.special
                ? "border border-violet-500/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
                : "text-ink/85 hover:bg-soft hover:text-ink",
          );
        }}
      >
        <n.icon className="h-5 w-5 shrink-0" aria-hidden />
        {!compact && (
          <div className="min-w-0 flex-1">
            <div className="truncate font-extrabold leading-tight">{n.label}</div>
            <div className="truncate text-[11px] font-medium opacity-75">{n.subtitle}</div>
          </div>
        )}
      </NavLink>
    );
  };

  return (
    <div className="flex h-full">
      {/* Sidebar Desktop */}
      <aside
        className={cx(
          "hidden shrink-0 flex-col border-r border-line bg-card transition-[width] duration-200 md:flex",
          rail ? "w-[68px]" : "w-64",
        )}
      >
        <Brand compact={rail} />
        <nav aria-label="Điều hướng Video Studio" className={cx("flex-1 space-y-2 py-4", rail ? "px-2" : "px-3")}>
          {VIDEO_NAV.map((n) => renderNavItem(n, rail))}
        </nav>
        {!rail && (
          <div className="border-t border-line p-3.5 text-[11px] text-muted space-y-1">
            <div className="font-extrabold text-ink">⚡ 100% Local Video Engine</div>
            <div>FFmpeg · Faster-Whisper · VieNeu-TTS · Claude/Gemini/Codex CLI</div>
          </div>
        )}
      </aside>

      {/* Mobile Drawer */}
      {open && (
        <div className="fixed inset-0 z-[60] bg-slate-950/50 animate-fade-in md:hidden" onClick={() => setOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu Video Studio"
            className="flex h-full w-[min(20rem,86vw)] flex-col bg-card shadow-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pr-2">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Đóng menu"
                className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-soft"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-2 px-3 py-4">
              {VIDEO_NAV.map((n) => renderNavItem(n, false))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card/90 px-4 backdrop-blur-md md:px-6">
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink md:grid"
            onClick={toggleRail}
            aria-label={rail ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            title={rail ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          >
            {rail ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>

          {/* Thanh chuyển nhanh giữa 4 phân khu của App Video Độc Lập */}
          <div className="flex items-center rounded-2xl border border-line bg-soft p-1 text-xs">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition",
                  isActive || loc.pathname.startsWith("/studio")
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs"
                    : "text-ink/80 hover:text-ink",
                )
              }
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>🎬 Studio Phim AI (Decode)</span>
            </NavLink>

            <NavLink
              to="/video-flow"
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition",
                  isActive
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-ink/80 hover:text-ink",
                )
              }
            >
              <Clapperboard className="h-3.5 w-3.5" />
              <span>🎞️ Xưởng Làm Video</span>
            </NavLink>

            <NavLink
              to="/dna"
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition",
                  isActive
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300",
                )
              }
            >
              <Target className="h-3.5 w-3.5" />
              <span>🧬 DNA Sản Phẩm</span>
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cx(
                  "hidden sm:flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition",
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted hover:text-ink",
                )
              }
            >
              <Settings className="h-3.5 w-3.5" />
              <span>⚙️ CLI AI</span>
            </NavLink>
          </div>

          <div className="hidden lg:block">
            <BusinessSwitcher />
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setDark(!dark)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-soft hover:text-ink"
            aria-label="Đổi giao diện sáng/tối"
            title="Đổi chế độ Sáng / Tối"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <AccountMenu profile={sys?.profile} canLogout={false} onLogout={() => {}} />
        </header>

        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto scroll-thin outline-none">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-20 pt-5 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className={cx("flex h-14 shrink-0 items-center gap-2.5 border-b border-line/60", compact ? "justify-center" : "px-4")}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-white shadow-sm ring-1 ring-white/20">
        <Film className="h-[18px] w-[18px]" aria-hidden />
      </span>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-extrabold tracking-tight text-ink">ZONO</span>
            <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
              Video Studio
            </span>
          </div>
          <p className="truncate text-[11px] text-muted">Decode & Xưởng Dựng Video AI</p>
        </div>
      )}
    </div>
  );
}
