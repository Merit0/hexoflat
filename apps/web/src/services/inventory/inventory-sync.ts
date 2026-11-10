import type { HexEngineCommand } from '@hexoflat/engine/commands/hex-engine-commands';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { getAuthToken } from '@/api/auth-token';
import { apiClient } from '@/api/client';
import { LOCATION_KEYS } from '@hexoflat/engine/registry/location-key';
import type { Engagement } from '@hexoflat/engine/squads/engagement';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { TileDiff } from '@hexoflat/engine/world/tile-diff';
import type { WorldEffect } from '@hexoflat/engine/world/server-ports';
import { i18n } from '@/i18n';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import {
  PlayerSocket,
  PlayerSocketError,
  type HeroSnapshot,
  type PlayerCommandResponse,
  type PlayerEnvelope,
  type ProjectedAggregate,
  type WorldCommandResponse,
} from '@/services/player/player-socket';
import { cacheServerWorld, enableServerWorlds, resetWorldSync } from '@/services/player/world-sync';
import {
  flushExpedition,
  onExpeditionTakenOver,
  startExpeditionSync,
  stopExpeditionSync,
} from '@/services/player/expedition-sync';
import { observeServerClock } from '@/services/battle/battle-clock';
import { bindInventoryMirror } from './inventory-mirror';
import type { PortalLink } from '@hexoflat/engine/portal/portal-state';
import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';
import { inventorySession, resetInventorySession, type ServerPresence } from './inventory-session';
import { readInventoryState, writeInventoryState } from './inventory-store-io';

export const CAMP_FIRST_CHEST_REWARD = 'camp-first-chest';

const socket = new PlayerSocket();
let chain: Promise<unknown> = Promise.resolve();
let epoch = 0;

function stores() {
  return { inventory: useHeroInventoryStore(), stash: useHeroStashStore() };
}

function warn(text: string): void {
  useHeroToolStore().setActionMessage(text, null, null, 'warn');
}

function applyInventory(projection: ProjectedAggregate | undefined): void {
  if (!projection) return;
  const state = projection.state as InventoryState;
  writeInventoryState(stores(), { ...state, revision: projection.revision });
}

type KnowledgeListener = (knowledge: KnowledgeState | null) => void;
let knowledgeListener: KnowledgeListener | null = null;

let portalListener: ((portal: PortalLink | null) => void) | null = null;

let healthListener: ((health: NonNullable<typeof inventorySession.health>) => void) | null = null;

export function bindHealthListener(listener: typeof healthListener): void {
  healthListener = listener;
}

let killsListener: ((kills: number) => void) | null = null;

export function bindKillsListener(listener: typeof killsListener): void {
  killsListener = listener;
}

export function bindPortalListener(listener: typeof portalListener): void {
  portalListener = listener;
}

export function bindKnowledgeListener(listener: KnowledgeListener | null): void {
  knowledgeListener = listener;
}

export function applyProgress(projection: ProjectedAggregate | undefined): void {
  if (!projection) return;
  const progress = projection.state as {
    claimedRewards?: string[];
    knowledge?: KnowledgeState;
    presence?: ServerPresence | null;
    steps?: number;
    sealedUntil?: Record<string, number>;
    portal?: PortalLink | null;
    health?: { current: number; bonus: number; debt: number };
    kills?: number;
  };
  inventorySession.claimedRewards = progress.claimedRewards ?? [];
  inventorySession.progressRevision = projection.revision;
  inventorySession.knowledge = progress.knowledge ?? null;
  inventorySession.presence = progress.presence ?? null;
  inventorySession.steps = progress.steps ?? 0;
  inventorySession.sealedUntil = progress.sealedUntil ?? {};
  inventorySession.portal = progress.portal ?? null;
  portalListener?.(inventorySession.portal);
  inventorySession.kills = progress.kills ?? 0;
  killsListener?.(inventorySession.kills);
  inventorySession.health = progress.health ?? null;
  if (inventorySession.health) healthListener?.(inventorySession.health);
  knowledgeListener?.(inventorySession.knowledge);
}

function applySnapshot(aggregates: HeroSnapshot['aggregates']): void {
  applyInventory(aggregates.inventory);
  applyProgress(aggregates.progress);
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job);
  chain = run.catch(() => undefined);
  return run;
}

function envelope(
  type: string,
  payload: Record<string, unknown>,
  expectedRevision: number,
): PlayerEnvelope {
  return {
    commandId: crypto.randomUUID(),
    heroId: inventorySession.heroId,
    aggregate: 'inventory',
    expectedRevision,
    command: {
      type,
      payload: { heroId: inventorySession.heroId, revision: expectedRevision, ...payload },
    },
  };
}

function lost(error: unknown): void {
  epoch += 1;
  if (error instanceof PlayerSocketError && error.code === 'SESSION_TAKEN_OVER') {
    inventorySession.status = 'taken-over';
    warn(i18n.global.t('player.sync.takenOver'));
    return;
  }
  inventorySession.status = 'offline';
  warn(i18n.global.t('player.sync.offline'));
}

