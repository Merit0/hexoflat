export const MAP_MISMATCH = 'MAP_MISMATCH';

export function mapRefusal(
  presence: { mapId: string } | null | undefined,
  command: { payload: unknown },
): typeof MAP_MISMATCH | null {
  const { payload } = command;
  if (!presence || typeof payload !== 'object' || payload === null) return null;
  if (!('expectedMapId' in payload)) return null;
  return payload.expectedMapId === presence.mapId ? null : MAP_MISMATCH;
}
