// Test D7 User assignment + seed default groups + create test users
import jwt from 'jsonwebtoken';

const USER_ID = '55ae009c-4d3a-4775-937d-e765f5af7ff7';
const ORG_ID = '50d7a1a4-5eec-42f3-a077-0ef7770d834c';
const API = 'http://localhost:3000/api/v1';

const secret = process.env.JWT_SECRET || 'devsecret-changeme-min-32-chars-long-please';
const token = jwt.sign({ userId: USER_ID, orgId: ORG_ID, role: 'owner' }, secret, { expiresIn: '5m' });

async function call(method, path, body) {
  const opts = { method, headers: { 'Authorization': 'Bearer ' + token } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

const results = [];
function assert(c, l) { results.push(c ? '✅ ' + l : '❌ ' + l); }

console.log('=== D7 User assignment + seed default groups ===');

// 1. Seed 7 default groups
const r1 = await call('POST', '/admin/rbac/seed-default-groups');
console.log('Seed result:', JSON.stringify(r1.data));
assert(r1.status === 200 && r1.data.ok, 'Seed default groups');
const groupNames = r1.data.groups?.map((g) => g.name) ?? [];
assert(groupNames.includes('Admin'), 'Admin group seeded');
assert(groupNames.includes('Trưởng phòng'), 'Trưởng phòng group seeded');
assert(groupNames.includes('Sale Senior'), 'Sale Senior group seeded');
assert(groupNames.includes('Marketing'), 'Marketing group seeded');
assert(groupNames.includes('Hành chính - Nhân sự'), 'HC-NS group seeded');
assert(groupNames.length === 7, '7 groups total');

// 2. Idempotent — run again, all existing
const r2 = await call('POST', '/admin/rbac/seed-default-groups');
assert(r2.data.existing === 7 && r2.data.created === 0, 'Seed idempotent (re-run = all existing)');

// 3. Migrate legacy users role → group
const r3 = await call('POST', '/admin/rbac/migrate-legacy-users');
console.log('Migrate result:', JSON.stringify(r3.data));
assert(r3.status === 200, 'Migrate legacy users');

// 4. Create test users (6 users for D14-15 e2e)
const r4 = await call('POST', '/admin/rbac/create-test-users');
console.log('Create test users:', JSON.stringify(r4.data));
assert(r4.status === 200, 'Create test users');
assert(r4.data.defaultPassword === 'Test@1234', 'Default password returned');

// 5. List users
const r5 = await call('GET', '/rbac/users');
console.log('Users count:', r5.data.users?.length);
assert(r5.status === 200 && Array.isArray(r5.data.users), 'List users OK');
assert(r5.data.users?.length >= 7, 'List has >= 7 users (1 owner + 6+ test users)');

// 6. Filter by permission group (Sale)
const saleGroup = r1.data.groups.find((g) => g.name === 'Sale');
const r6 = await call('GET', '/rbac/users?permissionGroupId=' + saleGroup.id);
console.log('Sale users:', r6.data.users?.length);
assert(r6.data.users?.length >= 2, 'Filter by Sale group works');

// 7. Search by name
const r7 = await call('GET', '/rbac/users?q=TEST%20Sale%20Senior');
assert(r7.data.users?.length === 1, 'Search by name works');

// 8. Test user có permission group đúng
const testSaleSenior = r5.data.users.find((u) => u.email === 'test-sale-sr@rbac.local');
assert(testSaleSenior?.permissionGroup?.name === 'Sale Senior', 'Test user has Sale Senior group');

// 9. PATCH user group
const ceoGroup = r1.data.groups.find((g) => g.name === 'CEO');
const r9 = await call('PATCH', '/rbac/users/' + testSaleSenior.id + '/permission-group', {
  permissionGroupId: ceoGroup.id,
});
assert(r9.status === 200, 'PATCH user group OK');

// Revert
await call('PATCH', '/rbac/users/' + testSaleSenior.id + '/permission-group', {
  permissionGroupId: r1.data.groups.find((g) => g.name === 'Sale Senior').id,
});

// 10. Verify default group is_system protected (cant rename Admin)
const adminGroup = r1.data.groups.find((g) => g.name === 'Admin');
const r10 = await call('PATCH', '/permission-groups/' + adminGroup.id, { name: 'HACKED_ADMIN' });
assert(r10.status === 400 && r10.data.error?.includes('hệ thống'), 'System group rename blocked');

console.log('\n=== Results ===');
results.forEach((r) => console.log(r));
const pass = results.filter((r) => r.startsWith('✅')).length;
const fail = results.filter((r) => r.startsWith('❌')).length;
console.log(`\nTotal: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
