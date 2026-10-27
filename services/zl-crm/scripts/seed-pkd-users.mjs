// Seed/reset test users for PKD_1 + PKD_2 — 7 nick/phòng × 2 = 14 nick.
// Naming: "PKD1 Trưởng phòng" / "PKD1 Phó phòng" / "PKD1 Nhân viên 1..5"
// Email: tp-pkd1@hs.test / pp-pkd1@hs.test / nv1-pkd1@hs.test ... nv5-pkd1@hs.test
// Password chung: Test@1234
//
// Idempotent: re-run sẽ wipe @hs.test users + recreate fresh.
import bcrypt from 'bcryptjs';

const ORG_ID = '50d7a1a4-5eec-42f3-a077-0ef7770d834c';
const PASSWORD = 'Test@1234';
const { prisma } = await import('/app/dist/shared/database/prisma-client.js');

const PKDS = [
  { code: 'PKD1', deptName: 'HS_PKD_1' },
  { code: 'PKD2', deptName: 'HS_PKD_2' },
];

const passHash = await bcrypt.hash(PASSWORD, 10);

// Load permission groups (Trưởng phòng / Sale Senior / Sale)
const groups = await prisma.permissionGroup.findMany({
  where: { orgId: ORG_ID, isSystem: true },
  select: { id: true, name: true },
});
const groupByName = new Map(groups.map((g) => [g.name, g.id]));
const GROUP_TRUONG = groupByName.get('Trưởng phòng') ?? null;
const GROUP_SALE_SR = groupByName.get('Sale Senior') ?? null;
const GROUP_SALE = groupByName.get('Sale') ?? null;
console.log('Permission groups:', { GROUP_TRUONG, GROUP_SALE_SR, GROUP_SALE });

// 1) Wipe all @hs.test users (idempotent reset)
const wiped = await prisma.user.findMany({
  where: { orgId: ORG_ID, email: { endsWith: '@hs.test' } },
  select: { id: true, email: true },
});
if (wiped.length > 0) {
  await prisma.departmentMember.deleteMany({ where: { userId: { in: wiped.map((u) => u.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: wiped.map((u) => u.id) } } });
  console.log(`Wiped ${wiped.length} old @hs.test users`);
}

// 2) Also wipe @rbac.local TEST users in PKD_1/PKD_2 to clean tree state
for (const { deptName } of PKDS) {
  const dept = await prisma.department.findFirst({ where: { orgId: ORG_ID, name: deptName } });
  if (!dept) continue;
  const oldMembers = await prisma.departmentMember.findMany({
    where: { departmentId: dept.id },
    include: { user: { select: { id: true, email: true } } },
  });
  for (const m of oldMembers) {
    if (m.user.email.includes('@rbac.local')) {
      await prisma.departmentMember.delete({ where: { id: m.id } });
      await prisma.user.update({
        where: { id: m.user.id },
        data: { isActive: false, email: `legacy-${m.user.id.slice(0, 8)}@disabled.local` },
      });
      console.log(`   archived legacy: ${m.user.email}`);
    }
  }
}

// 3) Create 7 users per PKD
let totalCreated = 0;
for (const { code, deptName } of PKDS) {
  const dept = await prisma.department.findFirst({ where: { orgId: ORG_ID, name: deptName } });
  if (!dept) {
    console.error(`❌ Dept ${deptName} not found`);
    continue;
  }

  const seedSpec = [
    { role: 'leader', name: `${code} Trưởng phòng`, email: `tp-${code.toLowerCase()}@hs.test`, group: GROUP_TRUONG },
    { role: 'deputy', name: `${code} Phó phòng`, email: `pp-${code.toLowerCase()}@hs.test`, group: GROUP_SALE_SR },
    ...Array.from({ length: 5 }, (_, i) => ({
      role: 'member',
      name: `${code} Nhân viên ${i + 1}`,
      email: `nv${i + 1}-${code.toLowerCase()}@hs.test`,
      group: GROUP_SALE,
    })),
  ];

  for (const u of seedSpec) {
    const created = await prisma.user.create({
      data: {
        orgId: ORG_ID,
        email: u.email,
        passwordHash: passHash,
        fullName: u.name,
        role: 'member',
        permissionGroupId: u.group,
        isActive: true,
      },
    });
    await prisma.departmentMember.create({
      data: {
        departmentId: dept.id,
        userId: created.id,
        deptRole: u.role,
      },
    });
    console.log(`   ✅ [${deptName}] ${u.role}: ${u.name} → ${u.email}`);
    totalCreated++;
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Created: ${totalCreated} users (7 × 2 phòng)`);
console.log(`Password chung: ${PASSWORD}`);
console.log(`\nEmail login:`);
for (const { code } of PKDS) {
  const c = code.toLowerCase();
  console.log(`  ${code}: tp-${c}@hs.test (TP) · pp-${c}@hs.test (PP) · nv1..5-${c}@hs.test (NV)`);
}

await prisma.$disconnect();
