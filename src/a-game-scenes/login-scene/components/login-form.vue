<template>
    <form class="login-form" @submit.prevent="onSubmit" novalidate>
      <div class="form-field">
        <input
            v-model.trim="form.username"
            class="login-form-input"
            data-testid="username"
            type="text"
            maxlength="40"
            autocomplete="off"
            placeholder="Username"
            required
            @input="clearError"
        />
      </div>
      <div class="form-field">
        <input
            v-model.trim="form.password"
            class="login-form-input"
            data-testid="password"
            :type="showPassword ? 'text' : 'password'"
            maxlength="40"
            autocomplete="off"
            placeholder="Password"
            required
            @input="clearError"
        />
        <button
            type="button"
            class="toggle-password"
            @click="togglePassword"
            aria-label="Toggle password visibility"
        >
          {{ showPassword ? 'Hide' : 'Show' }}
        </button>
      </div>
      <button
          class="login-form-submit"
          type="submit"
          :disabled="isLoading"
          aria-label="Sign in"
      >
        {{ isLoading ? 'Loading...' : 'PLAY' }}
      </button>
    </form>
    <transition name="fade">
      <div v-if="userStore.error" class="login-form-error">
        {{ userStore.error }}
      </div>
    </transition>
</template>

<script lang="ts">
import {useUserStore} from "@/stores/user-store";
import {defineComponent, reactive, ref, onMounted} from 'vue';

export default defineComponent({
  name: "LoginForm",
  setup() {
    const userStore = useUserStore();
    const form = reactive({
      username: "",
      password: ""
    });
    const showPassword = ref(false);
    const isLoading = ref(false);
    const onSubmit = async () => {
      try {
        isLoading.value = true;
        await userStore.login(form.username, form.password);
        form.username = '';
        form.password = '';
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
      if (userStore.error) {
        userStore.clearErrorMsg();
      }
    };

    onMounted(() => {
      userStore.clearErrorMsg();
      userStore.logout()
      document.title = 'Hexoflat - Login';
    });

    return {
      form,
      userStore,
      showPassword,
      isLoading,
      onSubmit,
      togglePassword,
      clearError
    }
  }
});
</script>

<style scoped>
@import '@/a-game-scenes/login-scene/styles/login-form-style.css';
</style>