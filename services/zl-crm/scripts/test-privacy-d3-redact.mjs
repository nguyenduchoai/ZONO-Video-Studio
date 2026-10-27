// Test D3: Server redact filter cross-user
// Flow: owner flip nick=main → sale-1 query conv messages → content blur ▒.
//       Owner unlock PIN → query lại → content full.
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const OWNER_ID = '55ae009c-4d3a-4775-937d-e765f5af7ff7';
const ORG_ID = '50d7a1a4-5eec-42f3-a077-0ef7770d834c';
const HOLDING_NICK_ID = '01aca680-f657-4925-b48e-589d066447b9';
const API = 'http://localhost:3000/api/v1';
const secret = process.env.JWT_SECRET || 'devsecret-changeme-min-32-chars-long-please';

const { prisma } = await import('/app/dist/shared/database/prisma-client.js');

const ownerToken = jwt.sign({ userId: OWNER_ID, orgId: ORG_ID, role: 'owner' }, secret, { expiresIn: '5m' });

const saleUser = await prisma.user.findUnique({ where: { email: 'test-sale-1@rbac.local' }, select: { id: true } });
const SALE_ID = saleUser.id;
const saleToken = jwt.sign({ userId: SALE_ID, orgId: ORG_ID, role: 'member' }, secret, { expiresIn: '5m' });

async function call(token, method, path, body, cookie) {
  const opts = { method, headers: { 'Authorization': 'Bearer ' + token } };
  if (cookie) opts.headers['Cookie'] = cookie;
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') };
}

const results = [];
function assert(c, l) { results.push(c ? '✅ ' + l : '❌ ' + l); }

console.log('=== D3 Server redact cross-user test ===');

// Setup: find 1 conv của Holding nick + flip to main
const conv = await prisma.conversation.findFirst({
  where: { zaloAccountId: HOLDING_NICK_ID, threadType: 'user' },
  select: { id: true, externalThreadId: true },
});
console.log('Test conv:', conv?.id);
if (!conv) { console.log('No conv found, abort'); process.exit(1); }

// Setup: grant sale-1 access vào Holding nick (qua ZaloAccountAccess)
// để bypass RBAC layer 1 (requireZaloAccess), test Privacy layer 2 redact.
await prisma.zaloAccountAccess.upsert({
  where: { zaloAccountId_userId: { zaloAccountId: HOLDING_NICK_ID, userId: SALE_ID } },
  update: { permission: 'chat' },
  create: { zaloAccountId: HOLDING_NICK_ID, userId: SALE_ID, permission: 'chat' },
}).catch(async () => {
  // Fallback nếu unique key tên khác
  await prisma.zaloAccountAccess.deleteMany({ where: { zaloAccountId: HOLDING_NICK_ID, userId: SALE_ID } });
  await prisma.zaloAccountAccess.create({
    data: { zaloAccountId: HOLDING_NICK_ID, userId: SALE_ID, permission: 'chat' },
  });
});

// Cleanup: ensure clean state
await prisma.zaloAccount.update({ where: { id: HOLDING_NICK_ID }, data: { privacyMode: 'sub' } });

// Setup PIN for owner
const testPin = '4554';
const hash = await bcrypt.hash(testPin, 10);
await prisma.user.update({ where: { id: OWNER_ID }, data: { privacyPinHash: hash, privacyFailedCount: 0, privacyLockedUntil: null } });

// 1. SUB mode — owner query → content visible
const r1 = await call(ownerToken, 'GET', `/conversations/${conv.id}/messages?limit=5`);
console.log('r1 status:', r1.status, 'data type:', typeof r1.data, 'keys:', r1.data ? Object.keys(r1.data) : null);
console.log('r1 sample:', JSON.stringify(r1.data).slice(0, 300));
const hasContent1 = r1.data?.messages?.some((m) => m.content && !m.redacted);
assert(r1.status === 200 && hasContent1, 'Sub mode: owner sees content');

// 2. SUB mode — sale-1 cũng thấy content (vì sub-nick, no privacy)
const r2 = await call(saleToken, 'GET', `/conversations/${conv.id}/messages?limit=5`);
const hasContent2 = r2.data?.messages?.some((m) => m.content && !m.redacted);
console.log('Sale sub-mode messages sample:', JSON.stringify(r2.data?.messages?.[0]?.content?.slice(0, 30)));
assert(r2.status === 200 && hasContent2, 'Sub mode: sale-1 sees content');

// 3. Flip to MAIN
await call(ownerToken, 'PATCH', `/zalo-accounts/${HOLDING_NICK_ID}/privacy-mode`, { mode: 'main' });

