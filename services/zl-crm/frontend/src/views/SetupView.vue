<template>
  <v-card class="pa-6" elevation="8">
    <div class="text-center mb-6">
      <v-icon icon="mdi-cog" size="64" color="primary" />
      <h1 class="text-h5 mt-2">Thiết lập ban đầu</h1>
      <p class="text-body-2 text-grey mt-1">Tạo tổ chức và tài khoản quản trị viên</p>
    </div>
    <v-form @submit.prevent="handleSetup" ref="form">
      <v-text-field v-model="orgName" label="Tên tổ chức / phòng khám" prepend-inner-icon="mdi-domain" :rules="[v => !!v || 'Bắt buộc']" class="mb-2" />
      <v-text-field v-model="fullName" label="Họ tên quản trị viên" prepend-inner-icon="mdi-account" :rules="[v => !!v || 'Bắt buộc']" class="mb-2" />
      <v-text-field v-model="email" label="Email đăng nhập" type="email" prepend-inner-icon="mdi-email" :rules="[v => !!v || 'Bắt buộc']" class="mb-2" />
      <v-text-field v-model="password" label="Mật khẩu" type="password" prepend-inner-icon="mdi-lock" :rules="[v => v.length >= 6 || 'Tối thiểu 6 ký tự']" class="mb-4" />
      <v-btn type="submit" color="primary" block size="large" :loading="loading">Tạo tài khoản</v-btn>
    </v-form>
    <v-alert v-if="error" type="error" class="mt-4" density="compact" closable>{{ error }}</v-alert>
    <v-alert v-if="success" type="success" class="mt-4" density="compact">Tạo thành công! Đang chuyển hướng...</v-alert>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const orgName = ref('');
const fullName = ref('');
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const success = ref(false);
const router = useRouter();
const authStore = useAuthStore();

// Nếu org đã thiết lập từ trước (vd tab /setup cũ còn mở, hoặc F5 lại sau khi tạo
// xong) → tự chuyển sang /login để không bị kẹt ở màn setup.
onMounted(async () => {
  try {
    const needs = await authStore.checkSetup();
    if (!needs) router.replace('/login');
  } catch { /* lỗi mạng → cứ để người dùng ở màn setup */ }
});

async function handleSetup() {
  loading.value = true;
  error.value = '';
  try {
    await authStore.setup({ orgName: orgName.value, fullName: fullName.value, email: email.value, password: password.value });
    success.value = true;
    // Điều hướng ngay & chắc chắn — đã có token + user trong store, guard sẽ cho qua.
    await router.replace('/');
  } catch (err: any) {
    // Nếu org vừa bị tạo bởi request khác (đã setup) → đưa về login thay vì kẹt.
    if (err.response?.data?.error === 'Setup already completed') {
      router.replace('/login');
      return;
    }
    error.value = err.response?.data?.error || 'Thiết lập thất bại';
  } finally {
    loading.value = false;
  }
}
</script>
