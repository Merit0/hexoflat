import { HEXOBJECT_KEYS } from '../../../registry/hexobjects-registry';
import { SILESIA_BOARD } from '../static/silesia';
import { staticRecipe } from './static-recipe';

export const SILESIA_RECIPE = staticRecipe(SILESIA_BOARD, {
  fog: 'FOG',
  entryObject: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
});
