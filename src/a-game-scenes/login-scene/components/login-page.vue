<template>
  <section class="login-page">
    <video class="background-video" autoplay muted loop playsinline>
      <source src="/src/a-game-scenes/login-scene/assets/login-page-video.mp4" type="video/mp4">
      Your browser does not support the video tag.
    </video>
    <div class="video-overlay">
      <game-logo imageSrc="/src/a-game-scenes/login-scene/assets/monstrum-logo.png"></game-logo>
    </div>
    <main class="login-container">
      <login-form></login-form>
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
