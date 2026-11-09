import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';
import { setAuthToken } from '@/api/auth-token';
import { inventorySession, resetInventorySession } from '@/services/inventory/inventory-session';
import { applyProgress } from '@/services/inventory/inventory-sync';
import { resetFakePlayerServer, snapshot } from './fake-player-server';

export function seedFakeSession(
  heroId: string,
  start: { will?: number; skills?: KnowledgeState['skills'] } = {},
): void {
  resetFakePlayerServer(heroId, (progress) => {
    if (start.will !== undefined) progress.knowledge.current = start.will;
    if (start.skills) progress.knowledge.skills = start.skills;
  });
  setAuthToken('token');
  resetInventorySession();
  inventorySession.heroId = heroId;
  inventorySession.status = 'live';
  const { aggregates } = snapshot();
  applyProgress(aggregates.progress);
  inventorySession.claimedRewards = ['camp-first-chest'];
}
