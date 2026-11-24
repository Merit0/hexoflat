import { locationDropContext } from '../registry/location-drop-context';
import { describe, expect, it } from 'vitest';
import { createContainer } from '../containers';
import { lootTableOf } from '../content/loot-tables.content';
import { DEFAULT_DROP_CONTEXT } from '../tokens/drop-context';
import { sampleToken } from '../tokens/token-test-setup';
import {
  battleWith,
  giveTurn,
  hero,
  heroDoes,
  skeleton,
  strikeOpened,
  enemyDoes,
} from './battle-test-setup';
import { graveLootSource, graveTokenSource } from './grave-token-source';
import { battleStateSchema, type BattleState } from './battle-state';
import { hexKey } from './hex-battle-geom';
import { applyDamage } from './battle-end';
import { enterCollectPhase } from './collect';
import { createGraveContainer } from './grave-contents';
import { trophyBonusFor } from './trophy-bonus';
import { lootAt, play } from './collect-test-setup';
import { projectBattleForViewer } from './projection';

const TARGET = { q: 1, r: 0 };

function ready(bonus = 0): BattleState {
  const player = hero({ q: 0, r: 0 });
  player.hands.right!.token = sampleToken({
    attributes: bonus ? [{ key: 'trophy', value: bonus }] : [],
  });
  const state = giveTurn(battleWith([player, skeleton('target', TARGET, { hp: 1 })]), [
    'hero',
    'target',
  ]);
  state.dropContext = locationDropContext('cave');
  return state;
}

function kill(state: BattleState) {
  return heroDoes(state, { kind: 'strike', targetId: 'target', hand: 'right' });
}

function baseline(state: BattleState) {
  const grave = state.collect!.graves[0];
  return createContainer({
    id: hexKey(grave.hex),
    kind: 'grave',
    at: grave.hex,
    tables: grave.tables.map((id) => lootTableOf(id)),
    ...graveLootSource(state, hexKey(grave.hex)),
    dropContext: state.dropContext ?? DEFAULT_DROP_CONTEXT,
    tokenSource: graveTokenSource(state),
  });
}

describe('A09 grave characterization', () => {
  it('a normal lethal strike creates the unchanged pre-rolled container', () => {
    const before = ready();
    const result = kill(before);
    expect(result.battle.outcome).toBe('victory');
    expect(result.events.some((event) => event.type === 'CREATURE_FELL')).toBe(true);
    expect(result.battle.collect!.graves[0].container).toEqual(baseline(result.battle));
    expect(before.creatures.find((creature) => creature.id === 'target')!.hp).toBe(1);
  });

  it('save/load retains the fixed loot before the grave is examined', () => {
    const state = kill(ready()).battle;
    const loaded = battleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(loaded.collect!.graves[0].container).toEqual(state.collect!.graves[0].container);
  });
});

