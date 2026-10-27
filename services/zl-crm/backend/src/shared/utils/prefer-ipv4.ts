/**
 * prefer-ipv4.ts — Ép IPv4 cho MỌI DNS lookup (side-effect, import đầu tiên trong app.ts).
 *
 * Lý do: VPS production KHÔNG có route IPv6 (connect IPv6 → ENETUNREACH/timeout), nhưng DNS của
 * Zalo (chat.zalo.me / wpa.chat.zalo.me + host upload ảnh) trả CẢ bản ghi AAAA (IPv6) lẫn A (IPv4).
 * Khi Node (global fetch / undici dùng trong zca-js) chạm địa chỉ IPv6, kết nối treo ~12s rồi ném
 * `ETIMEDOUT` → biểu hiện "fetch failed" khi gửi tin/ảnh nhóm (nhiều ảnh = nhiều kết nối song song
 * = càng dễ trúng IPv6 → fail/partial chập chờn).
 *
 * `dns.setDefaultResultOrder('ipv4first')` chỉ ĐỔI THỨ TỰ — undici (autoSelectFamily/Happy Eyeballs)
 * vẫn đua thử IPv6 và đôi khi treo. Nên ta CHẶN HẲN IPv6: ghi đè dns.lookup để luôn ép `family: 4`,
 * tức undici không bao giờ nhận địa chỉ IPv6. An toàn vì mọi đích đến đều có IPv4 (Zalo, CDN ảnh,
 * và nội bộ db/redis/minio đều IPv4).
 *
 * PHẢI import TRƯỚC mọi import khác để thiết lập trước khi có lookup nào.
 */
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

type LookupFn = typeof dns.lookup;
const origLookup = dns.lookup.bind(dns) as LookupFn;

// Ghi đè dns.lookup (callback API mà undici/Node http dùng) → luôn chèn family: 4.
// Giữ nguyên các option khác (all, hints…). Hỗ trợ 3 chữ ký: (host, cb) | (host, family, cb) | (host, opts, cb).
const patched = function lookup(hostname: string, options: unknown, callback?: unknown) {
  if (typeof options === 'function') {
    callback = options;
    options = { family: 4 };
  } else if (typeof options === 'number') {
    options = { family: 4 };
  } else {
    options = { ...(options as object), family: 4 };
  }
  return (origLookup as unknown as (h: string, o: unknown, c: unknown) => unknown)(hostname, options, callback);
};
(dns as unknown as { lookup: unknown }).lookup = patched;

// Patch luôn promises API phòng thư viện nào dùng dns.promises.lookup.
const origLookupP = dns.promises.lookup.bind(dns.promises);
(dns.promises as unknown as { lookup: unknown }).lookup = function lookup(hostname: string, options?: unknown) {
  const merged = typeof options === 'number'
    ? { family: 4 }
    : { ...((options as object) ?? {}), family: 4 };
  return (origLookupP as unknown as (h: string, o: unknown) => unknown)(hostname, merged);
};
