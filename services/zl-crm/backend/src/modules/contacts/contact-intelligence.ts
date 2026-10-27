/**
 * contact-intelligence.ts — Cron wrapper for daily contact intelligence.
 * Runs duplicate detection + lead scoring at 02:30 UTC (09:30 Vietnam time).
 */
import cron from 'node-cron';
import { logger } from '../../shared/utils/logger.js';
import { detectDuplicates } from './duplicate-detector.js';
import { computeAllLeadScores } from './lead-scoring.js';

async function runIntelligencePipeline(): Promise<void> {
  await detectDuplicates();
  await computeAllLeadScores();
}

export function startContactIntelligence(): void {
  // 02:30 UTC = 09:30 Vietnam time (UTC+7)
  cron.schedule('30 2 * * *', async () => {
    logger.info('[intelligence] Starting contact intelligence cron...');
    try {
      await runIntelligencePipeline();
      logger.info('[intelligence] Contact intelligence cron completed');
    } catch (err) {
      logger.error('[intelligence] Cron error:', err);
    }
  });
  logger.info('[intelligence] Contact intelligence cron started (daily 02:30 UTC)');
}

export async function runContactIntelligence(): Promise<void> {
  logger.info('[intelligence] Manual run started...');
  await runIntelligencePipeline();
  logger.info('[intelligence] Manual run completed');
}
