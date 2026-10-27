// Setup dept tree HS + gán 6 test user theo sơ đồ:
//   Chủ tổ chức (Anh = root member)
//      └─ Phòng Kinh Doanh
//          └─ PKD 1
//              ├─ Trưởng phòng: test-manager
//              ├─ Phó phòng:    test-deputy
//              └─ Nhân viên:    test-sale-sr, test-sale-1
//          └─ PKD 2
//              └─ Nhân viên:    test-sale-2
//      └─ Marketing
//          └─ Nhân viên:        test-mkt
//
// Verify:
// - Trưởng/Phó PKD1 xem được sale-sr + sale-1 (cùng dept)
// - Trưởng PKD1 KHÔNG xem được sale-2 (PKD2, peer)
// - Anh = root → xem được tất cả
import jwt from 'jsonwebtoken';

const OWNER_ID = '55ae009c-4d3a-4775-937d-e765f5af7ff7';
const ORG_ID = '50d7a1a4-5eec-42f3-a077-0ef7770d834c';
const API = 'http://localhost:3000/api/v1';
const secret = process.env.JWT_SECRET || 'devsecret-changeme-min-32-chars-long-please';

const { prisma } = await import('/app/dist/shared/database/prisma-client.js');

const ownerToken = jwt.sign({ userId: OWNER_ID, orgId: ORG_ID, role: 'owner' }, secret, { expiresIn: '5m' });

