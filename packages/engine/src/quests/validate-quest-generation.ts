import { ALL_QUESTS } from './all-quests';
import {
  QUEST_GENERATION_PROFILES,
  questGenerationProfileSchema,
  type QuestGenerationProfile,
} from './quest-generation.content';
import { questRewardProfileFailures } from './quest-generation-rewards';
import type { QuestCatalogue, QuestDefinition } from './quest-definition';
import { SEEKER_CARDS, seekerCardFailures, seekerCardOf } from './seeker-content';

function variantFailures(quest: QuestDefinition, { variants }: QuestGenerationProfile): string[] {
  const ids = new Set<string>();
  const targets = new Set<number>();
  const failures: string[] = [];
  for (const { id, target, reward } of variants) {
    if (ids.has(id)) failures.push(`duplicate variant ${id}`);
    if (targets.has(target)) failures.push(`duplicate target ${target}`);
    ids.add(id);
    targets.add(target);
    if (quest.objective.kind === 'count') {
      if (!reward || quest.turnIn !== 'board') failures.push(`${id} needs a board reward`);
      else failures.push(...questRewardProfileFailures(quest, reward));
      continue;
    }
    const card = seekerCardOf(quest.id);
    if (reward || !card) {
      failures.push(`${id} needs a valid Seeker chest profile`);
      continue;
    }
    const adjusted = { ...card, params: { ...card.params, steps: target } };
    failures.push(
      ...seekerCardFailures(SEEKER_CARDS.map((entry) => (entry === card ? adjusted : entry))),
    );
  }
  return failures;
}

export function questGenerationFailures(
  profiles: readonly unknown[] = QUEST_GENERATION_PROFILES,
  catalogue: QuestCatalogue = ALL_QUESTS,
): string[] {
  const failures: string[] = [];
  const seen = new Set<string>();
  for (const profile of profiles) {
    const parsed = questGenerationProfileSchema.safeParse(profile);
    if (!parsed.success) {
      failures.push(parsed.error.message);
      continue;
    }
    const { templateId } = parsed.data;
    if (seen.has(templateId)) failures.push(`${templateId}: duplicate generation profile`);
    seen.add(templateId);
    if (!Object.hasOwn(catalogue, templateId)) {
      failures.push(`${templateId}: unknown quest template`);
      continue;
    }
    failures.push(
      ...variantFailures(catalogue[templateId], parsed.data).map(
        (error) => `${templateId}: ${error}`,
      ),
    );
  }
  for (const id of Object.keys(catalogue)) {
    if (!seen.has(id)) failures.push(`${id}: missing generation profile`);
  }
  return failures;
}
