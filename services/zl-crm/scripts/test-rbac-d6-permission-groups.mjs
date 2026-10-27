// Test D5-6 PermissionGroup CRUD + grants matrix
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

const results = [];
function assert(cond, label) {
  results.push(cond ? '✅ ' + label : '❌ ' + label);
}

console.log('=== D5-6 PermissionGroup CRUD + grants test ===');

// Cleanup
const tree0 = await call('GET', '/permission-groups');
if (tree0.data.tree) {
  async function archiveAll(nodes) {
    for (const n of nodes) {
      await archiveAll(n.children);
      if (n.name.startsWith('TEST_')) await call('DELETE', '/permission-groups/' + n.id);
    }
  }
  await archiveAll(tree0.data.tree);
}

// 1. GET meta
const r0 = await call('GET', '/permission-groups/meta');
console.log('Meta resources:', r0.data.resources?.length, 'actions:', r0.data.actions?.length);
assert(r0.data.resources?.includes('contact'), 'Meta has contact resource');
assert(r0.data.actions?.includes('view_all'), 'Meta has view_all action');

// 2. Create custom group
const r1 = await call('POST', '/permission-groups', {
  name: 'TEST_Sale_Sr',
  grants: {
    conversation: { access: true, edit: true },
    contact: { access: true, create: true, edit: true },
    broadcast: { access: true },
    // Injection attempt — should be stripped
    fake_resource: { access: true },
    contact_with_fake_action: { hack: true },
  },
});
console.log('Create:', JSON.stringify(r1.data));
assert(r1.status === 200 && r1.data.group?.grants?.contact?.access === true, 'Create group with grants');
assert(!r1.data.group?.grants?.fake_resource, 'Injection: fake_resource stripped');
const grpId = r1.data.group?.id;

// 3. Update grants
const r2 = await call('PATCH', '/permission-groups/' + grpId, {
  grants: {
    conversation: { access: true, edit: true, delete: true, view_all: true },
    contact: { access: true, create: true, edit: true, delete: true, view_all: true },
  },
});
assert(r2.status === 200 && r2.data.group?.grants?.contact?.view_all === true, 'Update grants → view_all=true');

// 4. Get tree with member count
const r3 = await call('GET', '/permission-groups');
const testGroup = r3.data.tree.find((n) => n.name === 'TEST_Sale_Sr');
assert(testGroup, 'Test group in tree');
assert(testGroup?.memberCount === 0, 'Member count = 0 (chưa assign user)');

// 5. Self-parent attempt
const r4 = await call('PATCH', '/permission-groups/' + grpId, { parentId: grpId });
assert(r4.status === 400, 'Self-parent rejected');

// 6. Create child group (clone from parent)
const r5 = await call('POST', '/permission-groups', {
  name: 'TEST_Sale_Junior',
  parentId: grpId,
  cloneFromId: grpId,
});
assert(r5.status === 200 && r5.data.group?.grants?.contact?.view_all === true, 'Clone group inherits grants');
const childId = r5.data.group?.id;

// 7. Move parent into child → cycle
const r6 = await call('PATCH', '/permission-groups/' + grpId, { parentId: childId });
assert(r6.status === 400, 'Cycle move rejected');

// 8. Archive child (no members, no sub) → OK
const r7 = await call('DELETE', '/permission-groups/' + childId);
console.log('Archive child status:', r7.status, JSON.stringify(r7.data));
assert(r7.status === 200, 'Archive empty group OK');

// 9. Archive parent (now has no sub) → OK
const r8 = await call('DELETE', '/permission-groups/' + grpId);
console.log('Archive parent status:', r8.status, JSON.stringify(r8.data));
assert(r8.status === 200, 'Archive parent (after child archived) OK');

console.log('\n=== Results ===');
results.forEach((r) => console.log(r));
const pass = results.filter((r) => r.startsWith('✅')).length;
const fail = results.filter((r) => r.startsWith('❌')).length;
console.log(`\nTotal: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
