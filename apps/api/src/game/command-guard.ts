import type { HexEngineCommand } from '@hexoflat/engine';

const HERO_SCOPED = new Set<HexEngineCommand['type']>([
  'MOVE_HERO',
  'START_HEX_ACTION',
  'ADD_RESOURCE_SPAWNER',
  'MOVE_ITEM',
  'AUTO_PLACE_ITEM',
  'STORE_RESOURCES',
  'SORT_STASH',
  'UNLOCK_STASH_CHEST',
]);

const SERVER_ONLY = new Set<HexEngineCommand['type']>(['GRANT_ITEM', 'CONSUME_ITEM']);

export function commandRefusal(
  command: HexEngineCommand,
  controlledHeroId: unknown,
): string | null {
  if (SERVER_ONLY.has(command.type)) return 'This command is only sent by the server';
  if (!HERO_SCOPED.has(command.type)) return null;
  const heroId = (command.payload as { heroId?: string }).heroId;
  return heroId === controlledHeroId ? null : 'Cannot act as a hero you do not control';
}
