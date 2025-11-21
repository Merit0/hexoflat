<template>
  <section class="login-page">
    <main class="login-container">
      <div class="login-form-image">
        <login-form></login-form>
      </div>
    </main>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import GameLogo from "@/a-game-scenes/login-scene/components/game-logo.vue";
import LoginForm from "@/a-game-scenes/login-scene/components/login-form.vue";


export default defineComponent({
  components: {LoginForm, GameLogo},
})
</script>
<style scoped>
@import '@/a-game-scenes/login-scene/styles/login-scene-style.css';
</style>
