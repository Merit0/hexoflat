import type { HexEngineCommand } from '@hexoflat/engine/commands/hex-engine-commands';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';

export interface InventoryMirrorHandler {
  command(command: HexEngineCommand, before: InventoryState): void;
}

let handler: InventoryMirrorHandler | null = null;

export function bindInventoryMirror(next: InventoryMirrorHandler | null): void {
  handler = next;
}

export function mirrorLocalCommand(command: HexEngineCommand, before: InventoryState): void {
  handler?.command(command, before);
}
