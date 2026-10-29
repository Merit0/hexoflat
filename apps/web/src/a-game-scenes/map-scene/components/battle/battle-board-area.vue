<template>
  <div class="battle-area" data-testid="battle-board-area">
    <battle-board
      v-if="view.board"
      class="battle-area__board"
      :scene="view.board.scene"
      :overlay="view.board.overlay"
      :banner="view.board.banner"
      :take-events="store.takeEvents"
      @hex-tap="tapHex"
      @animating="store.setAnimating"
    >
      <battle-timed-task v-if="view.task" :task="view.task" @answer="answer" @timeout="timeout" />
    </battle-board>
    <battle-board-legend />
  </div>
</template>

<script setup lang="ts">
import BattleBoard from '@/components/battle/battle-board.vue';
import BattleBoardLegend from '@/components/battle/battle-board-legend.vue';
import { useBattleView } from '@/composables/use-battle-view';
import { useBattleStore } from '@/stores/battle-store';
import BattleTimedTask from './battle-timed-task.vue';

const store = useBattleStore();
const { view, tapHex, answer, timeout } = useBattleView();
</script>

<style scoped>
.battle-area {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.battle-area__board {
  flex: 1;
  min-height: 0;
}
</style>
