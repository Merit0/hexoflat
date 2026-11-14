import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { lootSchedule } from '@/render/loot-timing';

export interface ChestOpened {
  coordinates: IHexCoordinates;
  placed: { coordinates: IHexCoordinates; itemKey: string; amount: number }[];
  toBag: { itemKey: string; amount: number }[];
}

export interface LootFlight {
  itemKey: string;
  from: IHexCoordinates;
  to: IHexCoordinates | null;
  delayMs: number;
  landingKey: string | null;
}

export interface LootFlightRequest {
  id: number;
  flights: LootFlight[];
  flightMs: number;
  accentMs: number;
  totalMs: number;
}

export function chestOpenedOf(events: readonly DomainEvent[]): ChestOpened | null {
  const event = events.find((candidate) => candidate.type === 'CHEST_OPENED');
  if (!event) return null;
  const payload = event.payload as Partial<ChestOpened>;
  if (!payload.coordinates) return null;
  return {
    coordinates: { ...payload.coordinates },
    placed: payload.placed ?? [],
    toBag: payload.toBag ?? [],
  };
}

export function planLootFlights(opened: ChestOpened, leadMs = 0): Omit<LootFlightRequest, 'id'> {
  const { delaysMs, flightMs, accentMs, totalMs } = lootSchedule(
    opened.placed.length + opened.toBag.length,
    leadMs,
  );
  const from = opened.coordinates;
  const placed: LootFlight[] = opened.placed.map((item, index) => ({
    itemKey: item.itemKey,
    from,
    to: { ...item.coordinates },
    delayMs: delaysMs[index],
    landingKey: coordinateKey(item.coordinates),
  }));
  const toBag: LootFlight[] = opened.toBag.map((item, index) => ({
    itemKey: item.itemKey,
    from,
    to: null,
    delayMs: delaysMs[opened.placed.length + index],
    landingKey: null,
  }));
  return { flights: [...placed, ...toBag], flightMs, accentMs, totalMs };
}

interface GravePayload {
  hex: { q: number; r: number };
  from?: { q: number; r: number };
  nothing?: boolean;
  placed?: { hex: { q: number; r: number }; itemKey: string; amount: number }[];
  toBag?: { itemKey: string; amount: number }[];
}

export function gravePlayedOf(
  events: readonly DomainEvent[],
  offsetOf: (hex: { q: number; r: number }) => IHexCoordinates,
): ChestOpened | null {
  const event = events.find((candidate) => candidate.type === 'GRAVE_LOOTED');
  if (!event) return null;
  const payload = event.payload as GravePayload;
  return {
    coordinates: offsetOf(payload.hex),
    placed: (payload.placed ?? []).map((item) => ({
      coordinates: offsetOf(item.hex),
      itemKey: item.itemKey,
      amount: item.amount,
    })),
    toBag: payload.toBag ?? [],
  };
}

export function graveWalkLeadMs(events: readonly DomainEvent[], stepMs: number): number {
  const event = events.find((candidate) => candidate.type === 'GRAVE_LOOTED');
  if (!event) return 0;
  const { hex, from, nothing } = event.payload as GravePayload;
  if (nothing === true || !from || (from.q === hex.q && from.r === hex.r)) return 0;
  return stepMs;
}
