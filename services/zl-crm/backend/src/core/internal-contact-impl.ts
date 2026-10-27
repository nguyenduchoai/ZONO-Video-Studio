/**
 * internal-contact-impl.ts — core impl của capability 'internal.contact'.
 *
 * Điểm mở rộng trung tính: plugin resolve "liên lạc nội bộ" của user → trả về
 * { senderAccountId, targetUid } để gửi tin Zalo nội bộ, KHÔNG đụng internal core.
 *
 * Quy tắc resolve:
 *   - org.systemNotifyZaloAccountId phải set + systemNotifyNick.status === 'connected'
 *   - SystemNotifyRecipient (orgId, targetUserId, status='ready') phải có threadIdInSenderView
 */
import { prisma } from '../shared/database/prisma-client.js';
import type {
  InternalContactCapability,
  InternalContactTarget,
} from '../plugin-api/index.js';

export const internalContactImpl: InternalContactCapability = {
  async resolve(userId: string, orgId: string): Promise<InternalContactTarget | null> {
    const [org, recipient] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          systemNotifyZaloAccountId: true,
          systemNotifyNick: { select: { status: true } },
        },
      }),
      prisma.systemNotifyRecipient.findFirst({
        where: { orgId, targetUserId: userId, status: 'ready' },
        select: { threadIdInSenderView: true, senderZaloAccountId: true },
      }),
    ]);

    if (!org?.systemNotifyZaloAccountId || org.systemNotifyNick?.status !== 'connected') {
      return null;
    }
    if (!recipient?.threadIdInSenderView) return null;

    return {
      senderAccountId: org.systemNotifyZaloAccountId,
      targetUid: recipient.threadIdInSenderView,
    };
  },
};
