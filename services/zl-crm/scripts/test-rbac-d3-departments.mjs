// Test D3 Department CRUD endpoints
import jwt from 'jsonwebtoken';

const USER_ID = '55ae009c-4d3a-4775-937d-e765f5af7ff7';
const ORG_ID = '50d7a1a4-5eec-42f3-a077-0ef7770d834c';
const API = 'http://localhost:3000/api/v1';

const secret = process.env.JWT_SECRET || 'devsecret-changeme-min-32-chars-long-please';
const token = jwt.sign({ userId: USER_ID, orgId: ORG_ID, role: 'owner' }, secret, { expiresIn: '5m' });

async function call(method, path, body) {
  const opts = {
    method,
    headers: { 'Authorization': 'Bearer ' + token },
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

let results = [];
function assert(cond, label) {
  if (cond) {
    results.push('✅ ' + label);
  } else {
    results.push('❌ ' + label);
  }
}

console.log('=== D3 Department CRUD test ===');

// 1. Cleanup test data từ runs trước — remove member trước khi archive
console.log('\n[Cleanup]');
await call('DELETE', '/departments/_/members/' + USER_ID).catch(() => {});
const tree0 = await call('GET', '/departments');
if (tree0.data.tree) {
  // archive recursively bottom-up
  async function archiveTree(nodes) {
    for (const n of nodes) {
      await archiveTree(n.children);
      if (n.name.startsWith('TEST_')) {
        await call('DELETE', '/departments/' + n.id);
      }
    }
  }
  await archiveTree(tree0.data.tree);
}

// 2. Create root
console.log('\n[Create root]');
const r1 = await call('POST', '/departments', { name: 'TEST_Ban_GD' });
console.log('Status:', r1.status, JSON.stringify(r1.data));
assert(r1.status === 200 && r1.data.ok && r1.data.department.depth === 0, 'Create root dept');
const rootId = r1.data.department?.id;

// 3. Create child
console.log('\n[Create child level 1]');
const r2 = await call('POST', '/departments', { name: 'TEST_KD', parentId: rootId });
console.log('Status:', r2.status, JSON.stringify(r2.data));
assert(r2.status === 200 && r2.data.department.depth === 1, 'Create level-1 dept');
const kdId = r2.data.department?.id;

// 4. Create grandchild
console.log('\n[Create level 2]');
const r3 = await call('POST', '/departments', { name: 'TEST_PKD1', parentId: kdId });
console.log('Status:', r3.status, JSON.stringify(r3.data));
assert(r3.status === 200 && r3.data.department.depth === 2, 'Create level-2 dept');
const pkd1Id = r3.data.department?.id;

// 5. GET tree
console.log('\n[GET tree]');
const r4 = await call('GET', '/departments');
const testTree = r4.data.tree.filter((n) => n.name.startsWith('TEST_'));
console.log('Found', testTree.length, 'test roots, root has', testTree[0]?.children?.length, 'children');
assert(testTree.length === 1, 'GET tree returns 1 test root');
assert(testTree[0]?.children?.[0]?.name === 'TEST_KD', 'Root child = TEST_KD');
assert(testTree[0]?.children?.[0]?.children?.[0]?.name === 'TEST_PKD1', 'Level 2 = TEST_PKD1');

// 6. UPDATE rename
console.log('\n[Update rename]');
const r5 = await call('PATCH', '/departments/' + pkd1Id, { name: 'TEST_PKD1_renamed' });
console.log('Status:', r5.status, JSON.stringify(r5.data));
assert(r5.status === 200, 'Rename dept');

// 7. UPDATE move PKD1 thành con của root (skip KD)
console.log('\n[Move dept]');
const r6 = await call('PATCH', '/departments/' + pkd1Id, { parentId: rootId });
console.log('Status:', r6.status, JSON.stringify(r6.data));
assert(r6.status === 200 && r6.data.department.depth === 1, 'Move dept depth recompute');

// 8. Move into self → must fail
console.log('\n[Move into self - must fail]');
const r7 = await call('PATCH', '/departments/' + rootId, { parentId: rootId });
console.log('Status:', r7.status, JSON.stringify(r7.data));
assert(r7.status === 400, 'Move into self rejected');

// 9. Move into own subtree → must fail
console.log('\n[Move root into PKD1 (cycle) - must fail]');
const r8 = await call('PATCH', '/departments/' + rootId, { parentId: pkd1Id });
console.log('Status:', r8.status, JSON.stringify(r8.data));
assert(r8.status === 400, 'Move into own subtree rejected');

// 10. Assign user thành leader
console.log('\n[Assign leader]');
const r9 = await call('POST', '/departments/' + rootId + '/members', {
  userId: USER_ID,
  deptRole: 'leader',
});
console.log('Status:', r9.status, JSON.stringify(r9.data));
assert(r9.status === 200, 'Assign user as leader');

// 11. Get tree → leader id should appear
const r10 = await call('GET', '/departments');
const root = r10.data.tree.find((n) => n.name === 'TEST_Ban_GD');
assert(root?.leaderUserId === USER_ID, 'Tree shows leaderUserId');
assert(root?.memberCount === 1, 'Member count = 1');

// 12. Try assign another user as leader (must fail with 409)
console.log('\n[Re-assign same user as deputy (move within dept)]');
const r11 = await call('POST', '/departments/' + rootId + '/members', {
  userId: USER_ID,
  deptRole: 'deputy',
});
console.log('Status:', r11.status, JSON.stringify(r11.data));
assert(r11.status === 200, 'Re-assign role of same user OK');

// 13. Get members tree
const r12 = await call('GET', '/departments/' + rootId + '/members-tree');
assert(r12.data.userIds?.includes(USER_ID), 'Members-tree includes user under root');

// 14. Archive dept có member → must fail
console.log('\n[Archive dept with members - must fail]');
const r13 = await call('DELETE', '/departments/' + rootId);
console.log('Status:', r13.status, JSON.stringify(r13.data));
assert(r13.status === 400, 'Archive with members rejected');

// 15. Cleanup: remove user → archive bottom-up
await call('DELETE', '/departments/' + rootId + '/members/' + USER_ID);
await call('DELETE', '/departments/' + pkd1Id);
await call('DELETE', '/departments/' + kdId);
await call('DELETE', '/departments/' + rootId);

console.log('\n=== Results ===');
results.forEach((r) => console.log(r));
const pass = results.filter((r) => r.startsWith('✅')).length;
const fail = results.filter((r) => r.startsWith('❌')).length;
console.log(`\nTotal: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
