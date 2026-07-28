<template>
  <form class="login-form game-root" data-testid="login-form" novalidate @submit.prevent="onSubmit">
    <div class="form-field">
      <label class="sr-only" for="login-username">Username</label>
      <input
        id="login-username"
        v-model.trim="form.username"
        class="login-form-input"
        data-testid="login-username-input"
        type="text"
        maxlength="40"
        autocomplete="username"
        placeholder="Username"
        required
        @input="clearError"
      />
    </div>
    <div class="form-field">
      <label class="sr-only" for="login-password">Password</label>
      <input
        id="login-password"
        v-model.trim="form.password"
        class="login-form-input"
        data-testid="login-password-input"
        :type="showPassword ? 'text' : 'password'"
        maxlength="40"
        autocomplete="current-password"
        placeholder="Password"
        required
        @input="clearError"
      />
      <button
        type="button"
        class="toggle-password"
        data-testid="login-toggle-password-button"
        aria-label="Toggle password visibility"
        @click="togglePassword"
      >
        {{ showPassword ? 'Hide' : 'Show' }}
      </button>
    </div>
    <button
      class="login-form-submit"
      data-testid="login-submit-button"
      type="submit"
      :disabled="isLoading"
      aria-label="Sign in"
    >
      {{ isLoading ? 'Loading...' : 'PLAY' }}
    </button>
  </form>
  <transition name="fade">
    <div
      v-if="userStore.error"
      class="login-form-error"
      data-testid="login-error-message"
      role="alert"
      aria-live="assertive"
    >
      {{ userStore.error }}
    </div>
  </transition>
</template>

<script lang="ts">
import { useUserStore } from '@/stores/user-store';
import { defineComponent, reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTES } from '@/router';

export default defineComponent({
  name: 'LoginForm',
  setup() {
    const userStore = useUserStore();
    const router = useRouter();

    const form = reactive({
      username: '',
      password: '',
    });

    const showPassword = ref(false);
    const isLoading = ref(false);

    const onSubmit = async () => {
      try {
        isLoading.value = true;

        const success = await userStore.login(form.username, form.password);
        if (!success) return;

        form.username = '';
        form.password = '';

        await router.replace({
          name: ROUTES.WORLD,
          params: { locationKey: 'camping' },
        });
      } catch (error) {
        console.error('Login failed:', error);
      } finally {
        isLoading.value = false;
      }
    };

    const togglePassword = () => {
      showPassword.value = !showPassword.value;
    };

    const clearError = () => {
      if (userStore.error) userStore.clearErrorMsg();
    };

    onMounted(() => {
      userStore.clearErrorMsg();
      void userStore.logout();
      document.title = 'Hexoflat - Login';
    });

    return {
      form,
      userStore,
      showPassword,
      isLoading,
      onSubmit,
      togglePassword,
      clearError,
    };
  },
});
</script>

<style scoped>
@import '@/a-game-scenes/login-scene/styles/login-form-style.css';
</style>
