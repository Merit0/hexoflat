import type { BoardRecipeInput } from '../content/boards/recipe-schema';

interface EditableRule {
  id: string;
  count: number | [number, number];
}

function rulesOf(recipe: BoardRecipeInput): EditableRule[] {
  const pieces = recipe.stages.objects ?? [];
  return pieces
    .filter((piece) => piece.kind === 'rules')
    .flatMap((piece) => (piece as unknown as { rules: EditableRule[] }).rules);
}

export function ruleCount(
  recipe: BoardRecipeInput,
  ruleId: string,
): number | [number, number] | null {
  return rulesOf(recipe).find((rule) => rule.id === ruleId)?.count ?? null;
}

export function adjustRuleCount(
  recipe: BoardRecipeInput,
  ruleId: string,
  delta: number,
): BoardRecipeInput {
  const next = structuredClone(recipe);
  const rule = rulesOf(next).find((candidate) => candidate.id === ruleId);
  if (!rule) throw new Error(`recipe "${recipe.id}" has no rule "${ruleId}"`);

  rule.count = Array.isArray(rule.count)
    ? [Math.max(0, rule.count[0] + delta), Math.max(0, rule.count[1] + delta)]
    : Math.max(0, rule.count + delta);
  return next;
}
