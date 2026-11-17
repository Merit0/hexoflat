import { useGameEventsStore } from '@/stores/game-events-store';

export const eventsTestApi = {
  logTestEvents(count: number) {
    if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
    if (!Number.isInteger(count) || count < 1) throw new Error('Invalid fixture');
    const events = useGameEventsStore();
    for (let index = 1; index <= count; index += 1) events.push('Test', `Test event ${index}`);
  },
};
