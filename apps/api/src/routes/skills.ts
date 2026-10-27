import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { audit, q, update, type Row } from "@dotaka/db";
import { agentPlaybook, listSkills, syncSkills } from "@dotaka/skills";
import { AppError } from "@dotaka/shared";
import { routes } from "../http.ts";

export function skillRoutes(app: FastifyInstance) {
  const r = routes(app);
  r.get("/v1/skills", ({ bizId }) => listSkills(bizId));
  r.get("/v1/skills/:key", ({ bizId, params }) => {
    const s = q.get<Row>("SELECT * FROM skill WHERE biz_id = ? AND key = ?", bizId, params.key);
    if (!s) throw new AppError("NOT_FOUND", "Không thấy skill", 404);
    return { ...s, refs: (s.refs as Row[]).map((x) => ({ path: x.path, size: x.size, content: x.content })), usedBy: q.all("SELECT agent_key, role, enabled FROM agent_skill WHERE biz_id = ? AND skill_key = ?", bizId, s.key) };
  });
  r.post("/v1/skills/sync", ({ bizId, actor }) => syncSkills(bizId, actor));
  r.put("/v1/agent-skills", ({ bizId, body, actor }) => {
    const p = z.object({ agentKey: z.string(), skillKey: z.string(), enabled: z.boolean() }).parse(body);
    const b = q.get<Row>("SELECT id FROM agent_skill WHERE biz_id = ? AND agent_key = ? AND skill_key = ?", bizId, p.agentKey, p.skillKey);
    if (!b) throw new AppError("NOT_FOUND", "Không có liên kết agent-skill", 404);
    update("agent_skill", b.id, { enabled: p.enabled ? 1 : 0 });
    audit(bizId, actor, "agent_skill.toggled", { type: "agent_skill", id: b.id }, p);
    return { ok: true };
  });
  r.get("/v1/agents/:key/playbook", ({ bizId, params }) => {
    const p = agentPlaybook(bizId, params.key);
    return { parts: p.parts, chars: p.text.length, approxTokens: Math.round(p.text.length / 3.2), preview: p.text.slice(0, 4000) };
  });
}