describe('A09 lethal weapon Trophy', () => {
  it('keeps bonus lists aligned when an old grave names an unavailable table', () => {
    const state = kill(ready(2)).battle;
    const grave = state.collect!.graves[0];
    const expected = createGraveContainer(state, grave);
    expect(
      createGraveContainer(state, {
        ...grave,
        tables: ['unavailable-table', ...grave.tables],
        trophyBonuses: [1, 2],
      }),
    ).toEqual(expected);
  });

  it.each([1, 2, 9])(
    'captures +%s with cap 2 and appends draws without changing base loot',
    (value) => {
      const state = kill(ready(value)).battle;
      const bonus = Math.min(value, 2);
      const corpse = state.creatures.find((creature) => creature.id === 'target')!;
      expect(corpse.trophyBonus).toBe(bonus);
      const grave = state.collect!.graves[0];
      expect(grave.trophyBonuses).toEqual([bonus]);
      const base = baseline(state).contents![0];
      const contents = grave.container!.contents![0];
      expect(contents.slice(0, base.length)).toEqual(base);
      expect(contents).toHaveLength(base.length + bonus);
      expect(contents.slice(base.length).every((drop) => !drop.guaranteed)).toBe(true);
      expect(createGraveContainer(state, grave)).toEqual(grave.container);
    },
  );

  it('ignores the bag, other hand and non-hand equipment', () => {
    const state = ready();
    const player = state.creatures[0];
    const token = sampleToken({ attributes: [{ key: 'trophy', value: 2 }] });
    player.hands.left!.token = token;
    player.bag.push({ key: 'sword', power: 2, token });
    player.equipment = [{ key: 'sword', token }];
    const result = kill(state).battle;
    expect(result.creatures[1].trophyBonus).toBeUndefined();
    expect(result.collect!.graves[0].container).toEqual(baseline(result));
  });

  it('uses the actual lethal hand and grants nothing for an earlier nonlethal hit', () => {
    const before = ready(2);
    before.creatures[1].hp = 3;
    const hurt = kill(before).battle;
    expect(hurt.creatures[1].hp).toBe(1);
    expect(hurt.creatures[1].trophyBonus).toBeUndefined();
    hurt.creatures[0].hands.left = {
      key: 'sword',
      power: 2,
      token: sampleToken({ attributes: [{ key: 'trophy', value: 1 }] }),
    };
    const result = heroDoes(giveTurn(hurt, ['hero', 'target']), {
      kind: 'strike',
      targetId: 'target',
      hand: 'left',
    }).battle;
    expect(result.creatures[1].trophyBonus).toBe(1);
    expect(result.collect!.graves[0].trophyBonuses).toEqual([1]);
  });

  it('gives sweep victims the same weapon bonus and preserves it across equipment changes', () => {
    const before = ready(2);
    before.creatures.push(skeleton('sweep', { q: 0, r: 1 }, { hp: 1 }));
    before.order.push('sweep');
    const result = kill(before).battle;
    expect(
      result.creatures
        .filter((creature) => creature.side === 'enemies')
        .map((creature) => creature.trophyBonus),
    ).toEqual([2, 2]);
    result.creatures[0].hands.right = null;
    const loaded = battleStateSchema.parse(JSON.parse(JSON.stringify(result)));
    expect(loaded.collect).toEqual(result.collect);
    expect(loaded.collect!.graves.map((grave) => grave.trophyBonuses)).toEqual([[2], [2]]);
  });

  it('does not award Trophy for environmental damage or enemy weapons', () => {
    const state = ready(2);
    applyDamage(state, state.creatures[1], 99);
    expect(state.collect!.graves[0].trophyBonuses).toBeUndefined();
    expect(
      trophyBonusFor({ ...state.creatures[0], side: 'enemies' }, state.creatures[0].hands.right),
    ).toBe(0);
  });

  it('a blocked hit does not capture a Trophy bonus', () => {
    const state = ready(2);
    state.creatures[1].hands.left = { key: 'bone-buckler', shieldCapacity: 2 };
    const pending = strikeOpened(state, 'hero', 'target');
    const shielded = enemyDoes(
      pending,
      { kind: 'place-shield', hex: { q: 0, r: 0 } },
      'target',
    ).battle;
    const result = enemyDoes(shielded, { kind: 'reaction-timeout' }, 'target').battle;
    expect(result.creatures[1].hp).toBe(1);
    expect(result.creatures[1].trophyBonus).toBeUndefined();
    expect(result.collect).toBeUndefined();
  });

  it('retains an earlier kill bonus until victory after the weapon is replaced', () => {
    const state = ready(2);
    state.creatures.push(skeleton('far', { q: -2, r: 0 }, { hp: 1 }));
    state.order.push('far');
    const killed = kill(state).battle;
    expect(killed.collect).toBeUndefined();
    expect(killed.creatures[1].trophyBonus).toBe(2);
    killed.creatures[0].hands.right!.token!.attributes = [];
    const loaded = battleStateSchema.parse(JSON.parse(JSON.stringify(killed)));
    applyDamage(
      loaded,
      loaded.creatures.find((creature) => creature.id === 'far')!,
      1,
    );
    expect(loaded.collect!.graves.map((grave) => grave.trophyBonuses)).toEqual([[2], undefined]);
    const projected = projectBattleForViewer(loaded, 'heroes');
    expect(projected.collect!.graves[0]).toEqual({ hex: TARGET, examined: false });
  });
});

describe('A09 grave contents and compatibility', () => {
  it('keeps per-corpse bonuses separate when two enemies share one grave', () => {
    const state = ready();
    state.creatures[1].hp = 0;
    state.creatures[1].trophyBonus = 2;
    state.creatures.push(skeleton('second', TARGET, { hp: 0, kind: 'skeleton-archer' }));
    state.fallen = ['target', 'second'];
    enterCollectPhase(state);
    const grave = state.collect!.graves[0];
    expect(grave.tables).toHaveLength(2);
    expect(grave.trophyBonuses).toEqual([2, 0]);
    const base = baseline(state).contents!;
    const contents = grave.container!.contents!;
    expect(contents[0].slice(0, base[0].length)).toEqual(base[0]);
    expect(contents[0]).toHaveLength(base[0].length + 2);
    expect(contents[1]).toEqual(base[1]);
  });

  it('supports a legacy grave without pre-rolled contents and refuses reopening', () => {
    const state = kill(ready(2)).battle;
    const original = state.collect!.graves[0].container;
    delete state.collect!.graves[0].container;
    const loaded = battleStateSchema.parse(JSON.parse(JSON.stringify(state)));
    const opened = play(loaded, lootAt(TARGET));
    expect(opened.refused).toBeNull();
    expect(opened.battle.collect!.graves[0].container?.contents).toEqual([]);
    expect(original?.contents?.flat().length).toBeGreaterThanOrEqual(2);
    opened.battle.creatures[0].pos = { q: 0, r: 0 };
    const again = play(opened.battle, lootAt(TARGET), opened.inventory);
    expect(again.refused).toBe('CONTAINER_EMPTY');
  });

  it('preserves base token identities, keeps bonus identities distinct and does not repeat guaranteed drops', () => {
    let bonusGear = 0;
    for (let seed = 0; seed < 150; seed++) {
      const before = ready(2);
      before.creatures[1].kind = 'skeleton-king';
      before.tokenSecret.seed = `trophy-secret-${seed}`;
      const state = kill(before).battle;
      const grave = state.collect!.graves[0];
      const base = baseline(state).contents![0];
      const full = grave.container!.contents![0];
      expect(full.slice(0, base.length)).toEqual(base);
      expect(full).toHaveLength(base.length + 2);
      expect(full.filter((drop) => drop.guaranteed)).toEqual(
        base.filter((drop) => drop.guaranteed),
      );
      const ids = full.flatMap((drop) => (drop.token ? [drop.token.id] : []));
      expect(new Set(ids).size).toBe(ids.length);
      bonusGear += full.slice(base.length).filter((drop) => drop.token).length;
      expect(battleStateSchema.safeParse(state).success).toBe(true);
    }
    expect(bonusGear).toBeGreaterThan(0);
  });
});
