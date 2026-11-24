import { describe, expect, it } from 'vitest';
import { createApp, nextTick } from 'vue';
import { EDimension } from '@hexoflat/engine/dimensions/dimensions';
import { ETokenType } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { resolveItemTooltip } from '@hexoflat/engine/utils/inventory/item-tooltip';
import { baseTestToken, uniqueTestToken } from '@/test-support/token-fixtures';
import { withToken } from '@/composables/use-item-tooltip';
import { buildHexInfo } from '@/services/hex-info/build-hex-info';
import { buildBattleHexInfo } from '@/services/hex-info/build-battle-hex-info';
import { EMPTY_FIELD } from '@/services/quests/quest-field-model';
import { questHoverObject } from '@/services/quests/quest-hover-object';
import { getObjectLightName } from '@/render/light';
import { i18n } from '@/i18n';
import DimensionLabel from '@/components/gui/dimension-label.vue';

const t = (key: string) => key;
const hex = { columnIndex: 1, rowIndex: 1 };

describe('dimension presentation uses the concrete token', () => {
  it.each([
    [ETokenType.GLOOM, EDimension.UNDERWORLD],
    [ETokenType.SPARK, EDimension.HEAVEN],
  ])('retains %s ownership through field and tooltip presentation', (tokenType, dimension) => {
    const token = baseTestToken('sword', tokenType);
    const object = questHoverObject(
      { ...EMPTY_FIELD, ground: [{ hex, itemKey: 'sword', amount: 1, token }] },
      hex,
    )!;
    expect(object.token).toEqual(token);
    expect(buildHexInfo(object, 'Gear', t, () => false).dimension).toBe(dimension);
    expect(getObjectLightName(object)).toBe(tokenType);
    expect(withToken(resolveItemTooltip('sword'), token).dimension).toBe(dimension);
    const battleView = buildBattleHexInfo(
      { q: 1, r: 1 },
      {
        board: {},
        creatures: [],
        boulders: [],
        collect: {
          graves: [],
          items: [{ hex: { q: 1, r: 1 }, itemKey: 'sword', amount: 1, token }],
        },
      },
      t,
      () => false,
    );
    expect(battleView?.dimension).toBe(dimension);
    expect(battleView?.tokenType?.tone).toBe(tokenType);
  });

  it('displays the ALIEN unique as Nowhere while coins keep Earth ownership without a light', () => {
    const alien = uniqueTestToken('last-verdict');
    const view = withToken(resolveItemTooltip('sword'), alien);
    expect(view).toMatchObject({ dimension: EDimension.NOWHERE, lightName: 'alien' });
    const coin = questHoverObject(
      { ...EMPTY_FIELD, ground: [{ hex, itemKey: 'coins', amount: 7 }] },
      hex,
    )!;
    expect(buildHexInfo(coin, 'Loot', t, () => false).dimension).toBe(EDimension.EARTH);
    expect(getObjectLightName(coin)).toBeNull();
  });

  it.each([
    ['en', ['Heaven', 'Earth', 'Underworld', 'Nowhere']],
    ['uk', ['Небо', 'Земля', 'Підземний світ', 'Ніде']],
  ] as const)('renders every dimension in %s', async (locale, labels) => {
    const previous = i18n.global.locale.value;
    i18n.global.locale.value = locale;
    try {
      for (const [index, dimension] of Object.values(EDimension).entries()) {
        const host = document.createElement('div');
        const app = createApp(DimensionLabel, { dimension }).use(i18n);
        try {
          app.mount(host);
          await nextTick();
          expect(host.textContent).toContain(labels[index]);
        } finally {
          app.unmount();
        }
      }
    } finally {
      i18n.global.locale.value = previous;
    }
  });
});
