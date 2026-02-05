import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {GameEventLogItem, GameEventType} from "@/a-game-scenes/game-events-logger/models/game-event-model";

const MAX_EVENTS = 50;

function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useGameEventsStore = defineStore("game-events", () => {
    const events = ref<GameEventLogItem[]>([]);

    function clear() {
        events.value = [];
    }

    function push(actorName: string, message: string, type: GameEventType = "INFO") {
        const item: GameEventLogItem = {
            actor: actorName,
            id: uid(),
            message,
            type,
            createdAt: Date.now(),
        };

        events.value.unshift(item);

        if (events.value.length > MAX_EVENTS) {
            events.value.length = MAX_EVENTS;
        }
    }

    const lastTwo = computed(() => events.value.slice(0, 2));
    const hasEvents = computed(() => events.value.length > 0);

    return {
        events,
        lastTwo,
        hasEvents,
        push,
        clear,
    };
});