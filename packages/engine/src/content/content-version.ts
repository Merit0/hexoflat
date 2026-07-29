/**
 * Bump this whenever a content shape/data change would make an old save
 * incompatible (renamed/removed fields, changed groupType, etc). Saves
 * written under an older CONTENT_VERSION are discarded on load rather than
 * risking a mismatch with the current content catalog.
 */
export const CONTENT_VERSION = 1;
