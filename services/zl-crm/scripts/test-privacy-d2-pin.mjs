// Test D1-D2: PIN lifecycle + flip privacy mode
import jwt from 'jsonwebtoken';

const USER_ID = '55ae009c-4d3a-4775-937d-e765f5af7ff7'; // owner
const ORG_ID = '50d7a1a4-5eec-42f3-a077-0ef7770d834c';
const API = 'http://localhost:3000/api/v1';
const secret = process.env.JWT_SECRET || 'devsecret-changeme-min-32-chars-long-please';
const token = jwt.sign({ userId: USER_ID, orgId: ORG_ID, role: 'owner' }, secret, { expiresIn: '5m' });

async function call(method, path, body, cookie) {
  const opts = {
    method,
    headers: { 'Authorization': 'Bearer ' + token },
  };
  if (cookie) opts.headers['Cookie'] = cookie;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') };
}

const results = [];
function assert(c, l) { results.push(c ? '✅ ' + l : '❌ ' + l); }

console.log('=== D1-D2 Privacy PIN lifecycle test ===');

// 1. Status — should have no PIN initially (sau khi reset)
const r0 = await call('GET', '/privacy/status');
console.log('Initial status:', JSON.stringify(r0.data));
assert(r0.status === 200, 'GET /privacy/status returns 200');

// 2. Setup PIN — wrong current password → 403
const r1 = await call('POST', '/privacy/setup-pin', { currentPassword: 'wrongpass', pin: '4554' });
assert(r1.status === 403, 'Setup PIN with wrong password → 403');

// Reset test state: PIN cleared via admin endpoint
const r2 = await call('POST', `/admin/privacy/reset-pin/${USER_ID}`);
console.log('Admin reset PIN:', r2.status);

// Note: owner password is unknown. Em assume default test setup hoặc skip này.
// Em sẽ test với direct DB setup bypass setup-pin endpoint.

// 3. Test unlock with invalid PIN format
const r3 = await call('POST', '/privacy/unlock', { pin: '12', durationMinutes: 60 });
assert(r3.status === 400 && r3.data.error?.includes('4 chữ số'), 'Invalid PIN format rejected');

// 4. Test unlock without PIN setup → 400
const r4 = await call('POST', '/privacy/unlock', { pin: '1234', durationMinutes: 60 });
console.log('Unlock no-pin:', JSON.stringify(r4.data));
assert(r4.status === 400 && r4.data.error?.includes('Chưa setup PIN'), 'Unlock without PIN setup → 400');

// 5. Test invalid duration
const r5 = await call('POST', '/privacy/unlock', { pin: '1234', durationMinutes: 30 });
assert(r5.status === 400, 'Invalid duration rejected');

// 6. Direct DB setup PIN qua admin endpoint chỉ clear, not set. Em insert hash trực tiếp qua psql.
// Em dùng workaround: dùng bcryptjs trong test script tạo hash, INSERT thẳng vào DB.
const { default: bcrypt } = await import('bcryptjs');
const testPin = '4554';
const testHash = await bcrypt.hash(testPin, 10);

// Use prisma directly is not available here; use SQL via execSync
// Import prisma client từ app codebase (đã có DATABASE_URL via env)
const { prisma } = await import('/app/dist/shared/database/prisma-client.js');
await prisma.user.update({
  where: { id: USER_ID },
  data: { privacyPinHash: testHash, privacyFailedCount: 0, privacyLockedUntil: null },
});

// 7. Unlock với PIN đúng
const r7 = await call('POST', '/privacy/unlock', { pin: testPin, durationMinutes: 60 });
console.log('Unlock success:', JSON.stringify(r7.data), 'Set-Cookie:', r7.setCookie);
assert(r7.status === 200 && r7.data.ok && r7.data.expiresAt, 'Unlock with correct PIN');
assert(r7.setCookie?.includes('priv_session=') && r7.setCookie?.includes('HttpOnly'), 'HttpOnly cookie set');

// Extract cookie for next calls
const cookieMatch = r7.setCookie?.match(/priv_session=([^;]+)/);
const sessionCookie = cookieMatch ? 'priv_session=' + cookieMatch[1] : null;

// 8. Status after unlock — should have active session
const r8 = await call('GET', '/privacy/status', null, sessionCookie);
assert(r8.data.activeSessionCount >= 1, 'Status shows active session');
assert(r8.data.hasPin === true, 'hasPin = true after setup');

// 9. Unlock với PIN sai
const r9 = await call('POST', '/privacy/unlock', { pin: '9999', durationMinutes: 60 });
assert(r9.status === 400 && r9.data.error?.includes('PIN sai'), 'Wrong PIN rejected with attempts counter');

// 10. Lock — revoke session
const r10 = await call('POST', '/privacy/lock', null, sessionCookie);
assert(r10.status === 200, 'Lock session OK');

// 11. Find Thành Hs Holding account và flip privacy mode
const accId = '01aca680-f657-4925-b48e-589d066447b9'; // Thành Hs Holding
const r11 = await call('PATCH', `/zalo-accounts/${accId}/privacy-mode`, { mode: 'main' });
console.log('Flip main:', JSON.stringify(r11.data));
assert(r11.status === 200 && r11.data.mode === 'main', 'Flip nick to main');

// 12. Verify DB
const dbCheck = await prisma.zaloAccount.findUnique({ where: { id: accId }, select: { privacyMode: true } });
assert(dbCheck?.privacyMode === 'main', 'DB privacy_mode = main');

// 13. Invalid mode → 400
const r13 = await call('PATCH', `/zalo-accounts/${accId}/privacy-mode`, { mode: 'invalid' });
assert(r13.status === 400, 'Invalid mode rejected');

// 14. Flip back to sub
const r14 = await call('PATCH', `/zalo-accounts/${accId}/privacy-mode`, { mode: 'sub' });
assert(r14.status === 200 && r14.data.mode === 'sub', 'Flip back to sub');

// 15. Different user (test-sale-1) cố flip nick của owner → 403
const saleUser = await prisma.user.findUnique({ where: { email: 'test-sale-1@rbac.local' }, select: { id: true } });
const saleUserId = saleUser?.id;
const saleToken = jwt.sign({ userId: saleUserId, orgId: ORG_ID, role: 'member' }, secret, { expiresIn: '5m' });
const r15 = await fetch(`${API}/zalo-accounts/${accId}/privacy-mode`, {
  method: 'PATCH',
  headers: { 'Authorization': 'Bearer ' + saleToken, 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'main' }),
});
const r15Data = await r15.json();
console.log('Sale flip owner nick:', r15.status, JSON.stringify(r15Data));
assert(r15.status === 403 && r15Data.error?.includes('owner'), 'Non-owner cannot flip nick');

// Cleanup
await prisma.user.update({
  where: { id: USER_ID },
  data: { privacyPinHash: null, privacyFailedCount: 0, privacyLockedUntil: null },
});
await prisma.userPrivacySession.deleteMany({ where: { userId: USER_ID } });

console.log('\n=== Results ===');
results.forEach((r) => console.log(r));
const pass = results.filter((r) => r.startsWith('✅')).length;
const fail = results.filter((r) => r.startsWith('❌')).length;
console.log(`\nTotal: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