async function sendMirrored(env: PlayerEnvelope, jobEpoch: number): Promise<void> {
  if (jobEpoch !== epoch || inventorySession.status !== 'live') return;
  let response: PlayerCommandResponse;
  try {
    response = await socket.send(env);
  } catch (error) {
    lost(error);
    return;
  }
  if (jobEpoch !== epoch) return;
  applyProgress(response.aggregates.progress);
  const confirmed = response.aggregates.inventory?.revision;
  if (response.result === 'applied' && confirmed === env.expectedRevision + 1) return;
  epoch += 1;
  applySnapshot(response.aggregates);
  warn(i18n.global.t('player.sync.restored'));
}

function mapCommand(command: HexEngineCommand): { type: string; payload: Record<string, unknown> } {
  switch (command.type) {
    case 'GRANT_ITEM':
      return {
        type: 'DEV_GRANT_ITEM',
        payload: { key: command.payload.key, amount: command.payload.amount },
      };
    case 'CONSUME_ITEM':
      return {
        type: 'DEV_CONSUME_ITEM',
        payload: { key: command.payload.key, amount: command.payload.amount },
      };
    default: {
      const payload: Record<string, unknown> = { ...command.payload };
      delete payload.heroId;
      delete payload.revision;
      return { type: command.type, payload };
    }
  }
}

function send(type: string, payload: Record<string, unknown>, expected: number): void {
  const env = envelope(type, payload, expected);
  const jobEpoch = epoch;
  void enqueue(() => sendMirrored(env, jobEpoch));
}

bindInventoryMirror({
  command(command, before) {
    if (inventorySession.status !== 'live') return;
    const mapped = mapCommand(command);
    send(mapped.type, mapped.payload, before.revision);
  },
});

export async function startPlayerSession(heroId: string): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;
  resetInventorySession();
  inventorySession.heroId = heroId;
  inventorySession.status = 'connecting';
  epoch += 1;
  try {
    socket.onTakenOver(() => lost(new PlayerSocketError('SESSION_TAKEN_OVER')));
    await socket.connect(token);
    const snapshot = await socket.subscribe(heroId);
    applySnapshot(snapshot.aggregates);
    inventorySession.sessionToken = snapshot.sessionToken ?? null;
    await startExpeditionSync();
    await loadWorldCache();
    inventorySession.status = 'live';
    onExpeditionTakenOver(() => lost(new PlayerSocketError('SESSION_TAKEN_OVER')));
    return true;
  } catch {
    inventorySession.status = 'offline';
    return false;
  }
}

export function endPlayerSession(): void {
  epoch += 1;
  stopExpeditionSync();
  resetWorldSync();
  socket.close();
  resetInventorySession();
}

export function settleInventorySync(): Promise<void> {
  return chain.then(() => flushExpedition());
}

export function pushInventoryFixture(): void {
  if (inventorySession.status !== 'live') return;
  const current = readInventoryState(stores());
  inventorySession.revision = current.revision + 1;
  send('DEV_SET_INVENTORY', { inventory: current }, current.revision);
}

export type ClaimOutcome = { ok: true } | { ok: false; code: string };

export function claimCampChest(): Promise<ClaimOutcome> {
  if (inventorySession.claimedRewards.includes(CAMP_FIRST_CHEST_REWARD)) {
    return Promise.resolve({ ok: true });
  }
  if (inventorySession.status !== 'live') return Promise.resolve({ ok: false, code: 'OFFLINE' });
  return enqueue(async (): Promise<ClaimOutcome> => {
    try {
      const response = await socket.send(
        envelope('CLAIM_CAMP_CHEST', {}, inventorySession.revision),
      );
      applySnapshot(response.aggregates);
      return response.result === 'applied' || response.code === 'ALREADY_CLAIMED'
        ? { ok: true }
        : { ok: false, code: response.code ?? response.result };
    } catch (error) {
      lost(error);
      return { ok: false, code: error instanceof PlayerSocketError ? error.code : 'OFFLINE' };
    }
  });
}

export interface ProgressResult {
  ok: boolean;
  code?: string;
  knowledge: KnowledgeState | null;
}

export function sendProgress(
  type: string,
  payload: Record<string, unknown>,
  options: { withKnowledgeRevision?: boolean } = {},
): Promise<ProgressResult> {
  const withRevision = options.withKnowledgeRevision !== false;
  if (inventorySession.status !== 'live') {
    return Promise.resolve({ ok: false, code: 'OFFLINE', knowledge: inventorySession.knowledge });
  }
  return enqueue(async (): Promise<ProgressResult> => {
    const expectedRevision = inventorySession.progressRevision;
    const env: PlayerEnvelope = {
      commandId: crypto.randomUUID(),
      heroId: inventorySession.heroId,
      aggregate: 'progress',
      expectedRevision,
      command: {
        type,
        payload: {
          heroId: inventorySession.heroId,
          ...(withRevision ? { revision: inventorySession.knowledge?.revision ?? 0 } : {}),
          ...payload,
        },
      },
    };
    let response: PlayerCommandResponse;
    try {
      response = await socket.send(env);
    } catch (error) {
      lost(error);
      const code = error instanceof PlayerSocketError ? error.code : 'OFFLINE';
      return { ok: false, code, knowledge: inventorySession.knowledge };
    }
    applyProgress(response.aggregates.progress);
    if (response.result === 'conflict') warn(i18n.global.t('player.sync.restored'));
    return {
      ok: response.result === 'applied',
      ...(response.result === 'applied' ? {} : { code: response.code ?? response.result }),
      knowledge: inventorySession.knowledge,
    };
  });
}

