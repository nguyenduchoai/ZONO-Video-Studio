import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Cloud, CloudOff, Copy, ExternalLink, Globe, Lock, LogOut, Radio, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { Badge, Button, Field, Loading, Modal, cx, inputCls, useToast } from "./ui";

export interface RemoteStatusData {
  isLocal: boolean;
  authenticated: boolean;
  cloudLoggedIn: boolean;
  remoteEnabled: boolean;
  account: {
    email: string;
    name: string;
    connectedAt: string;
    cloudHubUrl: string;
  } | null;
  tunnel: {
    status: "stopped" | "starting" | "running" | "error";
    url: string | null;
    error: string | null;
    cloudflaredInstalled: boolean;
    lanUrls: string[];
  } | null;
}

export const CLOUD_EVENT = "zono:cloud-status";

export function useCloudRemoteStatus() {
  const [data, setData] = useState<RemoteStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const r = await api.get<RemoteStatusData>("cloud/remote-status");
      setData(r);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    const h = () => void reload();
    window.addEventListener(CLOUD_EVENT, h);
    return () => window.removeEventListener(CLOUD_EVENT, h);
  }, []);

  return { data, loading, reload, setData };
}

/**
 * Gatekeeper for remote connections:
 * - On localhost (`isLocal === true`): renders children immediately.
 * - From outside (`isLocal === false`):
 *   - If Local server is NOT logged into ZONO Cloud (`!cloudLoggedIn`): blocks access and explains why.
 *   - If Local server IS logged into ZONO Cloud but remote client hasn't signed in (`!authenticated`): shows ZONO Cloud Login screen.
 */
