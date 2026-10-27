<template>
  <div class="dept-page">
    <header class="page-hero">
      <div class="hero-left">
        <h1 class="hero-title">Nhân viên</h1>
        <p class="hero-sub">Quản lý người dùng tổ chức · Phân phòng ban · Gán nhóm quyền · Vô hiệu hóa khi nghỉ việc</p>
      </div>
      <div class="hero-right" v-if="canCreateUser">
        <button class="btn-primary" @click="openCreate">＋ Thêm nhân viên</button>
      </div>
    </header>

    <section class="stats-row" v-if="!loading && stats.total > 0">
      <div class="stat-card stat-primary">
        <div class="stat-label">Tổng nhân viên</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card stat-forest">
        <div class="stat-label">Đang hoạt động</div>
        <div class="stat-value">{{ stats.active }}<span class="stat-unit"> / {{ stats.total }}</span></div>
      </div>
      <div class="stat-card stat-mustard">
        <div class="stat-label">Đã gán phòng ban</div>
        <div class="stat-value">{{ stats.withDept }}<span class="stat-unit"> / {{ stats.total }}</span></div>
      </div>
      <div class="stat-card stat-cream">
        <div class="stat-label">Đã gán nhóm quyền</div>
        <div class="stat-value">{{ stats.withGroup }}<span class="stat-unit"> / {{ stats.total }}</span></div>
      </div>
    </section>

    <!-- Filter bar -->
    <div class="at-toolbar" v-if="!loading && store.users.length > 0">
      <div class="search-box at-search">
        <span class="search-icon">🔍</span>
        <input v-model="searchQ" placeholder="Tìm tên / email..." @input="applyFilter" />
        <button v-if="searchQ" class="search-clear" @click="searchQ = ''; applyFilter()">×</button>
      </div>
      <select class="filter-select" v-model="filterDept" @change="applyFilter">
        <option value="">🏢 Mọi phòng ban</option>
        <option v-for="d in flatDepts" :key="d.id" :value="d.id">
          {{ '— '.repeat(d._depth) }}{{ d.name }}
        </option>
      </select>
      <select class="filter-select" v-model="filterGroup" @change="applyFilter">
        <option value="">🛡 Mọi nhóm quyền</option>
        <option v-for="g in flatGroups" :key="g.id" :value="g.id">
          {{ '— '.repeat(g._depth) }}{{ g.name }}
        </option>
      </select>
      <select class="filter-select" v-model="filterActive" @change="applyFilter">
        <option value="all">Mọi trạng thái</option>
        <option value="active">🟢 Đang hoạt động</option>
        <option value="inactive">⚪ Đã vô hiệu</option>
      </select>
      <div class="at-toolbar-spacer"></div>
      <span class="at-count">{{ filteredUsers.length }} / {{ stats.total }} nhân viên</span>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="skel-card" v-for="i in 4" :key="i" style="height: 44px"></div>
    </div>

    <div v-else-if="filteredUsers.length === 0 && store.users.length === 0" class="empty-state">
      <div class="empty-icon">👥</div>
      <h3>Chưa có nhân viên nào</h3>
      <p>Thêm nhân viên qua trang đăng ký hoặc dùng admin endpoint.</p>
    </div>

    <div v-else-if="filteredUsers.length === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>Không tìm thấy nhân viên phù hợp</h3>
      <p>Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.</p>
    </div>

    <!-- AIRTABLE-STYLE TABLE -->
    <section v-else class="at-table-wrap">
      <table class="at-table">
        <thead>
          <tr>
            <th class="th-num">#</th>
            <th class="th-name">Nhân viên</th>
            <th class="th-email">Email</th>
            <th class="th-dept">Phòng ban</th>
            <th class="th-role">Chức vụ</th>
            <th class="th-group">Nhóm quyền</th>
            <th class="th-internal">🏠 Liên lạc nội bộ</th>
            <th class="th-status">Trạng thái</th>
            <th class="th-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(u, i) in filteredUsers"
            :key="u.id"
            :class="{ 'row-active': selectedUser?.id === u.id, 'row-inactive': !u.isActive }"
            @click="openPanel(u)"
          >
            <td class="cell-num">{{ i + 1 }}</td>
            <td class="cell-name">
              <span class="at-avatar" :style="{ background: avatarColor(u.fullName || u.email) }">
                {{ initials(u.fullName || u.email) }}
              </span>
              <div class="cell-name-text">
                <div class="cell-name-main">{{ u.fullName || '(chưa đặt tên)' }}</div>
                <div v-if="u.role === 'owner'" class="cell-name-sub owner-tag">👑 Chủ tổ chức</div>
              </div>
            </td>
            <td class="cell-email">{{ u.email }}</td>
            <td class="cell-dept">
              <span v-if="u.departmentMember" class="at-chip chip-dept">
                🏢 {{ u.departmentMember.department.name }}
              </span>
              <span v-else class="at-empty">—</span>
            </td>
            <td class="cell-role">
              <template v-if="u.departmentMember">
                <span v-if="u.departmentMember.deptRole === 'leader'" class="at-chip chip-leader">
                  👑 Trưởng phòng
                </span>
                <span v-else-if="u.departmentMember.deptRole === 'deputy'" class="at-chip chip-deputy">
                  🎖️ Phó phòng
                </span>
                <span v-else class="at-chip chip-member">👤 Nhân viên</span>
              </template>
              <span v-else class="at-empty">—</span>
            </td>
            <td class="cell-group">
              <template v-if="u.permissionGroup">
                <span class="at-chip" :class="u.permissionGroup.isSystem ? 'chip-system' : 'chip-custom'">
                  🛡 {{ u.permissionGroup.name }}
                </span>
              </template>
              <span v-else class="at-empty">—</span>
            </td>
            <td class="cell-internal">
              <!-- Phase Privacy v2 2026-05-23 — Nick liên lạc nội bộ -->
              <RouterLink
                v-if="(u as any).internalContactNick"
                :to="'/settings/channels/zalo?tab=privacy'"
                class="at-chip chip-internal"
                @click.stop
                :title="`Nick: ${(u as any).internalContactNick.displayName || '(chưa đặt tên)'}`"
              >
                🏠 {{ (u as any).internalContactNick.displayName || '(chưa đặt tên)' }}
              </RouterLink>
              <span v-else class="at-empty" :title="`Max ${(u as any).maxPrivacyNicks ?? 2} nick riêng tư`">—</span>
            </td>
            <td class="cell-status">
              <span v-if="u.isActive" class="at-chip chip-active">🟢 Hoạt động</span>
              <span v-else class="at-chip chip-inactive">⚪ Vô hiệu</span>
            </td>
            <td class="cell-actions">
              <button class="at-btn-icon" title="Mở chi tiết" @click.stop="openPanel(u)">✎</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Side panel -->
    <UserEditPanel
      :open="panelOpen"
      :user="selectedUser"
      :current-user-id="currentUserId"
      :current-user-role="currentUserRole"
      @close="closePanel"
      @changed="onChanged"
    />

    <!-- Create user dialog -->
    <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3>Thêm nhân viên</h3>
          <button class="modal-close" @click="showCreate = false">✕</button>
        </div>
        <div class="modal-body">
          <label class="field-label">Họ tên *</label>
          <input v-model="createForm.fullName" class="field-input" placeholder="Nguyễn Văn A" />
          <label class="field-label">Email *</label>
          <input v-model="createForm.email" class="field-input" type="email" placeholder="user@company.com" />
          <label class="field-label">Mật khẩu *</label>
          <input v-model="createForm.password" class="field-input" type="password" placeholder="Tối thiểu 8 ký tự" />
          <label class="field-label">Vai trò</label>
          <select v-model="createForm.role" class="field-input">
            <option value="member">Nhân viên</option>
            <option value="admin">Quản trị viên</option>
          </select>
          <p v-if="createError" class="field-error">{{ createError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn-ghost" @click="showCreate = false">Huỷ</button>
          <button class="btn-primary" :disabled="creating" @click="handleCreate">
            {{ creating ? 'Đang tạo...' : 'Tạo' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import {
  useRbacStore,
  type RbacUser,
  type DepartmentNode,
  type PermissionGroupNode,
} from '@/stores/rbac';
import { useAuthStore } from '@/stores/auth';
import UserEditPanel from '@/components/rbac/UserEditPanel.vue';
import { useUsers } from '@/composables/use-users';
import { useToast } from '@/composables/use-toast';

const store = useRbacStore();
const authStore = useAuthStore();

const searchQ = ref('');
const filterDept = ref('');
const filterGroup = ref('');
const filterActive = ref<'all' | 'active' | 'inactive'>('all');

const panelOpen = ref(false);
const selectedUser = ref<RbacUser | null>(null);

const currentUserId = computed(() => authStore.user?.id ?? '');
const currentUserRole = computed(() => authStore.user?.role ?? 'member');
const canCreateUser = computed(() => currentUserRole.value === 'owner' || currentUserRole.value === 'admin');

// Create user dialog state — Owner/Admin only
const { createUser } = useUsers();
const toast = useToast();
const showCreate = ref(false);
const creating = ref(false);
const createError = ref('');
const createForm = ref({ fullName: '', email: '', password: '', role: 'member' as 'member' | 'admin' });

function openCreate() {
  createForm.value = { fullName: '', email: '', password: '', role: 'member' };
  createError.value = '';
  showCreate.value = true;
}

async function handleCreate() {
  createError.value = '';
  const { fullName, email, password } = createForm.value;
  if (!fullName.trim() || !email.trim() || !password.trim()) {
    createError.value = 'Vui lòng nhập đầy đủ họ tên, email, mật khẩu';
    return;
  }
  creating.value = true;
  const res = await createUser(createForm.value);
  creating.value = false;
  if (res.ok) {
    showCreate.value = false;
    toast.success(`Đã tạo nhân viên "${fullName}"`);
    await store.loadUsers();
  } else {
    createError.value = res.error || 'Không tạo được nhân viên';
  }
}

onMounted(async () => {
  await Promise.all([
    store.loadUsers(),
    store.loadDepartments(),
    store.loadPermissionGroups(),
  ]);
});

const flatDepts = computed(() => {
  const out: Array<DepartmentNode & { _depth: number }> = [];
  function walk(nodes: DepartmentNode[], depth: number) {
    for (const n of nodes) {
      out.push({ ...n, _depth: depth });
      if (n.children?.length) walk(n.children, depth + 1);
    }
  }
  walk(store.departments, 0);
  return out;
});
const flatGroups = computed(() => {
  const out: Array<PermissionGroupNode & { _depth: number }> = [];
  function walk(nodes: PermissionGroupNode[], depth: number) {
    for (const n of nodes) {
      out.push({ ...n, _depth: depth });
      if (n.children?.length) walk(n.children, depth + 1);
    }
  }
  walk(store.permissionGroups, 0);
  return out;
});

const filteredUsers = computed(() => {
  return store.users.filter((u) => {
    if (filterActive.value === 'active' && !u.isActive) return false;
    if (filterActive.value === 'inactive' && u.isActive) return false;
    return true;
  });
});

const stats = computed(() => {
  let total = store.users.length;
  let active = 0, withDept = 0, withGroup = 0;
  for (const u of store.users) {
    if (u.isActive) active++;
    if (u.departmentMember) withDept++;
    if (u.permissionGroupId) withGroup++;
  }
  return { total, active, withDept, withGroup };
});

const loading = computed(() => store.loading);

let debounceTimer: any;
function applyFilter() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    store.loadUsers({
      q: searchQ.value || undefined,
      departmentId: filterDept.value || undefined,
      permissionGroupId: filterGroup.value || undefined,
    });
  }, 300);
}

function openPanel(u: RbacUser) {
  selectedUser.value = u;
  panelOpen.value = true;
}
function closePanel() {
  panelOpen.value = false;
  selectedUser.value = null;
}
async function onChanged() {
  await store.loadUsers({
    q: searchQ.value || undefined,
    departmentId: filterDept.value || undefined,
    permissionGroupId: filterGroup.value || undefined,
  });
  if (selectedUser.value) {
    const updated = store.users.find((u) => u.id === selectedUser.value!.id);
    if (updated) selectedUser.value = updated;
  }
}

function initials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avatarColor(name: string): string {
  const colors = ['#aa2d00', '#0a2e0e', '#d9a441', '#1b61c9', '#7a2000', '#1a3866'];
  const h = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[h % colors.length];
}
</script>

<style>
/* UsersRbacView — Airtable-style table */

.at-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.at-search {
  min-width: 260px;
  max-width: 340px;
  flex: 1;
}
.at-toolbar-spacer { flex: 1; }
.at-count {
  font-size: 12px;
  color: #41454d;
  background: #f0f1f3;
  padding: 6px 12px;
  border-radius: 9999px;
  font-weight: 500;
  white-space: nowrap;
}

/* Airtable table */
.at-table-wrap {
  background: white;
  border: 1px solid #e0e2e6;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(24,29,38,0.04);
}
.at-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: auto;
}

