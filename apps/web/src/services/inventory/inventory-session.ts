export type TSessionStatus = 'offline' | 'connecting' | 'live' | 'taken-over';

export const LOCAL_HERO_ID = 'hero';

/** What the web knows about the server-side copy of the hero's inventory. Not reactive on purpose. */
export const inventorySession = {
  status: 'offline' as TSessionStatus,
  heroId: LOCAL_HERO_ID,
  revision: 0,
  idSeq: 0,
  claimedRewards: [] as string[],
};

export function resetInventorySession(): void {
  inventorySession.status = 'offline';
  inventorySession.heroId = LOCAL_HERO_ID;
  inventorySession.revision = 0;
  inventorySession.idSeq = 0;
  inventorySession.claimedRewards = [];
}
