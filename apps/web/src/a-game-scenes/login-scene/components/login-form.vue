<template>
  <form class="login-form game-root" data-testid="login-form" novalidate @submit.prevent="onSubmit">
    <div v-if="mode === 'register'" class="form-field">
      <label class="sr-only" for="login-name">Name</label>
      <input
        id="login-name"
        v-model.trim="form.name"
        class="login-form-input"
        data-testid="register-name-input"
        type="text"
        maxlength="40"
        autocomplete="name"
        placeholder="Name"
        required
        @input="clearError"
      />
    </div>
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
        :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
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
    <div v-if="mode === 'register'" class="form-field">
      <label class="sr-only" for="login-password-confirm">Confirm password</label>
      <input
        id="login-password-confirm"
        v-model.trim="form.confirmPassword"
        class="login-form-input"
        data-testid="register-confirm-password-input"
        :type="showPassword ? 'text' : 'password'"
        maxlength="40"
        autocomplete="new-password"
        placeholder="Confirm password"
        required
        @input="clearError"
      />
    </div>
    <p v-if="mode === 'register'" class="login-form-hint" data-testid="register-password-hint">
      Password must be at least {{ PASSWORD_MIN_LENGTH }} characters.
    </p>
    <button
      class="login-form-submit"
      data-testid="login-submit-button"
      type="submit"
      :disabled="isLoading"
      :aria-label="mode === 'login' ? 'Sign in' : 'Register'"
    >
      {{ isLoading ? 'Loading...' : mode === 'login' ? 'PLAY' : 'REGISTER' }}
    </button>
    <button
      type="button"
      class="login-form-toggle-mode"
      data-testid="login-toggle-mode-button"
      :disabled="isLoading"
      @click="toggleMode"
    >
      {{ mode === 'login' ? 'Create account' : 'Back to login' }}
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

// Mirrors apps/api/src/auth/auth.dto.ts's RegisterDtoSchema — kept in sync by
// hand since apps/web and apps/api don't share a validation package.
const PASSWORD_MIN_LENGTH = 8;

export default defineComponent({
  name: 'LoginForm',
  setup() {
    const userStore = useUserStore();
    const router = useRouter();

    const form = reactive({
      username: '',
      password: '',
      confirmPassword: '',
      name: '',
    });

    const mode = ref<'login' | 'register'>('login');
    const showPassword = ref(false);
    const isLoading = ref(false);

    const resetForm = () => {
      form.username = '';
      form.password = '';
      form.confirmPassword = '';
      form.name = '';
    };

    const validateRegistration = (): string | null => {
      if (form.password.length < PASSWORD_MIN_LENGTH) {
        return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
      }
      if (form.password !== form.confirmPassword) {
        return 'Passwords do not match.';
      }
      return null;
    };

    const onSubmit = async () => {
      if (mode.value === 'register') {
        const validationError = validateRegistration();
        if (validationError) {
          userStore.setError(validationError);
          return;
        }
      }

      try {
        isLoading.value = true;

        const success =
          mode.value === 'login'
            ? await userStore.login(form.username, form.password)
            : await userStore.register(form.username, form.password, form.name);
        if (!success) return;

        resetForm();

        await router.replace({
          name: ROUTES.WORLD,
          params: { locationKey: 'camping' },
        });
      } catch (error) {
        console.error(mode.value === 'login' ? 'Login failed:' : 'Registration failed:', error);
      } finally {
        isLoading.value = false;
      }
    };

    const togglePassword = () => {
      showPassword.value = !showPassword.value;
    };

    const toggleMode = () => {
      mode.value = mode.value === 'login' ? 'register' : 'login';
      form.confirmPassword = '';
      userStore.clearErrorMsg();
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
      mode,
      userStore,
      showPassword,
      isLoading,
      PASSWORD_MIN_LENGTH,
      onSubmit,
      togglePassword,
      toggleMode,
      clearError,
    };
  },
});
</script>

<style scoped>
@import '@/a-game-scenes/login-scene/styles/login-form-style.css';
</style>
