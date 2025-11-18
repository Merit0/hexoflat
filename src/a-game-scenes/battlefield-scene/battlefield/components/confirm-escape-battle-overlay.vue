<template>
  <div class="globalOverlay">
    <div class="battle-escape-overlay">
      <p class="modal-text">Use 50 ⚡ energy to escape from the battle?</p>
      <div class="button-container">
        <button class="modal-button cancel" @click="continueFight">Stay</button>
        <button class="modal-button run" @click="escapeBattle">Run</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {useOverlayStore} from '@/stores/overlay-store';
import {useBattleStore} from "@/stores/battle-store";

export default defineComponent({
  name: 'confirm-escape-battle-overlay',
  setup() {
    const overlayStore = useOverlayStore();

    const continueFight = () => {
      overlayStore.closeOverlay('confirm-escape-battle');
    };

    const escapeBattle = () => {
      const battleStore = useBattleStore();
      battleStore.finishBattle();
      overlayStore.closeOverlay();
    };

    return {
      escapeBattle,
      continueFight,
    };
  }
});
</script>

<style>
.battle-escape-overlay {
  position: relative;
  width: 25vw;
  min-width: 300px;
  height: 20vh;
  min-height: 200px;
  border-radius: 1vw;
  margin: auto;
  background: linear-gradient(135deg, #392f2f, #2d221f);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 1vw;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.1);
  max-height: 90vh;
  backdrop-filter: blur(5px);
}

.modal-text {
  font-family: 'Arial', sans-serif;
  font-size: 1.5rem;
  color: #ffea00;
  text-shadow: 0 0 8px rgba(253, 239, 164, 0.5), 0 0 12px rgba(255, 239, 173, 0.3);
  text-align: center;
  margin: 0;
  line-height: 1.4;
}

.button-container {
  display: flex;
  gap: 1rem;
}

.modal-button {
  padding: 0.8rem 2rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, rgba(57, 47, 47, 0.9), rgba(45, 34, 31, 0.9));
  color: #ffea00;
  border: 1px solid rgba(255, 234, 0, 0.3);
  box-shadow: 0 0 10px rgba(255, 234, 0, 0.2);
}

.modal-button:hover {
  background: linear-gradient(135deg, rgba(80, 65, 65, 0.9), rgba(60, 45, 40, 0.9));
  box-shadow: 0 0 15px rgba(255, 234, 0, 0.4);
  transform: translateY(-2px);
}

.modal-button:active {
  transform: translateY(0);
  box-shadow: 0 0 8px rgba(255, 234, 0, 0.2);
}

.modal-button.cancel {
  background: linear-gradient(135deg, rgba(45, 34, 31, 0.9), rgba(30, 20, 15, 0.9));
}

.modal-button.cancel:hover {
  background: linear-gradient(135deg, rgba(60, 45, 40, 0.9), rgba(45, 34, 31, 0.9));
}

</style>
