/**
 * Capability 'zalo.messaging' — impl của CORE.
 *
 * Bọc zaloPool (đã có) thành 1 contract ổn định để EE gửi tin Zalo mà KHÔNG
 * phải thò tay vào internal zaloPool.getApi(). Internal đổi → chỉ sửa file này,
 * EE không bị ảnh hưởng.
 */
import { zaloPool } from '../modules/zalo/zalo-pool.js';
import { zaloRateLimiter } from '../modules/zalo/zalo-rate-limiter.js';
import type { ZaloMessagingCapability } from '../plugin-api/index.js';

export const zaloMessagingImpl: ZaloMessagingCapability = {
  async sendText(accountId, toUid, text) {
    // Rate-limit dùng chung (Redis cross-process khi REDIS_URL set, else in-memory).
    // Đặt ở đây → MỌI plugin gửi qua capability đều được bảo vệ, không thể bypass.
    const limits = await zaloRateLimiter.checkLimits(accountId, 'message');
    if (!limits.allowed) {
      throw new Error(`[zalo.messaging] rate-limited: ${limits.reason}`);
    }
    const api = zaloPool.getApi(accountId);
    if (!api) {
      throw new Error(`[zalo.messaging] account ${accountId} not connected`);
    }
    await api.sendMessage({ msg: text }, toUid);
    await zaloRateLimiter.recordSend(accountId, 'message');
  },

  isConnected(accountId) {
    return zaloPool.getStatus(accountId) === 'connected';
  },
};
