/**
 * Bump this whenever a content shape/data change would make an old save
 * incompatible (renamed/removed fields, changed groupType, etc). Saves
 * written under a version that `isReadableContentVersion` refuses are
 * discarded on load rather than risking a mismatch with the current content
 * catalog.
 */
export const CONTENT_VERSION = 3;

const READABLE_CONTENT_VERSIONS: readonly unknown[] = [2, CONTENT_VERSION];

export function isReadableContentVersion(version: unknown): boolean {
  return READABLE_CONTENT_VERSIONS.includes(version);
}
