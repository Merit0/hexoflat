<template>
  <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
</template>

<style scoped>
.ornament {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
.ornament span {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.22), transparent);
}
.ornament i {
  width: 9px;
  height: 9px;
  border: 1px solid rgba(255, 220, 150, 0.55);
  transform: rotate(45deg);
}
</style>
