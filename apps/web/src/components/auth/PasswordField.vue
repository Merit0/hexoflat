<template>
  <AuthField
    :id="id"
    v-model="model"
    :label="label"
    :testid="testid"
    :type="show ? 'text' : 'password'"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    @focus="emit('focus')"
    @blur="emit('blur')"
    @keyup="emit('keyup', $event)"
  >
    <template v-if="forgotLink" #labelExtra>
      <a class="pwd__forgot" href="#" data-testid="auth-forgot" @click.prevent>{{
        t('auth.forgot')
      }}</a>
    </template>
    <template #trailing>
      <button
        class="pwd__toggle"
        type="button"
        data-testid="auth-password-toggle"
        :aria-label="show ? t('auth.password.hide') : t('auth.password.show')"
        @pointerdown.prevent
        @click="show = !show"
      >
        <svg
          v-if="show"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        >
          <path
            d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.5.9-1.6 2.4-3.1 3.7M6.6 7.6C4.6 8.9 3.1 10.8 2.5 12c1 1.8 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"
          />
        </svg>
        <svg
          v-else
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
        >
          <path d="M2.5 12C3.5 10.2 7 6 12 6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </template>
    <template v-if="caps" #below>
      <p class="pwd__caps" data-testid="auth-caps">{{ t('auth.caps') }}</p>
    </template>
  </AuthField>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AuthField from './AuthField.vue';

defineProps<{
  id: string;
  label: string;
  testid: string;
  placeholder?: string;
  autocomplete?: string;
  forgotLink?: boolean;
  caps?: boolean;
}>();

const model = defineModel<string>({ required: true });
const show = defineModel<boolean>('show', { default: false });
const emit = defineEmits<{ focus: []; blur: []; keyup: [event: KeyboardEvent] }>();
const { t } = useI18n();
</script>

<style scoped>
.pwd__toggle {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 44px;
  height: 46px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--pow-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pwd__toggle svg {
  width: 20px;
  height: 20px;
}
.pwd__toggle:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
.pwd__forgot {
  font-size: 15px;
  text-decoration: none;
  color: var(--pow-link);
}
.pwd__forgot:hover {
  color: #d3dde7;
}
.pwd__caps {
  margin: 0;
  font-size: 15px;
  color: var(--pow-warning);
}
</style>