// 4. MAIN + sale-1 (non-owner) → content redacted to ▒▒▒▒
const r4 = await call(saleToken, 'GET', `/conversations/${conv.id}/messages?limit=5`);
const allRedacted4 = r4.data?.messages?.every((m) => m.content === '▒'.repeat(8) || m.redacted);
console.log('Sale main-mode messages sample:', JSON.stringify(r4.data?.messages?.[0]));
assert(r4.status === 200 && allRedacted4, 'Main mode: sale-1 sees ▒▒▒▒ (redacted)');

// 5. MAIN + owner KHÔNG unlock → content cũng bị redact (anh chốt Q2 sale sau unlock kế mới xem được)
const r5 = await call(ownerToken, 'GET', `/conversations/${conv.id}/messages?limit=5`);
const allRedacted5 = r5.data?.messages?.every((m) => m.content === '▒'.repeat(8) || m.redacted);
assert(r5.status === 200 && allRedacted5, 'Main mode: owner (no PIN) sees ▒▒▒▒');

// 6. Owner unlock PIN
const unlockRes = await call(ownerToken, 'POST', '/privacy/unlock', { pin: testPin, durationMinutes: 60 });
const cookieMatch = unlockRes.setCookie?.match(/priv_session=([^;]+)/);
const ownerCookie = cookieMatch ? 'priv_session=' + cookieMatch[1] : null;
console.log('Owner cookie:', ownerCookie?.slice(0, 40));
assert(unlockRes.status === 200, 'Owner unlock PIN OK');

// 7. MAIN + owner unlocked → content visible
const r7 = await call(ownerToken, 'GET', `/conversations/${conv.id}/messages?limit=5`, null, ownerCookie);
const hasContent7 = r7.data?.messages?.some((m) => m.content && !m.redacted && m.content !== '▒'.repeat(8));
console.log('Owner unlocked sample:', JSON.stringify(r7.data?.messages?.[0]?.content?.slice(0, 30)));
assert(r7.status === 200 && hasContent7, 'Main mode + unlock: owner sees content');

// 8. Even with owner cookie, sale-1 (other token) shouldn't gain access
const r8 = await call(saleToken, 'GET', `/conversations/${conv.id}/messages?limit=5`, null, ownerCookie);
// Cookie is for OWNER session, sale token = sale-1 → session belongs to OWNER, not sale-1.
// resolveSession returns OWNER, but request.user is sale-1 → mismatch → privacyUnlocked = false.
const allRedacted8 = r8.data?.messages?.every((m) => m.content === '▒'.repeat(8) || m.redacted);
assert(allRedacted8, 'Sale with stolen owner cookie still sees ▒▒▒▒ (token-user mismatch protection)');

// 9. Contact PII redact
const contactWithMainConv = await prisma.contact.findFirst({
  where: {
    friends: { some: { zaloAccountId: HOLDING_NICK_ID } },
  },
  select: { id: true, fullName: true },
});
if (contactWithMainConv) {
  const r9 = await call(saleToken, 'GET', `/contacts/${contactWithMainConv.id}`);
  console.log('Contact for sale:', JSON.stringify(r9.data?.fullName), 'redacted=', r9.data?.redacted);
  assert(r9.data?.redacted === true && r9.data?.fullName === '▒'.repeat(8), 'Contact PII redacted for sale-1 (non-owner)');

  // Owner unlocked sees full
  const r10 = await call(ownerToken, 'GET', `/contacts/${contactWithMainConv.id}`, null, ownerCookie);
  console.log('Contact for owner unlocked:', JSON.stringify(r10.data?.fullName));
  assert(!r10.data?.redacted && r10.data?.fullName && r10.data?.fullName !== '▒'.repeat(8), 'Contact PII full for owner unlocked');
}

// Cleanup
await prisma.zaloAccount.update({ where: { id: HOLDING_NICK_ID }, data: { privacyMode: 'sub' } });
await prisma.user.update({ where: { id: OWNER_ID }, data: { privacyPinHash: null, privacyFailedCount: 0, privacyLockedUntil: null } });
await prisma.userPrivacySession.deleteMany({ where: { userId: OWNER_ID } });
await prisma.zaloAccountAccess.deleteMany({ where: { zaloAccountId: HOLDING_NICK_ID, userId: SALE_ID } });

console.log('\n=== Results ===');
results.forEach((r) => console.log(r));
const pass = results.filter((r) => r.startsWith('✅')).length;
const fail = results.filter((r) => r.startsWith('❌')).length;
console.log(`\nTotal: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
