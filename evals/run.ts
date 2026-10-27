// pnpm eval — chạy bộ tình huống chat chuẩn. Ngưỡng bật: 80%.
import { defaultBizId, openDb } from "@dotaka/db";
import { runChatEval } from "./chat-eval.ts";

openDb();
const r = await runChatEval(defaultBizId(), console.log);
console.log(`\nKết quả: ${r.passed}/${r.cases} (${Math.round(r.score * 100)}%) — nguồn phán đoán: ${r.source}`);
process.exit(r.ok ? 0 : 1);
