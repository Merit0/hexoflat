import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';

export type TSessionStatus = 'offline' | 'connecting' | 'live' | 'taken-over';

export const LOCAL_HERO_ID = 'hero';

export const inventorySession = {
  status: 'offline' as TSessionStatus,
  heroId: LOCAL_HERO_ID,
  revision: 0,
  idSeq: 0,
  claimedRewards: [] as string[],
  progressRevision: 0,
  knowledge: null as KnowledgeState | null,
  presence: null as ServerPresence | null,
  steps: 0,
  sessionToken: null as string | null,
};

export interface ServerPresence {
  locationKey: string;
  mapId: string;
  coordinates: { columnIndex: number; rowIndex: number };
}

export function resetInventorySession(): void {
  inventorySession.status = 'offline';
  inventorySession.heroId = LOCAL_HERO_ID;
  inventorySession.revision = 0;
  inventorySession.idSeq = 0;
  inventorySession.claimedRewards = [];
  inventorySession.progressRevision = 0;
  inventorySession.knowledge = null;
  inventorySession.presence = null;
  inventorySession.steps = 0;
  inventorySession.sessionToken = null;
}
