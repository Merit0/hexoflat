<template>
  <div class="footer">
    <div v-if="flags.placeholderLinks" class="footer__links">
      <a class="footer__link" href="#" data-testid="auth-terms" @click.prevent>{{
        t('auth.footer.terms')
      }}</a>
      <a class="footer__link" href="#" data-testid="auth-privacy" @click.prevent>{{
        t('auth.footer.privacy')
      }}</a>
    </div>
    <span v-else />
    <button
      class="footer__lang"
      type="button"
      data-testid="auth-lang"
      :aria-label="t('auth.footer.language')"
      @click="form.toggleLocale"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
      >
        <circle cx="12" cy="12" r="9" />
        <path
          d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"
        />
      </svg>
      {{ locale === 'uk' ? 'UA' : 'EN' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useAuthForm } from '@/features/auth/composables/use-auth-form';

const form = useAuthForm();
const flags = form.flags;
const { t, locale } = useI18n();
</script>

<style scoped>
.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-top: 4px;
  border-top: 1px solid var(--pow-divider);
}
.footer__links {
  display: flex;
  gap: 14px;
  font-size: 14px;
  padding-top: 12px;
}
.footer__link {
  text-decoration: none;
  color: var(--pow-link);
}
.footer__link:hover {
  color: #d3dde7;
}
.footer__lang {
  min-height: 44px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--pow-text-2);
  font:
    600 14px Inter,
    sans-serif;
  transition: background 0.15s;
}
.footer__lang svg {
  width: 18px;
  height: 18px;
}
.footer__lang:hover {
  background: var(--pow-chip-hover);
}
.footer__lang:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
</style>