async function call(token, method, path, body) {
  const opts = { method, headers: { 'Authorization': 'Bearer ' + token } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(API + path, opts);
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

// Map test users
const testUsers = await prisma.user.findMany({
  where: { email: { startsWith: 'test-' } },
  select: { id: true, email: true, fullName: true },
});
const userByEmail = Object.fromEntries(testUsers.map((u) => [u.email, u]));

const results = [];
function assert(c, l) { results.push(c ? '✅ ' + l : '❌ ' + l); }

console.log('=== Setup HS org hierarchy ===');

// 1. Cleanup test depts từ runs trước (any name starts with 'HS_')
const tree0 = await call(ownerToken, 'GET', '/departments');
async function archiveTree(nodes) {
  for (const n of nodes) {
    await archiveTree(n.children ?? []);
    if (n.name.startsWith('HS_')) {
      // remove members first
      for (const m of (await prisma.departmentMember.findMany({ where: { departmentId: n.id }, select: { userId: true } }))) {
        await call(ownerToken, 'DELETE', `/departments/${n.id}/members/${m.userId}`);
      }
      await call(ownerToken, 'DELETE', `/departments/${n.id}`);
    }
  }
}
await archiveTree(tree0.data.tree ?? []);

// 2. Create dept tree (root → KD → PKD1, PKD2 + Marketing)
async function createDept(name, parentId = null) {
  const r = await call(ownerToken, 'POST', '/departments', { name, parentId });
  if (r.status !== 200) throw new Error(`Create ${name}: ${JSON.stringify(r.data)}`);
  return r.data.department.id;
}

const rootId = await createDept('HS_Chu_To_Chuc');
const kdId = await createDept('HS_Phong_Kinh_Doanh', rootId);
const pkd1Id = await createDept('HS_PKD_1', kdId);
const pkd2Id = await createDept('HS_PKD_2', kdId);
const mktId = await createDept('HS_Marketing', rootId);

console.log('Dept tree created:');
console.log(`  Root: ${rootId.slice(0,8)}`);
console.log(`  KD:   ${kdId.slice(0,8)}`);
console.log(`  PKD1: ${pkd1Id.slice(0,8)}`);
console.log(`  PKD2: ${pkd2Id.slice(0,8)}`);
console.log(`  MKT:  ${mktId.slice(0,8)}`);

assert(rootId && kdId && pkd1Id && pkd2Id && mktId, 'Tree 5 dept created');

// 3. Verify tree structure
const tree = await call(ownerToken, 'GET', '/departments');
const hsRoot = tree.data.tree.find((n) => n.name === 'HS_Chu_To_Chuc');
assert(hsRoot?.depth === 0, 'Root depth=0');
assert(hsRoot?.children?.length === 2, 'Root có 2 con (KD + Marketing)');
const kd = hsRoot.children.find((n) => n.name === 'HS_Phong_Kinh_Doanh');
assert(kd?.depth === 1 && kd?.children?.length === 2, 'KD depth=1, có PKD1 + PKD2');

// 4. Assign 6 test users vào dept tree
async function assignMember(deptId, userId, deptRole) {
  const r = await call(ownerToken, 'POST', `/departments/${deptId}/members`, { userId, deptRole });
  return r.status === 200;
}

// PKD1: manager leader, deputy phó, sale-sr + sale-1 member
assert(await assignMember(pkd1Id, userByEmail['test-manager@rbac.local'].id, 'leader'), 'PKD1 leader = test-manager');
assert(await assignMember(pkd1Id, userByEmail['test-deputy@rbac.local'].id, 'deputy'), 'PKD1 deputy = test-deputy');
assert(await assignMember(pkd1Id, userByEmail['test-sale-sr@rbac.local'].id, 'member'), 'PKD1 member = test-sale-sr');
assert(await assignMember(pkd1Id, userByEmail['test-sale-1@rbac.local'].id, 'member'), 'PKD1 member = test-sale-1');

// PKD2: sale-2 member (chưa có leader/deputy)
assert(await assignMember(pkd2Id, userByEmail['test-sale-2@rbac.local'].id, 'member'), 'PKD2 member = test-sale-2');

// Marketing: mkt user
assert(await assignMember(mktId, userByEmail['test-mkt@rbac.local'].id, 'member'), 'Marketing member = test-mkt');

// CEO user: vào root làm member
assert(await assignMember(rootId, userByEmail['test-ceo@rbac.local'].id, 'member'), 'Root member = test-ceo');

// 5. Verify users-under-dept (cascade subtree)
const usersUnderPkd1 = await call(ownerToken, 'GET', `/departments/${pkd1Id}/members-tree`);
console.log('\nUsers under PKD1:', usersUnderPkd1.data.userIds?.length);
assert(usersUnderPkd1.data.userIds?.length === 4, 'PKD1 có 4 users (leader+deputy+2 member)');

const usersUnderKd = await call(ownerToken, 'GET', `/departments/${kdId}/members-tree`);
console.log('Users under KD:', usersUnderKd.data.userIds?.length);
assert(usersUnderKd.data.userIds?.length === 5, 'KD có 5 users (PKD1: 4 + PKD2: 1) — cascade subtree');

const usersUnderRoot = await call(ownerToken, 'GET', `/departments/${rootId}/members-tree`);
console.log('Users under Root:', usersUnderRoot.data.userIds?.length);
assert(usersUnderRoot.data.userIds?.length === 7, 'Root có 7 users (CEO + 4 PKD1 + 1 PKD2 + 1 MKT)');

// 6. Verify peer KHÔNG cross-visible
const usersUnderPkd2 = await call(ownerToken, 'GET', `/departments/${pkd2Id}/members-tree`);
console.log('Users under PKD2:', usersUnderPkd2.data.userIds);
assert(usersUnderPkd2.data.userIds?.length === 1, 'PKD2 chỉ 1 user (sale-2) — không leak sang PKD1');
const pkd1UserIds = (await call(ownerToken, 'GET', `/departments/${pkd1Id}/members-tree`)).data.userIds;
assert(!pkd1UserIds.includes(userByEmail['test-sale-2@rbac.local'].id), 'sale-2 (PKD2) KHÔNG nằm trong PKD1 subtree (peer isolation)');

// 7. Sale-1 chuyển từ PKD1 → PKD2 (Q9 KH theo user)
await assignMember(pkd2Id, userByEmail['test-sale-1@rbac.local'].id, 'member');
const pkd1After = (await call(ownerToken, 'GET', `/departments/${pkd1Id}/members-tree`)).data.userIds;
const pkd2After = (await call(ownerToken, 'GET', `/departments/${pkd2Id}/members-tree`)).data.userIds;
assert(!pkd1After.includes(userByEmail['test-sale-1@rbac.local'].id), 'sale-1 rời PKD1');
assert(pkd2After.includes(userByEmail['test-sale-1@rbac.local'].id), 'sale-1 vào PKD2');
assert(pkd1After.length === 3, 'PKD1 còn 3 user (leader+deputy+sale-sr)');

// 8. Verify Org structure final
console.log('\n=== Final Org Structure ===');
const finalTree = await call(ownerToken, 'GET', '/departments');
function printTree(nodes, indent = 0) {
  for (const n of nodes) {
    if (!n.name.startsWith('HS_')) continue;
    const prefix = '  '.repeat(indent) + (indent > 0 ? '└─ ' : '');
    const leader = n.leaderUserId ? testUsers.find((u) => u.id === n.leaderUserId)?.email : null;
    const deputy = n.deputyUserId ? testUsers.find((u) => u.id === n.deputyUserId)?.email : null;
    const roleStr = leader ? ` [trưởng: ${leader.replace('test-', '').replace('@rbac.local', '')}]` : '';
    const dpStr = deputy ? ` [phó: ${deputy.replace('test-', '').replace('@rbac.local', '')}]` : '';
    console.log(`${prefix}${n.name} (${n.memberCount} người)${roleStr}${dpStr}`);
    if (n.children?.length) printTree(n.children, indent + 1);
  }
}
printTree(finalTree.data.tree);

console.log('\n=== Results ===');
results.forEach((r) => console.log(r));
const pass = results.filter((r) => r.startsWith('✅')).length;
const fail = results.filter((r) => r.startsWith('❌')).length;
console.log(`\nTotal: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
