<template>
  <p v-if="confirming" class="leave__text" data-testid="battle-leave-warning">
    {{ t('battle.leaveWarning') }}
  </p>
  <template v-if="confirming">
    <button
      class="leave__btn is-end"
      type="button"
      data-testid="battle-leave-confirm"
      @click="emit('confirm')"
    >
      {{ t('battle.leaveConfirm') }}
    </button>
    <button
      class="leave__btn"
      type="button"
      data-testid="battle-leave-cancel"
      @click="emit('cancel')"
    >
      {{ t('battle.leaveCancel') }}
    </button>
  </template>
  <button
    v-else-if="canLeave"
    class="leave__btn is-end"
    type="button"
    data-testid="battle-leave"
    @click="emit('leave')"
  >
    {{ t('battle.leave') }}
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ confirming: boolean; canLeave: boolean }>();
const emit = defineEmits<{ leave: []; confirm: []; cancel: [] }>();
const { t } = useI18n();
</script>

<style scoped>
.leave__text {
  margin: 0;
  color: #ede3d2;
  font-family: 'Alegreya Sans', sans-serif;
  font-size: 0.95rem;
}
.leave__btn {
  text-transform: uppercase;
  min-height: 40px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #4a5862;
  background: #1e2427;
  color: #ede3d2;
  font-family: Cinzel, serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.leave__btn.is-end {
  border-color: #a0285a;
  background: linear-gradient(180deg, #7e1a40, #5a0f2c);
}
</style>
