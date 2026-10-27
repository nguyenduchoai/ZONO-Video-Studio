import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { networkInterfaces } from "node:os";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { audit, bizSettings, defaultBizId, emit, q, update } from "@dotaka/db";
import { AppError, nowIso, sha256 } from "@dotaka/shared";
import { routes } from "../http.ts";

export interface CloudAccountState {
  loggedIn: boolean;
  email: string;
  name: string;
  passwordHash: string;
  sessionSecret: string;
  remoteEnabled: boolean;
  connectedAt: string;
  cloudHubUrl?: string | null;
}

const COOKIE_NAME = "zono_cloud_session";
const SESSION_TTL_MS = 7 * 24 * 3600_000; // 7 days

let tunnelProc: ChildProcess | null = null;
let tunnelUrl: string | null = null;
let tunnelStatus: "stopped" | "starting" | "running" | "error" = "stopped";
let tunnelError: string | null = null;

function getBizId(): string {
  try {
    return defaultBizId();
  } catch {
    const row = q.get<{ id: string }>("SELECT id FROM biz LIMIT 1");
    return row?.id ?? "";
  }
}

export function getCloudState(): CloudAccountState | null {
  const bizId = getBizId();
  if (!bizId) return null;
  const s = bizSettings(bizId) as Record<string, any>;
  const c = s?.cloud as CloudAccountState | undefined;
  if (!c || !c.loggedIn || !c.email) return null;
  return c;
}

function saveCloudState(state: CloudAccountState | null) {
  const bizId = getBizId();
  if (!bizId) return;
  const s = bizSettings(bizId) as Record<string, any>;
  update("biz", bizId, { settings: { ...s, cloud: state } });
  emit(bizId, "system.updated", {});
}

