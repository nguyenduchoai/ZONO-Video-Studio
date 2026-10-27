import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

export interface ScannedCliBinary {
  provider: "claude_cli" | "codex_cli" | "gemini_cli";
  name: string;
  found: boolean;
  bin: string;
  args: string[];
  resolvedPath?: string;
  version?: string;
  isAgy?: boolean;
  loggedIn: boolean;
  accountHint?: string;
  authSource?: string;
}

export interface SystemCliScanResult {
  scannedAt: string;
  platform: NodeJS.Platform;
  discoveredPathDirs: string[];
  claude: ScannedCliBinary;
  codex: ScannedCliBinary;
  gemini: ScannedCliBinary;
}

let cachedPathDirs: { dirs: string[]; at: number } | null = null;
let cachedScan: { result: SystemCliScanResult; at: number } | null = null;

function safeSubdirs(parentDir: string, suffixPath: string): string[] {
  try {
    if (!existsSync(parentDir)) return [];
    return readdirSync(parentDir)
      .map((entry) => join(parentDir, entry, suffixPath))
      .filter((p) => {
        try {
          return existsSync(p) && statSync(p).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

/**
 * Tự động quét toàn bộ thư mục chứa CLI trên hệ điều hành (macOS, Linux, Windows):
 * - Biến môi trường PATH hiện tại
 * - Login shell PATH (`zsh -lc` / `bash -lc`)
 * - Các trình quản lý phiên bản Node/package phổ biến (nvm, fnm, volta, asdf, mise, bun, pnpm, homebrew, npm global, ~/.local/bin)
 */
export function discoverSystemPathDirs(force = false): string[] {
  if (!force && cachedPathDirs && Date.now() - cachedPathDirs.at < 60_000) {
    return cachedPathDirs.dirs;
  }

  const home = homedir();
  const candidates = new Set<string>();
  const addDir = (d?: string) => {
    const clean = d?.trim();
    if (!clean) return;
    try {
      if (existsSync(clean) && statSync(clean).isDirectory()) {
        candidates.add(clean);
      }
    } catch {
      // ignore inaccessible dirs
    }
  };

  for (const p of (process.env.PATH ?? "").split(delimiter)) addDir(p);

  // Query user login shell PATH on POSIX so daemon / GUI launches still see full user PATH
  if (process.platform !== "win32") {
    for (const sh of [process.env.SHELL, "/bin/zsh", "/bin/bash"].filter(Boolean) as string[]) {
      if (!existsSync(sh)) continue;
      try {
        const shellPath = execFileSync(sh, ["-lc", "echo $PATH"], {
          encoding: "utf8",
          timeout: 3000,
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        for (const p of shellPath.split(delimiter)) addDir(p);
        break;
      } catch {
        // continue
      }
    }
  }

  // Standard user & system bin locations
  addDir(join(home, ".local", "bin"));
  addDir(join(home, "bin"));
  addDir(join(home, ".bun", "bin"));
  addDir(join(home, ".volta", "bin"));
  addDir(join(home, ".asdf", "shims"));
  addDir(join(home, ".local", "share", "mise", "shims"));
  addDir(join(home, ".local", "share", "pnpm"));
  addDir(join(home, "Library", "pnpm"));
  addDir(join(home, ".npm-global", "bin"));
  addDir("/opt/homebrew/bin");
  addDir("/opt/homebrew/sbin");
  addDir("/usr/local/bin");
  addDir("/usr/bin");
  addDir("/bin");

  if (process.platform === "win32") {
    if (process.env.APPDATA) addDir(join(process.env.APPDATA, "npm"));
    if (process.env.LOCALAPPDATA) {
      addDir(join(process.env.LOCALAPPDATA, "pnpm"));
      addDir(join(process.env.LOCALAPPDATA, "Programs", "claude"));
    }
    addDir(join(home, "scoop", "shims"));
  }

  // Dynamic Node version managers (nvm, fnm, mise)
  for (const d of safeSubdirs(join(home, ".nvm", "versions", "node"), "bin")) addDir(d);
  for (const d of safeSubdirs(join(home, ".fnm", "node-versions"), join("installation", "bin"))) addDir(d);
  for (const d of safeSubdirs(join(home, ".local", "share", "mise", "installs", "node"), "bin")) addDir(d);

  const dirs = [...candidates];
  // Enrich current process.env.PATH so child processes automatically inherit discovered paths
  const currentSet = new Set((process.env.PATH ?? "").split(delimiter).filter(Boolean));
  for (const d of dirs) currentSet.add(d);
  process.env.PATH = [...currentSet].join(delimiter);

  cachedPathDirs = { dirs, at: Date.now() };
  return dirs;
}

/**
 * Tìm một CLI khả thi trên hệ thống theo danh sách tên lệnh ưu tiên.
 */
export function findSystemBinary(
  binaryNames: string[],
  envOverride?: string,
  npmLauncherRelPaths: string[] = [],
): { found: boolean; bin: string; args: string[]; resolvedPath?: string } {
  const dirs = discoverSystemPathDirs();
  const configured = envOverride?.trim();
  if (configured) {
    if (/\.(?:c?m?js)$/i.test(configured) && existsSync(configured)) {
      return { found: true, bin: process.execPath, args: [configured], resolvedPath: configured };
    }
    if (existsSync(configured)) {
      return { found: true, bin: configured, args: [], resolvedPath: configured };
    }
  }

  // 1. Try OS `which` / `where.exe` with enriched PATH
  const locator = process.platform === "win32" ? "where.exe" : "which";
  for (const name of binaryNames) {
    try {
      const out = execFileSync(locator, [name], {
        encoding: "utf8",
        timeout: 3000,
        windowsHide: true,
        env: process.env,
        stdio: ["ignore", "pipe", "ignore"],
      })
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => s && existsSync(s));
      if (out) {
        if (process.platform === "win32" && /\.(?:cmd|bat|ps1)$/i.test(out)) {
          // On Windows, check if an npm JS entrypoint sits next to the .cmd wrapper
          for (const rel of npmLauncherRelPaths) {
            const jsLauncher = join(out, "..", rel);
            if (existsSync(jsLauncher)) {
              return { found: true, bin: process.execPath, args: [jsLauncher], resolvedPath: jsLauncher };
            }
          }
        }
        return { found: true, bin: out, args: [], resolvedPath: out };
      }
    } catch {
      // continue scanning directories
    }
  }

  // 2. Direct scan across all discovered system directories
  const exts = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  for (const name of binaryNames) {
    for (const dir of dirs) {
      for (const rel of npmLauncherRelPaths) {
        const jsLauncher = join(dir, rel);
        if (existsSync(jsLauncher)) {
          return { found: true, bin: process.execPath, args: [jsLauncher], resolvedPath: jsLauncher };
        }
      }
      for (const ext of exts) {
        const candidate = join(dir, `${name}${ext}`);
        try {
          if (existsSync(candidate) && statSync(candidate).isFile()) {
            return { found: true, bin: candidate, args: [], resolvedPath: candidate };
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return { found: false, bin: binaryNames[0] ?? "cli", args: [] };
}

function probeVersion(bin: string, args: string[], versionArg = "--version"): string | undefined {
  try {
    return execFileSync(bin, [...args, versionArg], {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)[0]
      ?.trim();
  } catch {
    return undefined;
  }
}

function detectClaudeCredentials(): { loggedIn: boolean; accountHint?: string; authSource?: string } {
  const home = homedir();
  const credFile = join(home, ".claude", ".credentials.json");
  if (existsSync(credFile)) {
    return { loggedIn: true, authSource: "~/.claude/.credentials.json" };
  }
  const claudeJson = join(home, ".claude.json");
  if (existsSync(claudeJson)) {
    try {
      const data = JSON.parse(readFileSync(claudeJson, "utf8"));
      const email = data?.oauthAccount?.emailAddress ?? data?.userEmail;
      if (data?.oauthAccount || data?.primaryApiKey || data?.userID) {
        return { loggedIn: true, accountHint: email, authSource: "~/.claude.json" };
      }
    } catch {
      // ignore
    }
  }
  if (process.platform === "darwin") {
    try {
      execFileSync("security", ["find-generic-password", "-s", "Claude Code-credentials"], {
        timeout: 2500,
        stdio: ["ignore", "pipe", "ignore"],
      });
      return { loggedIn: true, authSource: "macOS Keychain (Claude Code)" };
    } catch {
      // not in keychain
    }
  }
  return { loggedIn: false };
}

function detectCodexCredentials(): { loggedIn: boolean; accountHint?: string; authSource?: string } {
  const authPath = join(homedir(), ".codex", "auth.json");
  if (!existsSync(authPath)) return { loggedIn: false };
  try {
    const auth = JSON.parse(readFileSync(authPath, "utf8"));
    if (auth?.tokens?.access_token && auth?.tokens?.id_token) {
      let email: string | undefined;
      try {
        const claims = JSON.parse(Buffer.from(auth.tokens.id_token.split(".")[1], "base64url").toString("utf8"));
        email = typeof claims.email === "string" ? claims.email : undefined;
      } catch {
        // ignore
      }
      return { loggedIn: true, accountHint: email, authSource: "~/.codex/auth.json" };
    }
  } catch {
    // ignore
  }
  return { loggedIn: false };
}

function detectGeminiCredentials(): { loggedIn: boolean; accountHint?: string; authSource?: string } {
  const home = homedir();
  const geminiDir = join(home, ".gemini");
  const accountsPath = join(geminiDir, "google_accounts.json");
  let email: string | undefined;
  if (existsSync(accountsPath)) {
    try {
      const acc = JSON.parse(readFileSync(accountsPath, "utf8"));
      email = typeof acc?.active === "string" ? acc.active : undefined;
    } catch {
      // ignore
    }
  }
  if (existsSync(join(geminiDir, "jetski-standalone-oauth-token"))) {
    return { loggedIn: true, accountHint: email, authSource: "~/.gemini/jetski-standalone-oauth-token" };
  }
  if (existsSync(join(geminiDir, "oauth_creds.json"))) {
    return { loggedIn: true, accountHint: email, authSource: "~/.gemini/oauth_creds.json" };
  }
  if (email) {
    return { loggedIn: true, accountHint: email, authSource: "~/.gemini/google_accounts.json" };
  }
  const gcloudAdc = join(home, ".config", "gcloud", "application_default_credentials.json");
  if (existsSync(gcloudAdc)) {
    return { loggedIn: true, authSource: "~/.config/gcloud/ADC" };
  }
  if (process.env.GEMINI_API_KEY) {
    return { loggedIn: true, authSource: "GEMINI_API_KEY" };
  }
  return { loggedIn: false };
}

/**
 * Quét toàn diện cả 3 công cụ CLI AI (Claude, OpenAI Codex, Google Gemini / Antigravity) trên hệ thống.
 */
export function scanSystemAiClis(force = false): SystemCliScanResult {
  if (!force && cachedScan && Date.now() - cachedScan.at < 30_000) {
    return cachedScan.result;
  }

  const discoveredPathDirs = discoverSystemPathDirs(force);

  // 1. Claude CLI
  const claudeBin = findSystemBinary(
    ["claude"],
    process.env.CLAUDE_CLI_PATH,
    [join("node_modules", "@anthropic-ai", "claude-code", "cli.js")],
  );
  const claudeCreds = detectClaudeCredentials();
  const claudeVersion = claudeBin.found ? probeVersion(claudeBin.bin, claudeBin.args, "--version") : undefined;

  // 2. OpenAI Codex CLI
  const codexBin = findSystemBinary(
    ["codex"],
    process.env.CODEX_CLI_PATH,
    [join("node_modules", "@openai", "codex", "bin", "codex.js")],
  );
  const codexCreds = detectCodexCredentials();
  const codexVersion = codexBin.found ? probeVersion(codexBin.bin, codexBin.args, "--version") : undefined;

  // 3. Google Gemini / Antigravity CLI (`agy` preferred if installed, otherwise `gemini`)
  const geminiBin = findSystemBinary(
    ["agy", "gemini"],
    process.env.GEMINI_CLI_PATH,
    [join("node_modules", "@google", "gemini-cli", "bundle", "gemini.js")],
  );
  const isAgy = Boolean(geminiBin.resolvedPath && /\bagy(?:\.exe|\.cmd)?$/i.test(geminiBin.resolvedPath));
  const geminiCreds = detectGeminiCredentials();
  const geminiVersion = geminiBin.found
    ? probeVersion(geminiBin.bin, geminiBin.args, isAgy ? "changelog" : "--version")
    : undefined;

  const result: SystemCliScanResult = {
    scannedAt: new Date().toISOString(),
    platform: process.platform,
    discoveredPathDirs,
    claude: {
      provider: "claude_cli",
      name: "Anthropic Claude CLI",
      found: claudeBin.found,
      bin: claudeBin.bin,
      args: claudeBin.args,
      resolvedPath: claudeBin.resolvedPath,
      version: claudeVersion,
      loggedIn: claudeBin.found && claudeCreds.loggedIn,
      accountHint: claudeCreds.accountHint,
      authSource: claudeCreds.authSource,
    },
    codex: {
      provider: "codex_cli",
      name: "OpenAI Codex CLI (ChatGPT)",
      found: codexBin.found,
      bin: codexBin.bin,
      args: codexBin.args,
      resolvedPath: codexBin.resolvedPath,
      version: codexVersion,
      loggedIn: codexBin.found && codexCreds.loggedIn,
      accountHint: codexCreds.accountHint,
      authSource: codexCreds.authSource,
    },
    gemini: {
      provider: "gemini_cli",
      name: isAgy ? "Google Gemini CLI (Antigravity)" : "Google Gemini CLI",
      found: geminiBin.found,
      bin: geminiBin.bin,
      args: geminiBin.args,
      resolvedPath: geminiBin.resolvedPath,
      version: geminiVersion,
      isAgy,
      loggedIn: geminiBin.found && geminiCreds.loggedIn,
      accountHint: geminiCreds.accountHint,
      authSource: geminiCreds.authSource,
    },
  };

  cachedScan = { result, at: Date.now() };
  return result;
}
