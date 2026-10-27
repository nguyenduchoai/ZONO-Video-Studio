/**
 * ensure-admin.ts — Đảm bảo tài khoản admin "bootstrap" luôn tồn tại.
 *
 * Đọc thông tin từ ENV (KHÔNG hardcode mật khẩu vào source):
 *   BOOTSTRAP_ADMIN_PHONE     — SĐT đăng nhập (vd 0918100192)  [bắt buộc để chạy]
 *   BOOTSTRAP_ADMIN_PASSWORD  — mật khẩu ban đầu               [bắt buộc để chạy]
 *   BOOTSTRAP_ADMIN_NAME      — họ tên hiển thị    (mặc định "Quản trị viên")
 *   BOOTSTRAP_ADMIN_EMAIL     — email             (mặc định "<phone>@zalocrm.local")
 *   BOOTSTRAP_ORG_NAME        — tên org nếu DB trống (mặc định "Shin Su Lab")
 *   BOOTSTRAP_ADMIN_RESET_PASSWORD=true — reset lại mật khẩu MỖI lần chạy
 *       (mặc định false: nếu tài khoản đã có thì KHÔNG đụng mật khẩu, tránh
 *        ghi đè mật khẩu người dùng đã tự đổi).
 *
 * Idempotent — chạy lại nhiều lần an toàn. Non-fatal — mọi lỗi chỉ log, không
 * làm sập tiến trình khởi động.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { normalizePhone } from '../../shared/utils/phone.js';

export interface EnsureAdminResult {
  status: 'created' | 'existed' | 'password_reset' | 'skipped';
  userId?: string;
  reason?: string;
}

export async function ensureBootstrapAdmin(): Promise<EnsureAdminResult> {
  const rawPhone = (process.env.BOOTSTRAP_ADMIN_PHONE ?? '').trim();
  const password = (process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '').trim();

  if (!rawPhone || !password) {
    return { status: 'skipped', reason: 'BOOTSTRAP_ADMIN_PHONE/PASSWORD chưa cấu hình' };
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    logger.warn(`[ensure-admin] BOOTSTRAP_ADMIN_PHONE không hợp lệ: "${rawPhone}"`);
    return { status: 'skipped', reason: 'SĐT không hợp lệ' };
  }

  const fullName = (process.env.BOOTSTRAP_ADMIN_NAME ?? '').trim() || 'Quản trị viên';
  const email = ((process.env.BOOTSTRAP_ADMIN_EMAIL ?? '').trim() || `${phone}@zalocrm.local`).toLowerCase();
  const orgName = (process.env.BOOTSTRAP_ORG_NAME ?? '').trim() || 'Shin Su Lab';
  const resetPassword = (process.env.BOOTSTRAP_ADMIN_RESET_PASSWORD ?? '').trim().toLowerCase() === 'true';

  // Đã tồn tại theo phone?
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    const updates: Record<string, unknown> = {};
    if (!existing.isActive) updates.isActive = true;
    if (resetPassword) updates.passwordHash = await bcrypt.hash(password, 12);
    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { id: existing.id }, data: updates });
      logger.info(`[ensure-admin] cập nhật admin phone=${phone} (${Object.keys(updates).join(', ')})`);
      return { status: resetPassword ? 'password_reset' : 'existed', userId: existing.id };
    }
    logger.info(`[ensure-admin] admin phone=${phone} đã tồn tại — bỏ qua`);
    return { status: 'existed', userId: existing.id };
  }

  // Chưa có: cần 1 org để gắn vào. Ưu tiên org đang có; nếu DB trống thì tạo mới.
  const passwordHash = await bcrypt.hash(password, 12);
  const created = await prisma.$transaction(async (tx) => {
    let org = await tx.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!org) {
      org = await tx.organization.create({ data: { name: orgName } });
    }
    return tx.user.create({
      data: {
        orgId: org.id,
        email,
        phone,
        passwordHash,
        fullName,
        role: 'owner',
        isActive: true,
      },
    });
  });

  logger.info(`[ensure-admin] ĐÃ TẠO admin phone=${phone} email=${email} userId=${created.id}`);
  return { status: 'created', userId: created.id };
}

// CLI entrypoint — `npm run ensure-admin` / `tsx src/modules/auth/ensure-admin.ts`
const isDirectRun = process.argv[1]?.endsWith('ensure-admin.ts') || process.argv[1]?.endsWith('ensure-admin.js');
if (isDirectRun) {
  ensureBootstrapAdmin()
    .then((r) => {
      logger.info(`[ensure-admin] kết quả: ${JSON.stringify(r)}`);
      return prisma.$disconnect();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('[ensure-admin] lỗi:', err);
      process.exit(1);
    });
}