export function isLoopbackDirect(req: FastifyRequest): boolean {
  const ip = req.ip || "";
  const isLocalIp = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  if (!isLocalIp) return false;
  // If forwarded through Cloudflare Tunnel or reverse proxy, treat as remote!
  if (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.headers["x-forwarded-host"]) {
    return false;
  }
  const host = String(req.headers.host ?? "").replace(/:\d+$/, "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function signRemoteToken(email: string, secret: string): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyRemoteToken(token: string | undefined | null, state: CloudAccountState | null): boolean {
  if (!token || !state || !state.loggedIn || !state.remoteEnabled || !state.sessionSecret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", state.sessionSecret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data || data.email !== state.email || typeof data.exp !== "number" || Date.now() > data.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export function extractRemoteToken(req: FastifyRequest): string | null {
  const auth = String(req.headers.authorization ?? "");
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookieHeader = String(req.headers.cookie ?? "");
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE_NAME) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function isRemoteAuthenticated(req: FastifyRequest): boolean {
  if (isLoopbackDirect(req)) return true;
  const state = getCloudState();
  if (!state || !state.loggedIn || !state.remoteEnabled) return false;
  const token = extractRemoteToken(req);
  return verifyRemoteToken(token, state);
}

function getLanUrls(port: number): string[] {
  const nets = networkInterfaces();
  const urls: string[] = [];
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }
  return urls;
}

function cloudflaredAvailable(): boolean {
  try {
    execFileSync("cloudflared", ["--version"], { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export function stopCloudTunnel() {
  if (tunnelProc) {
    try {
      tunnelProc.kill("SIGTERM");
    } catch { /* ignore */ }
    tunnelProc = null;
  }
  tunnelUrl = null;
  tunnelStatus = "stopped";
  tunnelError = null;
}

export function startCloudTunnel(port = Number(process.env.API_PORT ?? 8787)): Promise<{ status: string; url: string | null; error?: string | null }> {
  const state = getCloudState();
  if (!state || !state.loggedIn) {
    throw new AppError("CLOUD_NOT_LOGGED_IN", "Cần đăng nhập tài khoản ZONO Cloud trước khi mở truy cập từ xa", 403);
  }
  if (tunnelProc && tunnelStatus === "running" && tunnelUrl) {
    return Promise.resolve({ status: tunnelStatus, url: tunnelUrl, error: null });
  }
  stopCloudTunnel();
  if (!cloudflaredAvailable()) {
    tunnelStatus = "error";
    tunnelError = "Chưa cài `cloudflared` (cài nhanh: `brew install cloudflared` trên Mac hoặc `winget install Cloudflare.cloudflared` trên Windows). Bạn vẫn có thể truy cập từ xa qua IP mạng LAN / Tailscale bên dưới.";
    return Promise.resolve({ status: tunnelStatus, url: null, error: tunnelError });
  }
  tunnelStatus = "starting";
  tunnelError = null;
  return new Promise((resolve) => {
    const child = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    tunnelProc = child;
    let settled = false;
    const finish = (res: { status: string; url: string | null; error?: string | null }) => {
      if (!settled) {
        settled = true;
        resolve(res);
      }
    };
    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (m) {
        tunnelUrl = m[0];
        tunnelStatus = "running";
        finish({ status: "running", url: tunnelUrl, error: null });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("error", (err) => {
      tunnelStatus = "error";
      tunnelError = err.message;
      tunnelProc = null;
      finish({ status: "error", url: null, error: tunnelError });
    });
    child.once("close", () => {
      if (tunnelProc === child) {
        tunnelProc = null;
        tunnelUrl = null;
        if (tunnelStatus !== "error") tunnelStatus = "stopped";
      }
      finish({ status: tunnelStatus, url: tunnelUrl, error: tunnelError });
    });
    setTimeout(() => {
      finish({ status: tunnelStatus, url: tunnelUrl, error: tunnelError });
    }, 8000);
  });
}

export function cloudRoutes(app: FastifyInstance) {
  const r = routes(app);
  const port = Number(process.env.API_PORT ?? 8787);

  // Public check used by both Local UI and Remote Login Gate
  app.get("/v1/cloud/remote-status", async (req) => {
    const state = getCloudState();
    const isLocal = isLoopbackDirect(req);
    const authenticated = isRemoteAuthenticated(req);
    return {
      isLocal,
      authenticated,
      cloudLoggedIn: Boolean(state?.loggedIn),
      remoteEnabled: Boolean(state?.loggedIn && state?.remoteEnabled),
      account: state?.loggedIn
        ? {
            email: state.email,
            name: state.name,
            connectedAt: state.connectedAt,
            cloudHubUrl: state.cloudHubUrl ?? "https://cloud.zono.vn",
          }
        : null,
      tunnel: isLocal
        ? {
            status: tunnelStatus,
            url: tunnelUrl,
            error: tunnelError,
            cloudflaredInstalled: cloudflaredAvailable(),
            lanUrls: getLanUrls(port),
          }
        : null,
    };
  });

  // Local machine signs in to ZONO Cloud (activates remote capability without needing any license key)
  r.post("/v1/cloud/login", async ({ bizId, body, actor, req }) => {
    if (!isLoopbackDirect(req)) {
      throw new AppError("LOCAL_ONLY", "Chỉ đăng nhập kích hoạt ZONO Cloud trực tiếp trên máy chủ Local", 403);
    }
    const input = z
      .object({
        email: z.string().trim().email("Email không hợp lệ"),
        password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
        name: z.string().trim().max(80).optional(),
        remoteEnabled: z.boolean().default(true),
      })
      .parse(body);

    const email = input.email.toLowerCase();
    const name = input.name || email.split("@")[0];
    const nextState: CloudAccountState = {
      loggedIn: true,
      email,
      name,
      passwordHash: sha256(`zono-cloud:${email}:${input.password}`),
      sessionSecret: randomBytes(32).toString("hex"),
      remoteEnabled: input.remoteEnabled,
      connectedAt: nowIso(),
      cloudHubUrl: process.env.ZONO_CLOUD_URL ?? "https://cloud.zono.vn",
    };
    saveCloudState(nextState);
    audit(bizId, actor, "cloud.logged_in", { type: "biz", id: bizId }, { email, remoteEnabled: input.remoteEnabled });
    return {
      ok: true,
      account: { email: nextState.email, name: nextState.name, connectedAt: nextState.connectedAt },
      remoteEnabled: nextState.remoteEnabled,
    };
  });

  // Local machine toggles Remote Access on/off or logs out of ZONO Cloud
  r.post("/v1/cloud/logout", ({ bizId, actor, req }) => {
    if (!isLoopbackDirect(req)) {
      throw new AppError("LOCAL_ONLY", "Chỉ ngắt kết nối ZONO Cloud trực tiếp trên máy chủ Local", 403);
    }
    stopCloudTunnel();
    saveCloudState(null);
    audit(bizId, actor, "cloud.logged_out", { type: "biz", id: bizId }, {});
    return { ok: true };
  });

  r.put("/v1/cloud/remote", ({ bizId, body, actor, req }) => {
    if (!isLoopbackDirect(req)) {
      throw new AppError("LOCAL_ONLY", "Chỉ bật/tắt truy cập từ xa trên máy chủ Local", 403);
    }
    const state = getCloudState();
    if (!state) throw new AppError("CLOUD_NOT_LOGGED_IN", "Vui lòng đăng nhập ZONO Cloud trước", 403);
    const { remoteEnabled } = z.object({ remoteEnabled: z.boolean() }).parse(body);
    if (!remoteEnabled) stopCloudTunnel();
    const next = { ...state, remoteEnabled, sessionSecret: remoteEnabled ? state.sessionSecret : randomBytes(32).toString("hex") };
    saveCloudState(next);
    audit(bizId, actor, "cloud.remote_toggled", { type: "biz", id: bizId }, { remoteEnabled });
    return { ok: true, remoteEnabled };
  });

  r.post("/v1/cloud/tunnel/start", async ({ req }) => {
    if (!isLoopbackDirect(req)) throw new AppError("LOCAL_ONLY", "Chỉ bật tunnel trên máy chủ Local", 403);
    return startCloudTunnel(port);
  });

  r.post("/v1/cloud/tunnel/stop", ({ req }) => {
    if (!isLoopbackDirect(req)) throw new AppError("LOCAL_ONLY", "Chỉ tắt tunnel trên máy chủ Local", 403);
    stopCloudTunnel();
    return { status: "stopped", url: null };
  });

  // Remote client (phone/laptop outside) logs in with the ZONO Cloud account to access the Local server
  app.post("/v1/cloud/remote-login", async (req, reply) => {
    const state = getCloudState();
    if (!state || !state.loggedIn) {
      return reply.status(403).send({
        code: "CLOUD_NOT_LOGGED_IN",
        message: "Máy chủ ZONO Local chưa đăng nhập tài khoản ZONO Cloud nên không cho phép kết nối từ xa.",
      });
    }
    if (!state.remoteEnabled) {
      return reply.status(403).send({
        code: "REMOTE_DISABLED",
        message: "Chủ máy đã tắt tính năng Truy cập từ xa trên ZONO Local.",
      });
    }
    const input = z
      .object({
        email: z.string().trim().email(),
        password: z.string().min(1),
      })
      .parse(req.body);

    const email = input.email.toLowerCase();
    const expectedHash = sha256(`zono-cloud:${email}:${input.password}`);
    if (email !== state.email || expectedHash !== state.passwordHash) {
      return reply.status(401).send({
        code: "INVALID_CLOUD_CREDENTIALS",
        message: "Email hoặc mật khẩu ZONO Cloud không đúng.",
      });
    }
    const token = signRemoteToken(state.email, state.sessionSecret);
    reply.header(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    );
    return { ok: true, token, account: { email: state.email, name: state.name } };
  });

  app.post("/v1/cloud/remote-logout", async (_req, reply) => {
    reply.header("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return { ok: true };
  });
}
