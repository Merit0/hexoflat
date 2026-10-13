import { applyCommand, type HexEngineActionContext } from '@hexoflat/engine';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { StartHexActionCommand } from '@hexoflat/engine/commands/hex-engine-commands';
import type { KnowledgeAction, KnowledgeContext } from '@hexoflat/engine/knowledge/commands';
import type { WillZone } from '@hexoflat/engine/knowledge/will-zone';
import { MapRegistry, type LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';
import { transactKnowledge } from '@/services/persistence/knowledge-storage';

export { canReachBook as isAtKnowledgeBook } from '@hexoflat/engine/knowledge/camp-book';

export interface KnowledgeHost {
  heroId: string;
  state: KnowledgeState;
  map: HexMapModel;
  context: KnowledgeContext;
  engineContext: HexEngineActionContext;
  isCurrent(): boolean;
}

export async function dispatchKnowledge(host: KnowledgeHost, action: KnowledgeAction) {
  let accepted = false;
  const state = await transactKnowledge(host.heroId, (knowledge) => {
    if (!host.isCurrent()) return false;
    const { events } = applyCommand(
      { map: host.map, heroes: {}, knowledge, knowledgeContext: host.context },
      {
        type: 'KNOWLEDGE',
        payload: { heroId: host.heroId, revision: host.state.revision, action },
      },
      host.engineContext,
    );
    accepted = events.some((event) => event.type === 'KNOWLEDGE_CHANGED');
    return accepted;
  });
  return { state, accepted };
}

export function locationWillZone(locationKey: LocationKey): WillZone {
  return MapRegistry.get(locationKey)?.willZone ?? 'paid';
}

export async function dispatchHexAction(
  host: Omit<KnowledgeHost, 'state'>,
  command: StartHexActionCommand,
) {
  let events: DomainEvent[] = [];
  const state = await transactKnowledge(host.heroId, (knowledge) => {
    if (!host.isCurrent()) return false;
    events = applyCommand(
      { map: host.map, heroes: {}, knowledge, knowledgeContext: host.context },
      command,
      host.engineContext,
    ).events;
    return events.some((event) => event.type === 'WILL_SPENT');
  });
  return { state, events };
}
