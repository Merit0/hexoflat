import type { HexObjectPlacementRef } from '../../abstraction/hex-map-placement';
import { AddResourceSpawnerFeature } from '../../features/resource-features/add-resource-spawner-feature';
import type { AddResourceSpawnerCommand } from '../hex-engine-commands';
import type { CommandHandler } from './handler-types';

export const addResourceSpawnerHandler: CommandHandler<AddResourceSpawnerCommand> = (
  state,
  command,
) => {
  const { coordinates, hexobject } = command.payload;
  const tile = state.map.getTileAt(coordinates);

  if (!tile) {
    return [
      {
        type: 'RESOURCE_SPAWNER_REJECTED',
        payload: { coordinates, message: 'No tile at coordinates.' },
      },
    ];
  }

  new AddResourceSpawnerFeature(tile, hexobject as HexObjectPlacementRef).add();

  return [{ type: 'RESOURCE_SPAWNER_ADDED', payload: { coordinates } }];
};
