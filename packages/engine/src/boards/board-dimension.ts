import { CONTENT } from '../content/content-map';
import type { EDimension } from '../dimensions/dimensions';
import type { StaticBoardDrawing } from '../content/boards/schemas';
import { assertDimensionRelation } from '../dimensions/relation';
import type { THexobjectKey } from '../registry/hexobjects-registry';

export interface BoardPlacementScope {
  id: string;
  dimension: EDimension;
  foreignPlacements?: readonly THexobjectKey[];
}

export function assertBoardPlacement(recipe: BoardPlacementScope, key: THexobjectKey): void {
  assertDimensionRelation(
    `recipe:${recipe.id}`,
    'place',
    key,
    CONTENT[key],
    recipe.dimension,
    recipe.foreignPlacements,
  );
}

export function assertDrawingDimension(
  recipe: BoardPlacementScope,
  drawing: StaticBoardDrawing,
): void {
  if (drawing.dimension !== recipe.dimension)
    throw new Error(
      `recipe:${recipe.id}: draw ${drawing.id} in ${recipe.dimension}; drawing belongs to ${drawing.dimension}`,
    );
  for (const entry of Object.values(drawing.legend))
    assertBoardPlacement(recipe, entry.hexobjectKey);
}
