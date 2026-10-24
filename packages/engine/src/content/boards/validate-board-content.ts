import { StaticBoardDrawingSchema } from './schemas';
import { RecipeSchema } from './recipe-schema';
import { STATIC_DRAWINGS } from './index';
import { CAVE_MODEL } from './models/cave';
import { CAMPING_RECIPE, SILESIA_RECIPE } from './recipes';

const RECIPES = [CAMPING_RECIPE, SILESIA_RECIPE, CAVE_MODEL];

export function validateBoardContent(): void {
  for (const drawing of STATIC_DRAWINGS) {
    const result = StaticBoardDrawingSchema.safeParse(drawing);
    if (!result.success) {
      throw new Error(
        `static drawing "${drawing.id}" failed content schema validation:\n${result.error.message}`,
      );
    }
  }
  for (const recipe of RECIPES) {
    const result = RecipeSchema.safeParse(recipe);
    if (!result.success) {
      throw new Error(
        `recipe "${recipe.id}" failed content schema validation:\n${result.error.message}`,
      );
    }
  }
}
