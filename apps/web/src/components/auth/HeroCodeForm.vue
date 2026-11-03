<template>
  <div class="code pow-rise" data-testid="auth-code-form">
    <div class="code__head">
      <h1 class="code__title">{{ t('auth.code.title') }}</h1>
      <p class="code__subtitle">{{ t('auth.code.subtitle') }}</p>
    </div>
    <div v-if="form.recentHeroes.length" class="code__recent">
      <p class="code__section">{{ t('auth.recent') }}</p>
      <div class="code__chips">
        <RecentHeroChip
          v-for="hero in form.recentHeroes"
          :key="hero.name"
          :hero="hero"
          :selected="form.runeHero === hero.name"
          @pick="form.choosePickedHero(hero.name)"
        />
      </div>
    </div>
    <RunePad :picked="form.runes" @pick="form.pickRuneById" />
    <div class="code__progress">
      <div
        class="code__dots"
        role="img"
        :aria-label="t('auth.code.progress', { n: form.runes.length })"
        data-testid="auth-rune-progress"
      >
        <span
          v-for="i in 4"
          :key="i"
          class="code__dot"
          :style="{ background: i <= form.runes.length ? '#8ba2b8' : '#2e2e31' }"
        />
      </div>
      <button
        class="code__reset"
        type="button"
        data-testid="auth-rune-reset"
        @click="form.clearRunes"
      >
        {{ t('auth.code.restart') }}
      </button>
    </div>
    <AuthAlert v-if="form.error" :message="form.error" />
    <p v-if="form.loading" class="code__checking" data-testid="auth-checking">
      {{ t('auth.code.checking') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useAuthForm } from '@/features/auth/composables/use-auth-form';
import AuthAlert from './AuthAlert.vue';
import RecentHeroChip from './RecentHeroChip.vue';
import RunePad from './RunePad.vue';

const form = useAuthForm();
const { t } = useI18n();
</script>

<style scoped>
.code {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.code__head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.code__title {
  margin: 0;
  font-family: Cinzel, serif;
  font-size: 34px;
  font-weight: 600;
  color: var(--pow-text-strong);
}
.code__subtitle {
  margin: 0;
  font-size: 17px;
  line-height: 1.45;
  color: var(--pow-text-muted);
}
.code__recent {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.code__section {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8c8c93;
}
.code__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.code__progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.code__dots {
  display: flex;
  gap: 10px;
}
.code__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: block;
  transition: background 0.15s;
}
.code__reset {
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--pow-link);
  font:
    500 16px Inter,
    sans-serif;
}
.code__reset:focus-visible {
  outline: 2px solid var(--pow-accent);
  outline-offset: 3px;
}
.code__checking {
  margin: 0;
  text-align: center;
  font-size: 16px;
  color: var(--pow-link);
}
@media (max-width: 599.98px) {
  .code__title {
    font-size: 28px;
  }
}
</style>
