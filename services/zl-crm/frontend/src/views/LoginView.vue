<template>
  <v-card class="pa-8" style="backdrop-filter: blur(20px);" elevation="0">
    <div class="text-center mb-8">
      <img
        src="/brand/zalocrm-lockup-vertical.png"
        alt="ZaloCRM — Quản lý nhiều tài khoản Zalo cá nhân"
        class="mx-auto"
        style="max-width: 240px; width: 100%; height: auto; display: block;"
      />
    </div>

    <v-form @submit.prevent="handleLogin">
      <v-text-field
        v-model="identifier"
        label="Email hoặc số điện thoại"
        type="text"
        autocomplete="username"
        prepend-inner-icon="mdi-account-outline"
        required
        class="mb-3"
      />
      <v-text-field
        v-model="password"
        label="Mật khẩu"
        type="password"
        autocomplete="current-password"
        prepend-inner-icon="mdi-lock-outline"
        required
        class="mb-2"
      />
      <v-checkbox
        v-model="remember"
        label="Ghi nhớ đăng nhập"
        density="compact"
        hide-details
        class="mb-4"
      />
      <v-btn type="submit" color="primary" block size="large" :loading="loading" rounded="xl">
        <v-icon start>mdi-login</v-icon>
        Đăng nhập
      </v-btn>
    </v-form>

    <v-alert v-if="error" type="error" class="mt-4" density="compact" closable variant="tonal">
      {{ error }}
    </v-alert>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const identifier = ref('');
const password = ref('');
const remember = ref(true);
const loading = ref(false);
const error = ref('');
const router = useRouter();
const authStore = useAuthStore();

onMounted(async () => {
  try {
    const needs = await authStore.checkSetup();
    if (needs) router.replace('/setup');
  } catch {}
});

async function handleLogin() {
  loading.value = true;
  error.value = '';
  try {
    await authStore.login(identifier.value.trim(), password.value, remember.value);
    router.push('/');
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Đăng nhập thất bại';
  } finally {
    loading.value = false;
  }
}
</script>