/* Header — sticky, Airtable gray */
.at-table thead th {
  position: sticky;
  top: 0;
  background: #f8fafc;
  padding: 12px 14px;
  text-align: left;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #41454d;
  border-bottom: 2px solid #e0e2e6;
  white-space: nowrap;
}
.th-num { width: 46px; text-align: center !important; }
.th-name { min-width: 200px; }
.th-email { min-width: 180px; }
.th-dept { min-width: 140px; }
.th-role { width: 140px; }
.th-group { min-width: 130px; }
.th-status { width: 130px; }
.th-actions { width: 48px; }

/* Rows */
.at-table tbody tr {
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid #f0f1f3;
}
.at-table tbody tr:hover { background: #f8fafc; }
.at-table tbody tr.row-active { background: #fdf3df; }
.at-table tbody tr.row-active:hover { background: #fceec5; }
.at-table tbody tr.row-inactive .cell-name-main,
.at-table tbody tr.row-inactive .cell-email {
  color: #9297a0;
  text-decoration: line-through;
  text-decoration-color: #c9ccd1;
}
.at-table tbody tr:last-child { border-bottom: 0; }
.at-table tbody td {
  padding: 12px 14px;
  vertical-align: middle;
}

/* Cells */
.cell-num {
  text-align: center;
  color: #9297a0;
  font-size: 11px;
  font-weight: 500;
}
.cell-name {
  display: flex;
  align-items: center;
  gap: 10px;
}
.at-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: white;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cell-name-text { min-width: 0; }
.cell-name-main {
  font-size: 13px;
  font-weight: 500;
  color: #181d26;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cell-name-sub {
  font-size: 10px;
  font-weight: 600;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.owner-tag { color: #7a5818; }
.admin-tag { color: #0a2e0e; }

.cell-email {
  font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace;
  font-size: 12px;
  color: #41454d;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
}

/* Airtable chips */
.at-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.2;
}
.chip-dept { background: #e3ede4; color: #0a2e0e; }
.chip-leader { background: #fdf3df; color: #7a5818; }
.chip-deputy { background: #f5e9d4; color: #aa2d00; }
.chip-member { background: #f0f1f3; color: #41454d; }
.chip-system { background: #fdf3df; color: #7a5818; }
.chip-custom { background: #e0e9f5; color: #1b61c9; }
/* Phase Privacy v2 2026-05-23 — Nick liên lạc nội bộ chip */
.chip-internal {
  background: #FEF3C7; color: #92400E;
  text-decoration: none; cursor: pointer;
}
.chip-internal:hover { background: #FDE68A; }
.chip-active { background: #d8ecda; color: #0a2e0e; }
.chip-inactive { background: #f0f1f3; color: #9297a0; }

.at-empty {
  color: #c9ccd1;
  font-size: 12px;
}

.cell-actions { text-align: right; }
.at-btn-icon {
  background: white;
  border: 1px solid #dddddd;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  color: #41454d;
  font-size: 12px;
  transition: all 0.1s;
}
.at-btn-icon:hover {
  background: #181d26;
  color: white;
  border-color: #181d26;
}

/* Hero right + Create user button */
.page-hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.hero-right { flex-shrink: 0; }
.btn-primary {
  background: #181d26; color: white; border: 1px solid #181d26;
  padding: 8px 16px; border-radius: 7px; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.12s;
}
.btn-primary:hover:not(:disabled) { background: #2c3441; border-color: #2c3441; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost {
  background: white; color: #41454d; border: 1px solid #d8d9dd;
  padding: 8px 16px; border-radius: 7px; font-size: 13px; font-weight: 500;
  cursor: pointer;
}
.btn-ghost:hover { background: #f3f4f6; }

/* Create user modal */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(17, 24, 39, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal-card {
  background: white; border-radius: 12px; width: 440px; max-width: 92vw;
  box-shadow: 0 20px 50px rgba(0,0,0,0.15);
  display: flex; flex-direction: column;
}
.modal-head {
  padding: 16px 20px; border-bottom: 1px solid #f3f4f6;
  display: flex; justify-content: space-between; align-items: center;
}
.modal-head h3 { margin: 0; font-size: 15px; font-weight: 700; color: #111827; }
.modal-close {
  background: transparent; border: none; cursor: pointer;
  font-size: 16px; color: #6b7280; padding: 4px 8px; border-radius: 6px;
}
.modal-close:hover { background: #f3f4f6; color: #111827; }
.modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 12px; font-weight: 600; color: #41454d; margin-top: 8px; }
.field-input {
  padding: 8px 11px; border: 1px solid #d8d9dd; border-radius: 7px;
  font-size: 13px; font-family: inherit; color: #181d26;
  outline: none; transition: border-color 0.12s;
}
.field-input:focus { border-color: #181d26; }
.field-error {
  color: #b91c1c; font-size: 12px; font-weight: 500;
  background: #fef2f2; border: 1px solid #fecaca; border-radius: 7px;
  padding: 8px 11px; margin: 8px 0 0; line-height: 1.4;
}
.modal-foot {
  padding: 12px 20px; border-top: 1px solid #f3f4f6;
  display: flex; justify-content: flex-end; gap: 8px;
  background: #fafbfc; border-radius: 0 0 12px 12px;
}
</style>
