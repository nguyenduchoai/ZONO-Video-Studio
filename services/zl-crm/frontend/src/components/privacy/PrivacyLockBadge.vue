<!--
  PrivacyLockBadge — pill nhỏ hiển thị ngay ô tên user ở Cột 1 sidebar.
  Anh chốt 2026-05-22:
    - 🔒 (closed) khi chưa unlock → click mở PrivacyUnlockDialog
    - 🔓 (open) + countdown HH:MM khi đang unlock → click cho phép lock ngay
    - Auto refresh expiresAt mỗi giây, khi countdown chạm 0 thì re-fetch status

  Emits:
    click — parent toggle dialog (mở khoá hoặc settings)
-->
<template>
  <button
    type="button"
    class="lock-badge"
    :class="{ unlocked: isUnlocked, locked: !isUnlocked }"
    :title="badgeTitle"
    :aria-label="badgeTitle"
    @click="onClick"
  >
    <span class="lb-icon">{{ isUnlocked ? '🔓' : '🔒' }}</span>
    <span v-if="isUnlocked" class="lb-countdown">{{ countdown }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { usePrivacyStore } from '@/stores/privacy';

const emit = defineEmits<{ click: [unlocked: boolean] }>();
const store = usePrivacyStore();

const isUnlocked = computed(() => store.isUnlocked);
const expiresAt = computed(() => store.activeSessions[0]?.expiresAt ?? null);

const now = ref(Date.now());
let timerId: number | null = null;
let lastTriggeredRefetch = 0;

function tick() {
  now.value = Date.now();
  // Khi session sắp hết hạn → re-fetch để FE state đồng bộ
  if (expiresAt.value) {
    const remain = new Date(expiresAt.value).getTime() - now.value;
    if (remain <= 0 && Date.now() - lastTriggeredRefetch > 5000) {
      lastTriggeredRefetch = Date.now();
      store.fetchStatus(true).catch(() => {});
    }
  }
}

onMounted(() => {
  timerId = window.setInterval(tick, 1000);
});
onUnmounted(() => {
  if (timerId) window.clearInterval(timerId);
});

const countdown = computed(() => {
  if (!expiresAt.value) return '--:--:--';
  const ms = new Date(expiresAt.value).getTime() - now.value;
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
});

const badgeTitle = computed(() =>
  isUnlocked.value
    ? `Đang mở khoá Riêng tư · còn ${countdown.value} · click để khoá lại`
    : 'Chế độ Riêng tư đang đóng · click để mở khoá',
);

async function onClick() {
  if (isUnlocked.value) {
    // Đang mở → khoá lại ngay (bubble blur kích hoạt lại).
    // Anh chốt 2026-05-22: click badge khi unlocked = lock ngay, KHÔNG mở dialog.
    try { await store.lock(); } catch { /* silent */ }
    emit('click', false);
    return;
  }
  // Đang đóng → để parent mở dialog nhập PIN.
  emit('click', false);
}
</script>

<style scoped>
.lock-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  transition: all 0.15s ease;
  flex-shrink: 0;
  user-select: none;
}
.lock-badge.locked {
  background: #F4F4F7;
  color: #6B7785;
  border-color: #E4E5E9;
}
.lock-badge.locked:hover {
  background: #EEF0FF;
  border-color: #C7CCEB;
  color: #4F5BC4;
}
.lock-badge.unlocked {
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  color: white;
  border-color: #1e40af;
  box-shadow: 0 1px 3px rgba(30, 64, 175, 0.25);
}
.lock-badge.unlocked:hover {
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
  box-shadow: 0 2px 6px rgba(30, 64, 175, 0.35);
}
.lb-icon {
  font-size: 12px;
  line-height: 1;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.08));
}
.lock-badge.unlocked .lb-icon {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
}
.lb-countdown {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.3px;
  font-variant-numeric: tabular-nums;
}
.lock-badge:focus-visible {
  outline: 2px solid #5E6AD2;
  outline-offset: 2px;
}
</style>
