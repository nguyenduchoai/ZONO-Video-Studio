// Xuất cấu hình workspace hiện tại (DNA, cài đặt, agent, mẫu QC, luồng tự động, tri thức tự thêm) ra config/zono-workspace.json
// để máy khác cài từ GitHub có đúng cấu hình này. Chạy: pnpm workspace:export  (rồi commit + push)
import { defaultBizId, openDb } from "@dotaka/db";
import { exportWorkspace, WORKSPACE_FILE } from "../apps/api/src/workspace.ts";

openDb();
const s = exportWorkspace(defaultBizId());
console.log(`✓ Đã xuất ${WORKSPACE_FILE}: DNA, ${s.agents.length} agent, ${s.adTemplates.length} mẫu QC, ${s.automations.length} luồng, ${s.knowledge.length} tài liệu tự thêm (không chứa token/bí mật)`);
process.exit(0);
