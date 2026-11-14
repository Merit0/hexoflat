import { computed, shallowRef } from 'vue';
import { LOOT_TIMING } from '@/render/loot-timing';
import type { LootFlightRequest } from './loot-flight';

const current = shallowRef<LootFlightRequest | null>(null);
const pending = new Set<string>();
let sequence = 0;
let safety: ReturnType<typeof setTimeout> | null = null;

export const lootFlightRequest = computed(() => current.value);
export const lootFlying = computed(() => current.value !== null);

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function isLootFlightPending(key: string): boolean {
  return pending.has(key);
}

export function landLootFlight(key: string): void {
  pending.delete(key);
}

export function finishLootFlights(id?: number): void {
  if (id !== undefined && current.value?.id !== id) return;
  if (safety) clearTimeout(safety);
  safety = null;
  pending.clear();
  current.value = null;
}

export function startLootFlights(plan: Omit<LootFlightRequest, 'id'>): void {
  finishLootFlights();
  if (plan.flights.length === 0 || prefersReducedMotion()) return;
  sequence += 1;
  for (const flight of plan.flights) {
    if (flight.landingKey) pending.add(flight.landingKey);
  }
  const request = { ...plan, id: sequence };
  current.value = request;
  safety = setTimeout(() => finishLootFlights(request.id), plan.totalMs + LOOT_TIMING.safetyMs);
}
