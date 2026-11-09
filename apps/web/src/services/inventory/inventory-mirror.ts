import type { HexEngineCommand } from '@hexoflat/engine/commands/hex-engine-commands';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';

/**
 * The seam between the synchronous local inventory (the stores run the engine at once, so a drag
 * feels instant) and the server (the authority). `inventory-store-io` calls it after every
 * committed local change; `inventory-sync` binds it. A separate module so neither imports the other.
 */
export interface InventoryMirrorHandler {
  command(command: HexEngineCommand, before: InventoryState): void;
  world(before: InventoryState, after: InventoryState): void;
}

let handler: InventoryMirrorHandler | null = null;

export function bindInventoryMirror(next: InventoryMirrorHandler | null): void {
  handler = next;
}

export function mirrorLocalCommand(command: HexEngineCommand, before: InventoryState): void {
  handler?.command(command, before);
}

export function mirrorWorldChange(before: InventoryState, after: InventoryState): void {
  if (before !== after) handler?.world(before, after);
}