export function RemoteAuthGate({ children }: { children: ReactNode }) {
  const { data, loading, reload } = useCloudRemoteStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (!data || data.isLocal || data.authenticated) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post("cloud/remote-login", { email, password });
      await reload();
      window.location.reload();
    } catch (ex: any) {
      setErr(ex?.message || "Đăng nhập không thành công");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-ink">ZONO</span>
              <span className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Cloud Remote</span>
            </div>
            <p className="text-xs text-muted">Điều khiển máy chủ ZONO Local từ xa</p>
          </div>
        </div>

        {!data.cloudLoggedIn || !data.remoteEnabled ? (
          <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <CloudOff className="h-5 w-5 shrink-0 text-amber-600" />
              <span>Truy cập từ xa đang khóa</span>
            </div>
            <p className="leading-relaxed">
              {!data.cloudLoggedIn
                ? "Máy chủ ZONO Local chưa đăng nhập tài khoản ZONO Cloud. Vui lòng mở trực tiếp trên máy chủ Local và đăng nhập ZONO Cloud để kích hoạt điều khiển từ xa."
                : "Chủ máy đã tạm tắt tính năng Truy cập từ xa trên máy chủ ZONO Local."}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-muted">
              Đăng nhập bằng tài khoản <b className="text-ink">ZONO Cloud</b> đang kết nối trên máy chủ Local để điều hành từ xa.
            </div>
            {err && <div className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-300">{err}</div>}
            <Field label="Email ZONO Cloud">
              <input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ceo@doanhnghiep.vn" />
            </Field>
            <Field label="Mật khẩu">
              <input type="password" required className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            <Button type="submit" variant="primary" className="w-full justify-center py-2.5" loading={busy} icon={Lock}>
              Đăng nhập điều khiển từ xa
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Header pill button showing Cloud & Remote status with modal trigger. */
export function CloudHeaderButton() {
  const { data } = useCloudRemoteStatus();
  const [open, setOpen] = useState(false);
  const active = Boolean(data?.cloudLoggedIn && data?.remoteEnabled);
  const tunnelOn = data?.tunnel?.status === "running" && Boolean(data?.tunnel?.url);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          "flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-colors",
          tunnelOn
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : active
              ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
              : "border-line bg-soft/60 text-muted hover:bg-soft hover:text-ink",
        )}
        title="ZONO Cloud & Điều khiển từ xa"
      >
        {active ? <Cloud className="h-4 w-4 shrink-0" /> : <CloudOff className="h-4 w-4 shrink-0" />}
        <span className="hidden sm:inline">{tunnelOn ? "Cloud · Online từ xa" : active ? "Cloud · Đã kết nối" : "Cloud · Chỉ Local"}</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="ZONO Cloud & Điều khiển từ xa" description="Đăng nhập ZONO Cloud (không cần License Key) để mở khóa điều khiển máy chủ Local từ xa qua Điện thoại/Internet.">
        <CloudRemotePanel />
      </Modal>
    </>
  );
}

/** Full management panel used in Settings and the Header Modal. */
export function CloudRemotePanel() {
  const toast = useToast();
  const { data, loading, reload } = useCloudRemoteStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (!data) return null;

  const notify = () => {
    void reload();
    window.dispatchEvent(new Event(CLOUD_EVENT));
  };

  const loginCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("login");
    try {
      await api.post("cloud/login", { email, password, name: name || undefined, remoteEnabled: true });
      setPassword("");
      toast("Đã đăng nhập ZONO Cloud & mở khóa Truy cập từ xa!");
      notify();
    } catch (ex: any) {
      toast(ex.message, "err");
    } finally {
      setBusy(null);
    }
  };

  const logoutCloud = async () => {
    setBusy("logout");
    try {
      await api.post("cloud/logout");
      toast("Đã đăng xuất ZONO Cloud — khóa mọi kết nối từ xa");
      notify();
    } catch (ex: any) {
      toast(ex.message, "err");
    } finally {
      setBusy(null);
    }
  };

  const toggleRemote = async (remoteEnabled: boolean) => {
    setBusy("toggle");
    try {
      await api.put("cloud/remote", { remoteEnabled });
      toast(remoteEnabled ? "Đã bật cho phép điều khiển từ xa" : "Đã khóa điều khiển từ xa");
      notify();
    } catch (ex: any) {
      toast(ex.message, "err");
    } finally {
      setBusy(null);
    }
  };

  const startTunnel = async () => {
    setBusy("tunnel");
    try {
      const r = await api.post<any>("cloud/tunnel/start");
      if (r.url) toast(`Đã mở đường hầm từ xa: ${r.url}`);
      else if (r.error) toast(r.error, "err");
      notify();
    } catch (ex: any) {
      toast(ex.message, "err");
    } finally {
      setBusy(null);
    }
  };

  const stopTunnel = async () => {
    setBusy("tunnel");
    try {
      await api.post("cloud/tunnel/stop");
      toast("Đã đóng đường hầm Internet");
      notify();
    } catch (ex: any) {
      toast(ex.message, "err");
    } finally {
      setBusy(null);
    }
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast("Đã sao chép địa chỉ truy cập từ xa");
  };

  if (!data.cloudLoggedIn) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Chế độ hiện tại: Chỉ chạy Local trên máy này</p>
            <p className="mt-0.5 opacity-90">
              Bạn không cần nhập License Key. Chỉ cần đăng nhập tài khoản <b>ZONO Cloud</b> bên dưới để mở khóa tính năng gọi từ bên ngoài (Điện thoại 4G / Laptop từ xa) về điều khiển máy Local này.
            </p>
          </div>
        </div>

        <form onSubmit={loginCloud} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email tài khoản ZONO Cloud">
              <input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ceo@doanhnghiep.vn" />
            </Field>
            <Field label="Tên hiển thị (tùy chọn)">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Anh Hoài CEO" />
            </Field>
          </div>
          <Field label="Mật khẩu ZONO Cloud (dùng để xác thực khi bạn truy cập từ xa)" hint="Tối thiểu 6 ký tự. Khi mở link từ xa trên điện thoại, bạn sẽ đăng nhập bằng Email & Mật khẩu này.">
            <input type="password" required minLength={6} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <div className="flex justify-end pt-1">
            <Button type="submit" variant="primary" icon={Cloud} loading={busy === "login"}>
              Đăng nhập ZONO Cloud & Mở khóa từ xa
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="text-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold text-ink">{data.account?.name}</span>
              <Badge tone="green">Đã kết nối Cloud</Badge>
            </div>
            <p className="text-xs text-muted">{data.account?.email} · Không cần License Key</p>
          </div>
        </div>
        {data.isLocal && (
          <Button size="sm" variant="secondary" icon={LogOut} loading={busy === "logout"} onClick={logoutCloud}>
            Đăng xuất Cloud
          </Button>
        )}
      </div>

      {data.isLocal && (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-line p-3.5">
            <div className="text-sm">
              <p className="font-semibold text-ink">Cho phép gọi từ bên ngoài về máy Local</p>
              <p className="text-xs text-muted">Khi tắt, mọi kết nối từ ngoài máy này sẽ bị chặn ngay lập tức.</p>
            </div>
            <Button
              size="sm"
              variant={data.remoteEnabled ? "primary" : "secondary"}
              loading={busy === "toggle"}
              onClick={() => toggleRemote(!data.remoteEnabled)}
            >
              {data.remoteEnabled ? "Đang BẬT" : "Đang TẮT"}
            </Button>
          </div>

          {data.remoteEnabled && (
            <div className="space-y-3 rounded-2xl border border-line bg-soft/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span>Đường hầm Internet (Cloudflare Tunnel 1-Click)</span>
                </div>
                {data.tunnel?.status === "running" ? (
                  <Button size="sm" variant="danger" loading={busy === "tunnel"} onClick={stopTunnel}>
                    Đóng đường hầm
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" icon={Radio} loading={busy === "tunnel"} onClick={startTunnel}>
                    Mở đường hầm từ xa
                  </Button>
                )}
              </div>

              {data.tunnel?.url ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-mono text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    {data.tunnel.url}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="secondary" icon={Copy} onClick={() => copy(data.tunnel!.url!)}>
                      Sao chép
                    </Button>
                    <a href={data.tunnel.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-card px-2.5 text-xs font-medium text-ink hover:bg-soft">
                      <ExternalLink className="h-3.5 w-3.5" /> Mở
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Bấm <b>“Mở đường hầm từ xa”</b> để lấy link HTTPS công khai truy cập từ Điện thoại 4G/5G ở bất kỳ đâu (được bảo vệ bằng mật khẩu ZONO Cloud của bạn).
                </p>
              )}

              {data.tunnel?.error && <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">{data.tunnel.error}</p>}

              {data.tunnel?.lanUrls && data.tunnel.lanUrls.length > 0 && (
                <div className="border-t border-line pt-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <Smartphone className="h-3.5 w-3.5" /> Địa chỉ truy cập qua mạng LAN / Wi-Fi / VPN Tailscale:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.tunnel.lanUrls.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => copy(u)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1 font-mono text-xs text-ink hover:bg-soft"
                      >
                        <span>{u}</span>
                        <Copy className="h-3 w-3 text-muted" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
