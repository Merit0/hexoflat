import { HEXOBJECT_KEYS } from '../../../registry/hexobjects-registry';
import { CAMPING_BOARD } from '../static/camping';
import { staticRecipe } from './static-recipe';

export const CAMPING_RECIPE = staticRecipe(CAMPING_BOARD, {
  fog: 'ALL_REVEALED',
  entryObject: HEXOBJECT_KEYS.HOMELAND_GATE,
});
