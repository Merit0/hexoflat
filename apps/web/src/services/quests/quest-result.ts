import { shallowRef } from 'vue';
import type { DomainEvent } from '@hexoflat/engine/commands/types';

export interface QuestResult {
  questId: string;
  outcome: string;
  numbers: number[];
  answerReview?: boolean[];
  firstDeviation: { number: number; expected: number } | null;
}

export const questResult = shallowRef<QuestResult | null>(null);

export function dismissQuestResult(): void {
  questResult.value = null;
}

export function resultFromEvents(events: readonly DomainEvent[]): QuestResult | null {
  const closing = events.find(
    (event) => event.type === 'QUEST_COMPLETED' || event.type === 'QUEST_FAILED',
  );
  const summary = events.find((event) => event.type === 'QUEST_SUMMARY');
  if (!closing || !summary) return null;
  const payload = closing.payload as {
    questId: string;
    recap: {
      numbers: number[];
      answerReview?: boolean[];
      firstDeviation: QuestResult['firstDeviation'];
    };
  };
  const { outcome } = summary.payload as { outcome: string };
  return {
    questId: payload.questId,
    outcome,
    numbers: payload.recap.numbers,
    ...(payload.recap.answerReview ? { answerReview: payload.recap.answerReview } : {}),
    firstDeviation: payload.recap.firstDeviation,
  };
}

export function captureQuestResult(events: readonly DomainEvent[]): void {
  const result = resultFromEvents(events);
  if (result) questResult.value = result;
}
