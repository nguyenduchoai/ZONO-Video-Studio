// Phase 7 — Block reference validator (DB-reaching helper, kept out of types.ts
// so the validators stay pure & unit-testable without DATABASE_URL).
//
// Used by sequence routes (create/update) to fail fast when referenced blocks
// don't exist in the same org or have been archived.

import { prisma } from '../../../shared/database/prisma-client.js';
import type { SequenceStep } from './types.js';

export async function checkBlockReferences(
  orgId: string,
  steps: SequenceStep[],
): Promise<
  | { ok: true }
  | { ok: false; missingBlockIds: string[]; archivedBlockIds: string[] }
> {
  const blockIds = Array.from(new Set(steps.map((s) => s.blockId)));
  if (blockIds.length === 0) return { ok: true };

  const blocks = await prisma.block.findMany({
    where: { id: { in: blockIds }, orgId },
    select: { id: true, archivedAt: true },
  });

  const foundIds = new Set(blocks.map((b) => b.id));
  const missingBlockIds = blockIds.filter((id) => !foundIds.has(id));
  const archivedBlockIds = blocks.filter((b) => b.archivedAt !== null).map((b) => b.id);

  if (missingBlockIds.length === 0 && archivedBlockIds.length === 0) {
    return { ok: true };
  }
  return { ok: false, missingBlockIds, archivedBlockIds };
}
