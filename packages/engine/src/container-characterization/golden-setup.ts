import { axialToOffset } from '../utils/hex-utils';
import { actWorld } from '../world';
import { chestScene, openAction, runOf } from '../chests/chest-test-setup';
import { king, lootAt, play, TARGET, warrior, won } from '../battle/collect-test-setup';
import { followTruth, must, openChestOf, startQuest } from '../quests/seeker-test-setup';

export const GOLDEN_SEEDS = Array.from({ length: 20 }, (_, index) => `golden-${index + 1}`);

interface Stack {
  itemKey: string;
  amount: number;
}

const stack = (item: Stack) => `${item.itemKey}x${item.amount}`;

export function listOf(items: readonly Stack[]): string {
  return items.map(stack).join(',') || '-';
}

export function placementsOf(
  placed: readonly (Stack & { at: string })[],
  toBag: readonly Stack[],
): string {
  const spots = placed.map((item) => `${item.at}=${stack(item)}`).join(';') || '-';
  return `${spots} | bag ${listOf(toBag)}`;
}

export function worldChestGolden(seed: string): string {
  const scene = chestScene(seed);
  const outcome = actWorld(runOf(scene.world), openAction(scene.chest));
  if (!outcome.ok) throw new Error(outcome.code);
  const payload = outcome.events.find((event) => event.type === 'CONTAINER_OPENED')!.payload as {
    placed: { hex: { q: number; r: number }; itemKey: string; amount: number }[];
    toBag: Stack[];
  };
  return placementsOf(
    payload.placed.map((item) => {
      const at = axialToOffset(item.hex);
      return { ...item, at: `${at.columnIndex},${at.rowIndex}` };
    }),
    payload.toBag,
  );
}

export const GOLDEN_GRAVE_MAP = 'golden-map';

export function graveGolden(seed: string, kind: 'warrior' | 'king'): string {
  const enemy = kind === 'king' ? king('e1', TARGET) : warrior('e1', TARGET);
  const played = play(
    won([enemy], { tokenSecret: { seed, mapId: GOLDEN_GRAVE_MAP } }),
    lootAt(TARGET),
  );
  const payload = played.events.find((event) => event.type === 'CONTAINER_OPENED')!.payload as {
    placed: { hex: { q: number; r: number }; itemKey: string; amount: number }[];
    toBag: Stack[];
    nothing?: boolean;
  };
  const text = placementsOf(
    payload.placed.map((item) => ({ ...item, at: `${item.hex.q},${item.hex.r}` })),
    payload.toBag,
  );
  return payload.nothing ? `nothing ${text}` : text;
}

export function questChestGolden(seed: string): { stored: string; text: string } {
  const state = startQuest('seeker-1', seed);
  const end = followTruth(state, 10);
  const stored = listOf(end.run.chest!.container?.contents?.[0] ?? end.run.chest!.drop ?? []);
  const opened = must(openChestOf(state, end));
  const payload = opened.events[0].payload as {
    placed: { hex: { q: number; r: number }; itemKey: string; amount: number }[];
    toBag: Stack[];
  };
  return {
    stored,
    text: placementsOf(
      payload.placed.map((item) => {
        const at = axialToOffset(item.hex);
        return { ...item, at: `${at.columnIndex},${at.rowIndex}` };
      }),
      payload.toBag,
    ),
  };
}

export const keysOf = (value: unknown): string[] => Object.keys(value as object).sort();
