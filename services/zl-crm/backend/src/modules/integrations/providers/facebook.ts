/**
 * facebook.ts — Import leads from Facebook Page via Graph API.
 * Config shape: { pageAccessToken: string, pageId: string }
 * Fetches conversations from the page and creates contacts.
 */
import { prisma } from '../../../shared/database/prisma-client.js';
import { logger } from '../../../shared/utils/logger.js';

interface FacebookConfig {
  pageAccessToken?: string;
  pageId?: string;
}

interface FbConversation {
  id: string;
  participants?: { data: Array<{ id: string; name: string }> };
}

export async function importFacebookLeads(
  orgId: string,
  config: FacebookConfig,
): Promise<{ direction: 'import'; recordCount: number; status: 'success' | 'partial' | 'failed'; errorMessage?: string }> {
  const { pageAccessToken, pageId } = config;

  if (!pageAccessToken || !pageId) {
    return { direction: 'import', recordCount: 0, status: 'failed', errorMessage: 'Missing pageAccessToken or pageId' };
  }

  try {
    // Fetch page conversations
    const url = `https://graph.facebook.com/v19.0/${pageId}/conversations?fields=participants&access_token=${pageAccessToken}&limit=100`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (!response.ok) {
      const body = await response.text();
      logger.error('[facebook] Graph API error:', body);
      return { direction: 'import', recordCount: 0, status: 'failed', errorMessage: `Facebook API ${response.status}: ${body.slice(0, 200)}` };
    }

    const data = (await response.json()) as { data: FbConversation[] };
    const conversations = data.data ?? [];
    let imported = 0;

    for (const conv of conversations) {
      const participants = conv.participants?.data ?? [];
      for (const p of participants) {
        // Skip the page itself
        if (p.id === pageId) continue;

        // Upsert contact by source + metadata
        const existing = await prisma.contact.findFirst({
          where: { orgId, metadata: { path: ['facebook_id'], equals: p.id } },
        });

        if (!existing) {
          await prisma.contact.create({
            data: {
              orgId,
              fullName: p.name,
              source: 'Facebook',
              sourceDate: new Date(),
              firstContactDate: new Date(),
              status: 'new',
              metadata: { facebook_id: p.id },
            },
          });
          imported++;
        }
      }
    }

    logger.info(`[facebook] Imported ${imported} leads from page ${pageId}`);
    return { direction: 'import', recordCount: imported, status: imported > 0 ? 'success' : 'partial' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { direction: 'import', recordCount: 0, status: 'failed', errorMessage: msg };
  }
}
