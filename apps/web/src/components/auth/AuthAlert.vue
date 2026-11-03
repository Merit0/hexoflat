<template>
  <p class="alert" role="alert" data-testid="auth-error">{{ message }}</p>
</template>

<script setup lang="ts">
defineProps<{ message: string }>();
</script>

<style scoped>
.alert {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--pow-error-bg);
  border: 1px solid var(--pow-error-border);
  color: var(--pow-error-text);
  font-size: 14px;
}
</style>
