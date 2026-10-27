import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/index';
import { refreshOrgTimezone } from '@/composables/use-org-timezone';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  orgId: string;
  orgName: string;
  orgTimezone?: string;
}

const TOKEN_KEY = 'token';

// Đọc token từ localStorage (ghi nhớ) HOẶC sessionStorage (phiên tạm).
function readToken(): string {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
}

// Lưu token: remember=true → localStorage (bền qua lần mở sau);
// remember=false → sessionStorage (mất khi đóng trình duyệt).
function persistToken(value: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, value);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, value);
    localStorage.removeItem(TOKEN_KEY);
  }
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref(readToken());
  const needsSetup = ref(false);

  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const isOwner = computed(() => user.value?.role === 'owner');
  const isAdmin = computed(() => ['owner', 'admin'].includes(user.value?.role || ''));

  async function checkSetup() {
    const res = await api.get('/setup/status');
    needsSetup.value = res.data.needsSetup;
    return res.data.needsSetup;
  }

  async function setup(data: { orgName: string; fullName: string; email: string; password: string }) {
    const res = await api.post('/setup', data);
    token.value = res.data.token;
    user.value = res.data.user;
    persistToken(res.data.token, true);
  }

  // identifier = email HOẶC số điện thoại. remember=true → ghi nhớ đăng nhập.
  async function login(identifier: string, password: string, remember = true) {
    const res = await api.post('/auth/login', { identifier, password });
    token.value = res.data.token;
    user.value = res.data.user;
    persistToken(res.data.token, remember);
  }

  async function fetchProfile() {
    try {
      const res = await api.get('/profile');
      const data = res.data;
      const tz = data.org?.timezone ?? '+07:00';
      user.value = {
        id: data.id,
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        orgId: data.orgId,
        orgName: data.org?.name ?? '',
        orgTimezone: tz,
      };
      refreshOrgTimezone(tz);
    } catch {
      logout();
    }
  }

  function logout() {
    token.value = '';
    user.value = null;
    clearToken();
  }

  async function init() {
    if (token.value) {
      await fetchProfile();
    }
  }

  return { user, token, needsSetup, isAuthenticated, isOwner, isAdmin, checkSetup, setup, login, fetchProfile, logout, init };
});
