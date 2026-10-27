// Đóng gói skill Phòng Marketing từ ~/.claude vào repo (assets/claude) — chạy sau khi sửa skill: `pnpm skills:export`
// Chỉ chép đúng những skill hệ thống dùng (DNA, luật phòng, skill của từng nhân viên + skill bổ sung),
// để mọi máy cài từ GitHub chạy cùng một bộ playbook.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { DEPT_SKILL, DNA_SKILL, TEAM } from "@dotaka/skills";

const SRC = process.env.SKILLS_SRC ?? join(homedir(), ".claude");
const OUT = resolve("assets/claude");
const MAX_FILE = 5 * 1024 * 1024;

const staffSkills = (file: string) => [...readFileSync(file, "utf8").matchAll(/^- `([a-z0-9-]+)`/gm)].map((m) => m[1]);
const names = new Set<string>([DNA_SKILL, DEPT_SKILL]);
const staff: string[] = [];
for (const m of TEAM) {
  if (m.employee) {
    const f = join(SRC, "agents", `${m.employee}.md`);
    if (existsSync(f)) { staff.push(m.employee); staffSkills(f).forEach((s) => names.add(s)); }
    else console.warn(`! thiếu nhân viên ${m.employee}`);
  }
  (m.extraSkills ?? []).forEach((s) => names.add(s));
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "skills"), { recursive: true });
mkdirSync(join(OUT, "agents"), { recursive: true });
const missing: string[] = [];
for (const n of [...names].sort()) {
  const dir = join(SRC, "skills", n);
  if (!existsSync(join(dir, "SKILL.md"))) { missing.push(n); continue; }
  cpSync(dir, join(OUT, "skills", n), {
    recursive: true, dereference: true,
    filter: (p) => !/(^|\/)(\.git|node_modules|__pycache__|\.DS_Store)(\/|$)/.test(p) && (statSync(p).isDirectory() || statSync(p).size <= MAX_FILE),
  });
}
for (const e of staff) cpSync(join(SRC, "agents", `${e}.md`), join(OUT, "agents", `${e}.md`));
console.log(`✓ Đóng gói ${names.size - missing.length} skill + ${staff.length} nhân viên vào assets/claude${missing.length ? ` (thiếu: ${missing.join(", ")})` : ""}`);
