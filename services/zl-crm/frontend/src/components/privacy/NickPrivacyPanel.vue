<template>
  <Transition name="panel-slide">
    <div v-if="open" class="panel-backdrop" @click.self="$emit('close')">
      <aside class="panel">
        <header class="panel-head">
          <div class="head-left">
            <div class="head-accent" :style="{ background: accentColor }"></div>
            <div>
              <div class="head-eyebrow">Nick Zalo · Riêng tư</div>
              <h2 class="head-title">{{ nick?.displayName || '(chưa đặt tên)' }}</h2>
            </div>
          </div>
          <button class="panel-close" @click="$emit('close')">×</button>
        </header>

        <div class="panel-body">
          <!-- ── Info section ─────────────────────── -->
          <section class="section">
            <h3 class="section-title">Thông tin nick</h3>
            <div class="info-readonly-grid">
              <div class="readonly-row">
                <span class="readonly-label">Tên hiển thị</span>
                <span class="readonly-value">{{ nick?.displayName || '(chưa đặt tên)' }}</span>
              </div>
              <div class="readonly-row">
                <span class="readonly-label">Số điện thoại</span>
                <span class="readonly-value">{{ nick?.phone || '—' }}</span>
              </div>
              <div class="readonly-row">
                <span class="readonly-label">Zalo UID</span>
                <span class="readonly-value mono">{{ nick?.zaloUid || '—' }}</span>
              </div>
              <div class="readonly-row">
                <span class="readonly-label">Trạng thái kết nối</span>
                <span class="role-tag" :class="`status-${nick?.status}`">{{ statusLabel(nick?.status || '') }}</span>
              </div>
            </div>
          </section>

          <!-- ── Privacy config ────────────────────── -->
          <section class="section">
            <h3 class="section-title">Cấu hình riêng tư</h3>

            <div class="role-block">
              <div class="role-head">
                <span class="role-tag" :class="nick?.privacyMode === 'main' ? 'role-leader' : 'role-empty-tag'">
                  {{ nick?.privacyMode === 'main' ? '🔒 Đang BẬT Riêng tư' : '🔓 Đang TẮT (Công khai)' }}
                </span>
              </div>
              <label class="switch-row">
                <input
                  type="checkbox"
                  :checked="nick?.privacyMode === 'main'"
                  :disabled="busy || !canFlip"
                  @change="flipMode(($event.target as HTMLInputElement).checked ? 'main' : 'sub')"
                />
                <span class="slider"></span>
                <span class="switch-text">
                  {{ nick?.privacyMode === 'main'
                    ? 'Nick chính — tin nhắn của KH bị làm mờ với admin & sale khác'
                    : 'Nick phụ — KH hiển thị bình thường (công khai)' }}
                </span>
              </label>
              <p v-if="!canFlip" class="hint-soft hint-warn">
                <strong>Không có quyền:</strong> Chỉ owner của nick mới flip được chế độ Riêng tư.
              </p>
            </div>
          </section>

          <!-- ── Danger zone ─────────────────────── -->
          <section v-if="canFlip && nick?.privacyMode === 'main'" class="section section-danger">
            <h3 class="section-title danger-title">Vùng nguy hiểm</h3>
            <p class="danger-desc">
              Tắt hoàn toàn chế độ Riêng tư cho nick này — quay về <strong>Công khai</strong>.
              Admin & sale khác sẽ thấy <em>toàn bộ tin nhắn</em> trở lại.
            </p>
            <button class="btn-danger" :disabled="busy" @click="confirmDisable">
              🚫 Tắt Riêng tư hoàn toàn
            </button>
          </section>
        </div>

        <p v-if="error" class="panel-error">{{ error }}</p>
      </aside>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePrivacyStore } from '@/stores/privacy';

interface NickRow {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  zaloUid: string | null;
  status: string;
  privacyMode: 'main' | 'sub';
  isOwner: boolean;
}

const props = defineProps<{
  open: boolean;
  nick: NickRow | null;
  canFlip: boolean;
}>();
const emit = defineEmits<{ close: []; changed: [] }>();

const store = usePrivacyStore();
const busy = ref(false);
const error = ref('');

const accentColor = computed(() => {
  if (!props.nick) return '#181d26';
  return props.nick.privacyMode === 'main' ? '#aa2d00' : '#1b61c9';
});

async function flipMode(newMode: 'main' | 'sub') {
  if (!props.nick) return;
  if (newMode === 'main' && !store.hasPin) {
    error.value = 'Bạn cần setup PIN ở mục PIN bảo mật trước khi bật Riêng tư.';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    await store.flipNickPrivacyMode(props.nick.id, newMode);
    emit('changed');
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Lỗi flip mode';
  } finally {
    busy.value = false;
  }
}

async function confirmDisable() {
  if (!props.nick) return;
  if (!confirm(`Tắt hoàn toàn Riêng tư cho nick "${props.nick.displayName || '(không tên)'}"?`)) return;
  await flipMode('sub');
}

function statusLabel(s: string): string {
  if (s === 'connected') return '🟢 Đã kết nối';
  if (s === 'disconnected') return '⚪ Ngắt kết nối';
  if (s === 'qr_pending') return '🟡 Chờ QR';
  return s || '—';
}
</script>

<style>
.info-readonly-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.readonly-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e0e2e6;
}
.readonly-label {
  font-size: 11px;
  font-weight: 500;
  color: #41454d;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.readonly-value {
  font-size: 13px;
  font-weight: 500;
  color: #181d26;
}
.readonly-value.mono { font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; font-size: 11px; }
.status-connected { background: #e3ede4; color: #0a2e0e; }
.status-disconnected { background: #f0f1f3; color: #41454d; }
.status-qr_pending { background: #fdf3df; color: #7a5818; }

.switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e0e2e6;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  margin-top: 8px;
}
.switch-row input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.switch-row .slider {
  width: 36px;
  height: 20px;
  background: #d1d5db;
  border-radius: 9999px;
  position: relative;
  flex-shrink: 0;
  transition: 0.2s;
}
.switch-row .slider::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: 0.2s;
}
.switch-row input:checked + .slider { background: #aa2d00; }
.switch-row input:checked + .slider::before { transform: translateX(16px); }
.switch-row input:disabled + .slider { opacity: 0.5; cursor: not-allowed; }
.switch-text { font-size: 12px; color: #41454d; line-height: 1.4; }

.role-block-disabled {
  opacity: 0.7;
  margin-top: 16px;
}
.badge-soon {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 7px;
  background: #fdf3df;
  color: #7a5818;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.blur-fields-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px dashed #d6d8dc;
  border-radius: 6px;
  margin-top: 6px;
}
.cb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #41454d;
}
.cb-row input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #aa2d00;
}

.hint-warn { background: #fbe6dc !important; border-left-color: #aa2d00 !important; color: #7a2000 !important; }
</style>