export async function ensurePresence(
  now: { locationKey: string; mapId: string } | null,
): Promise<void> {
  if (!now) return;
  const known = inventorySession.presence;
  if (known && known.locationKey === now.locationKey && known.mapId === now.mapId) return;
  await sendWorldCommand('WORLD_ENTER', { locationKey: now.locationKey });
}

async function loadWorldCache(): Promise<void> {
  const headers = { 'X-Player-Session': inventorySession.sessionToken ?? '' };
  for (const locationKey of LOCATION_KEYS) {
    const world = await apiClient.post<unknown>(
      '/player/world/ensure',
      { locationKey },
      { headers },
    );
    cacheServerWorld(locationKey, (world as { mapId: string }).mapId, JSON.stringify(world));
  }
  enableServerWorlds();
}

export interface WorldCommandResult {
  ok: boolean;
  code?: string;
  tileDiffs: TileDiff[];
  events: DomainEvent[];
  effects: WorldEffect[];
  engagement: Engagement | null;
  travel?: WorldCommandResponse['travel'];
  touched?: WorldCommandResponse['touched'];
  steps: NonNullable<WorldCommandResponse['steps']>;
  serverNowMs: number | null;
}

export type WorldStepResult = WorldCommandResult;

export function sendWorldCommand(
  type:
    | 'WORLD_ENTER'
    | 'WORLD_STEP'
    | 'WORLD_ACTION'
    | 'WORLD_TICK'
    | 'WORLD_TRAVEL'
    | 'WORLD_PORTAL_OPEN'
    | 'WORLD_PORTAL_ENTER'
    | 'WORLD_PORTAL_CLOSE'
    | 'WORLD_BATTLE',
  payload: Record<string, unknown>,
): Promise<WorldCommandResult> {
  const failed = (code: string): WorldCommandResult => ({
    ok: false,
    code,
    tileDiffs: [],
    events: [],
    effects: [],
    engagement: null,
    steps: [],
    serverNowMs: null,
  });
  if (inventorySession.status !== 'live') return Promise.resolve(failed('OFFLINE'));
  return enqueue(async (): Promise<WorldCommandResult> => {
    const env: PlayerEnvelope = {
      commandId: crypto.randomUUID(),
      heroId: inventorySession.heroId,
      aggregate: 'progress',
      expectedRevision: inventorySession.progressRevision,
      command: { type, payload: { heroId: inventorySession.heroId, ...payload } },
    };
    let response: WorldCommandResponse;
    const sentAt = Date.now();
    try {
      response = await socket.sendWorld(env);
    } catch (error) {
      lost(error);
      const code = error instanceof PlayerSocketError ? error.code : 'OFFLINE';
      return failed(code === 'DISCONNECTED' ? 'CONNECTION_LOST' : code);
    }
    if (typeof response.serverNowMs === 'number') {
      observeServerClock(response.serverNowMs, sentAt, Date.now());
    }
    applyProgress(response.aggregates.progress);
    const inventory = response.aggregates.inventory;
    if (inventory && inventory.revision !== inventorySession.revision) applyInventory(inventory);
    if (response.result === 'conflict') warn(i18n.global.t('player.sync.restored'));
    const common = {
      tileDiffs: response.tileDiffs as TileDiff[],
      events: response.events as DomainEvent[],
      effects: response.effects as WorldEffect[],
      engagement: (response.engagement as Engagement | null | undefined) ?? null,
      travel: response.travel,
      touched: response.touched,
      steps: response.steps ?? [],
      serverNowMs: response.serverNowMs ?? null,
    };
    if (response.result !== 'applied') {
      return { ...common, ok: false, code: response.code ?? response.result };
    }
    return { ...common, ok: true, ...(response.code ? { code: response.code } : {}) };
  });
}

export function sendWorldStep(target: {
  columnIndex: number;
  rowIndex: number;
}): Promise<WorldCommandResult> {
  return sendWorldCommand('WORLD_STEP', { target });
}

export function pushHealthFixture(current: number): Promise<ProgressResult> {
  return sendProgress('DEV_SET_HEALTH', { current }, { withKnowledgeRevision: false });
}

export function pushKnowledgeFixture(knowledge: KnowledgeState): void {
  if (inventorySession.status !== 'live') return;
  inventorySession.knowledge = knowledge;
  void sendProgress('DEV_SET_KNOWLEDGE', { knowledge });
}
