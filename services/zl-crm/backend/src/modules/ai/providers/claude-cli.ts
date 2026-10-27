/**
 * claude-cli.ts — AI provider chạy qua Claude Code CLI ở chế độ headless.
 *
 * Khác với provider `anthropic` (gọi REST api.anthropic.com, tính tiền theo token),
 * provider này spawn binary `claude -p` đã đăng nhập bằng tài khoản Pro/Max
 * (`claude /login` OAuth). Mọi lời gọi sẽ TRỪ VÀO HẠN MỨC GÓI CƯỚC THÁNG, không
 * dùng API key.
 *
 * ⚠️ Lưu ý vận hành:
 *  - Gói Pro/Max là gói tiêu dùng cá nhân + có giới hạn cửa sổ (5h / tuần). Dùng
 *    cho backend đa người dùng là vùng xám điều khoản và dễ chạm trần → kẹt AI.
 *  - Máy chủ phải cài Claude Code CLI và đã `claude /login` bằng tài khoản subscription.
 *  - maxTokens không ép được qua CLI; độ dài output do prompt hệ thống kiểm soát.
 */
import { spawn } from 'node:child_process';

export async function generateWithClaudeCli(
  bin: string,
  model: string,
  system: string,
  prompt: string,
  _maxTokens?: number,
): Promise<string> {
  const args = [
    '-p',
    '--output-format', 'json',
    '--model', model,
  ];
  if (system) args.push('--append-system-prompt', system);

  // Buộc dùng OAuth gói cước Pro/Max: nếu để lọt ANTHROPIC_API_KEY/AUTH_TOKEN
  // (app set sẵn trong .env) thì Claude Code sẽ ưu tiên API key → tính tiền theo
  // token, mất tác dụng "dùng gói cước". Xoá khỏi env tiến trình con.
  const childEnv = { ...process.env };
  delete childEnv.ANTHROPIC_API_KEY;
  delete childEnv.ANTHROPIC_AUTH_TOKEN;

  return new Promise<string>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'], env: childEnv });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Claude CLI timeout (90s)'));
    }, 90_000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Không spawn được '${bin}': ${err.message}. Đã cài Claude Code CLI và login chưa?`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const detail = (stderr || stdout).trim().slice(0, 500);
        const is429 = /usage limit|rate limit|429|quota/i.test(detail);
        reject(new Error(is429
          ? `Claude CLI hết hạn mức gói cước (429): ${detail}`
          : `Claude CLI lỗi (exit ${code}): ${detail}`));
        return;
      }
      try {
        // --output-format json trả về { type: "result", subtype, is_error, result, ... }
        const data = JSON.parse(stdout) as { result?: string; is_error?: boolean; error?: string };
        if (data.is_error) throw new Error(data.error || 'Claude CLI báo is_error');
        const text = data.result?.trim();
        if (!text) throw new Error('Claude CLI trả về nội dung rỗng');
        resolve(text);
      } catch (err) {
        reject(new Error(`Không parse được output Claude CLI: ${(err as Error).message}`));
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}
