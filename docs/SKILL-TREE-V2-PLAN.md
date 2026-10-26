# Дерево Шляху v2 — пілот (три школи + Телепорт)

> Гілка: `new-skills-tree-view` (вже створена). Один чат Claude Code на весь пілот, фази S1 → S4 по черзі.
> Не комітити — коміти робить Олег. Перед роботою прочитати скіли `hexoflat-engine`, `hexoflat-web-state`, `hexoflat-e2e`.
> Макет затверджено 2026-10-26 (canvas «Дерево Шляху — макет»). Цей файл — єдине джерело правди для пілоту.

## 0. Що змінюється коротко

Зараз: 2 незалежні лінійні навички `attack`/`defense` × 10 рангів (20–50 Волі за ранг), тільки пасивні бонуси в бою. Телепорт — тільки через предмет `RETURN_SCROLL`.

Стане:

- Корінь — Воля (як зараз, `WILL_ICON_URL`, поточна/місткість).
- Від кореня три школи: **Демонічна** (темна магія), **Біонічна** (людська форма, фізичні вміння), **Ангельська** (свята магія). Біонічна — по центру і вибрана за замовчуванням.
- Кожна школа = вузол-герб (`crest`) → дві гілки по 3 вузли (`1L→2L→3L`, `1R→2R→3R`) → фінальний вузол (`cap`), який вимагає обидва `3L` і `3R`.
- Вузол має залежності (`requires`): відкрити можна лише коли всі батьки мають ранг ≥ 1.
- Клік по вузлу виділяє його; панель знизу показує назву, рівень, школу, поточний ефект, наступний рівень, ціну у Волі й кнопку дії.
- Нова навичка **Телепорт** (`a_teleport`, Ангельська школа, 10 рангів) — **дозвіл** відкривати портал у табір. Сувій `RETURN_SCROLL` лишається обов'язковим і витрачається як і раніше. Ціна порталу у Волі залежить лише від навички: ранг 1 → 10 Волі, кожен наступний ранг −1, ранг 10 → 1 Воля (`willCostByRank = [10,9,…,1]`). Власної ціни в сувою більше немає (`willCost` у контенті сувою прибрано).
- Без навички (ранг 0) герой може взяти сувій у руку, але дія «Use» нічого не робить: ні Воля, ні сувій не витрачаються, а гравець бачить повідомлення «Only Angels can fly!» (uk: «Літати вміють лише ангели!»). Відмова engine — `NOT_AN_ANGEL`.

### Межі пілоту

Реально працюють (можна купити й вони мають ефект): `b_crest` (безкоштовно, завжди ранг 1), `b_strike`, `b_guard`, `d_crest`, `a_crest`, `a_teleport`.
Решта вузлів **видимі в дереві**, мають назву/опис, але позначені «Скоро» і не купуються (`implemented: false`). Так дерево показує задум, а гравець не витрачає Волю на те, що нічого не робить.
Кнопки «Скинути навички» в пілоті немає.

---

## 1. Контент (engine, `packages/engine/src/skills/skill-content.ts`)

### 1.1 Схема

```ts
export const SKILL_BRANCHES = ['demonic', 'bionic', 'angelic'] as const;
export const SKILL_SLOTS = ['crest', '1L', '1R', '2L', '2R', '3L', '3R', 'cap'] as const;

const skillEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }), // герб, «Скоро»-вузли
  z.object({
    kind: z.literal('stat'),
    stat: z.enum(['attack', 'defense']),
    perRank: z.number().positive(),
  }),
  z.object({ kind: z.literal('portal'), willCostByRank: z.array(z.number().int().min(0)).min(1) }),
]);

skillDefinitionSchema = z.object({
  id: skillIdSchema,
  branch: z.enum(SKILL_BRANCHES),
  slot: z.enum(SKILL_SLOTS),
  maxRank: z.number().int().positive(),
  rankCosts: z.array(z.number().int().min(0)), // довжина === maxRank, не спадає
  requires: z.array(skillIdSchema),
  startRank: z.union([z.literal(0), z.literal(1)]).default(0),
  implemented: z.boolean(),
  effect: skillEffectSchema,
});
```

Refine-перевірки (і юніт-тест на весь `SKILLS`): `rankCosts.length === maxRank`; ціни не спадають; для `portal` — `willCostByRank.length === maxRank`; кожен `requires` існує; пара (branch, slot) унікальна; `crest` без `requires`; `cap` вимагає рівно `3L` і `3R` своєї школи; `1x` вимагає герб своєї школи; `2x`/`3x` вимагають вузол вище в тій самій колонці.

Іконки й тексти — **не** в engine (див. §3, §4).

### 1.2 Дані (24 вузли)

| id           | школа   | слот  | maxRank | rankCosts                       | requires          | effect                        | implemented |
| ------------ | ------- | ----- | ------- | ------------------------------- | ----------------- | ----------------------------- | ----------- |
| `b_crest`    | bionic  | crest | 1       | [0]                             | —                 | none, **startRank 1**         | ✅          |
| `b_strike`   | bionic  | 1L    | 10      | [6,6,8,8,10,10,12,14,16,18]     | b_crest           | stat attack 0.05              | ✅          |
| `b_guard`    | bionic  | 1R    | 10      | [6,6,8,8,10,10,12,14,16,18]     | b_crest           | stat defense 0.05             | ✅          |
| `b_heavy`    | bionic  | 2L    | 3       | [10,14,18]                      | b_strike          | none                          | ❌          |
| `b_endure`   | bionic  | 2R    | 2       | [15,20]                         | b_guard           | none                          | ❌          |
| `b_dash`     | bionic  | 3L    | 3       | [12,16,20]                      | b_heavy           | none                          | ❌          |
| `b_aim`      | bionic  | 3R    | 5       | [10,12,14,16,18]                | b_endure          | none                          | ❌          |
| `b_cap`      | bionic  | cap   | 1       | [30]                            | b_dash, b_aim     | none                          | ❌          |
| `d_crest`    | demonic | crest | 1       | [10]                            | —                 | none                          | ✅          |
| `d_curse`    | demonic | 1L    | 5       | [8,10,12,14,16]                 | d_crest           | none                          | ❌          |
| `d_blood`    | demonic | 1R    | 3       | [10,14,18]                      | d_crest           | none                          | ❌          |
| `d_fear`     | demonic | 2L    | 3       | [10,14,18]                      | d_curse           | none                          | ❌          |
| `d_shadow`   | demonic | 2R    | 2       | [14,20]                         | d_blood           | none                          | ❌          |
| `d_devour`   | demonic | 3L    | 3       | [14,18,22]                      | d_fear            | none                          | ❌          |
| `d_sight`    | demonic | 3R    | 2       | [12,18]                         | d_shadow          | none                          | ❌          |
| `d_cap`      | demonic | cap   | 1       | [30]                            | d_devour, d_sight | none                          | ❌          |
| `a_crest`    | angelic | crest | 1       | [10]                            | —                 | none                          | ✅          |
| `a_teleport` | angelic | 1L    | 10      | [10,10,12,12,14,14,16,16,18,20] | a_crest           | portal [10,9,8,7,6,5,4,3,2,1] | ✅          |
| `a_heal`     | angelic | 1R    | 3       | [8,12,16]                       | a_crest           | none                          | ❌          |
| `a_gate2`    | angelic | 2L    | 1       | [25]                            | a_teleport        | none                          | ❌          |
| `a_ward`     | angelic | 2R    | 3       | [10,14,18]                      | a_heal            | none                          | ❌          |
| `a_wings`    | angelic | 3L    | 2       | [14,20]                         | a_gate2           | none                          | ❌          |
| `a_light`    | angelic | 3R    | 2       | [10,16]                         | a_ward            | none                          | ❌          |
| `a_cap`      | angelic | cap   | 1       | [30]                            | a_wings, a_light  | none                          | ❌          |

Ціни — кандидатний баланс (місткість Волі 50), не фінал. Ціни рангів `a_teleport` додані при переході від «Брами Повернення» до «Телепорту»; сумарно 142 Волі за всі 10 рангів.

---

## Фаза S1 — engine

### S1.1 `skill-rules.ts`

- `getSkillRank(ranks, id)` = `clamp(max(stored, startRank), 0, maxRank)`.
- `requirementsMet(ranks, id)` — усі `requires` мають ранг ≥ 1.
- `getNextRankCost(ranks, id)` — як зараз (`null` на максимумі).
- `getSkillStatus(ranks, id, { will, locked })` → `'max' | 'soon' | 'requires' | 'locked' | 'need-will' | 'ready'` (саме в такому порядку перевірок). `locked` = рух/бій. Статус живе в engine, щоб UI та e2e не дублювали логіку.
- `getSkillBonuses(ranks)` — сумує всі `effect.kind === 'stat'` (повертає ту саму форму `{ attack, defense }`, тож `combat-store.ts:477/579` і `hero-store.skillBonuses` не міняються).
- `getPortalAbility(ranks)` → `{ unlocked: false } | { unlocked: true, willCost }` — бере навичку з `effect.kind === 'portal'` і її ранг (cost = `willCostByRank[rank-1]`). Не хардкодити `a_teleport` у правилах — шукати за `effect.kind`.

### S1.2 `unlock-skill.ts`

- Нові причини відмови: `'NOT_AVAILABLE_YET'` (implemented false) і `'REQUIREMENTS_NOT_MET'`. Порядок: передумови (герой/ревізія/бій/рух) → MAX_RANK → NOT_AVAILABLE_YET → REQUIREMENTS_NOT_MET → INSUFFICIENT_WILL.
- Ціна 0 (теоретично) — не викликати `spendWill`, просто підняти ранг.
- Решта без змін: атомарно `spendWill(state, cost, 'skill', id)`, `SKILL_UNLOCKED`, `revision++`.

### S1.3 Міграція збережень (`knowledge/state.ts`)

Додати до `z.preprocess` (поруч із `dropRetiredSessions`) функцію `migrateLegacySkills`: `skills.attack` → `skills.b_strike`, `skills.defense` → `skills.b_guard` (якщо новий ключ уже є — брати більший), невідомі ключі відкинути. `version: 1` лишається, `CONTENT_VERSION` **не** піднімати (інакше збереження зітруться). Юніт-тест: старий стан `{attack: 7, defense: 1}` → `{b_strike: 7, b_guard: 1}`.

### S1.4 Портал за навичкою Телепорт (`portal/`) [DONE — 2026-10-26, переглянуто]

- `portal-rules.ts`: чиста функція, спільна для engine і UI:
  ```ts
  resolvePortalCost(skills: SkillRanks | undefined, scrollCount: number)
    : { ok: true; cost: number } | { ok: false; reason: 'NO_SCROLL' | 'NOT_AN_ANGEL' }
  ```
  Порядок: немає сувою → `NO_SCROLL`; навичка не відкрита → `NOT_AN_ANGEL`; інакше `cost = getPortalAbility(skills).willCost`. `returnScrollWillCost` видалено; `willCost: 5` прибрано з USE-дії сувою в `loot.content.ts`.
- `applyOpenPortal`: після `planPortalOpening` рахує `resolvePortalCost(knowledge?.skills (лише свого героя), countItem(scroll))`. Відмова → `PORTAL_OPEN_REJECTED` з причиною, **стан не змінюється** (сувій і Воля цілі). Нема Волі → `INSUFFICIENT_WILL`. Успіх: атомарно `takeFromInventory(scroll, 1)` + `spendWill(cost)`. Ціна визначається engine зі стану героя, ніколи не з payload.
- `NO_WILL_STATE` лишається, якщо немає knowledge-стану героя.
- `PORTAL_OPENED.payload` не має поля `source`; `willSpent` = фактична ціна.
- Решта правил порталу (одна пара, закриття, данж в один бік) — без змін.

### S1.5 Тести (Vitest, engine)

- `skill-content.test.ts`: схема проходить для всього `SKILLS`; усі refine-правила; рівно 6 `implemented`.
- `skill-rules.test.ts`: startRank для `b_crest`; `requirementsMet`; усі гілки `getSkillStatus`; бонуси від `b_strike`/`b_guard`; `getPortalAbility` ранги 0/1/2/6/10 → none/10/9/5/1.
- `unlock-skill.test.ts`: оновити id; нові відмови; повний шлях `a_crest` → `a_teleport` ×3.
- portal: ранги 1/2/6/10 → 10/9/5/1 Волі і сувій витрачено; без навички → `NOT_AN_ANGEL`, сувій і Воля цілі, портал не з'явився; навичка без сувою → `NO_SCROLL`; недостатньо Волі → `INSUFFICIENT_WILL`, стан не змінився; навички чужого героя не враховуються. Допоміжний `portal-test-setup.ts` дає за замовчуванням `a_teleport` ранг 6 (ціна 5, як було до змін).
- міграція з S1.3.

---

## Фаза S2 — web: дерево (`apps/web`)

### S2.1 View-модель (`composables/use-hero-details.ts` або новий `use-skill-tree.ts`)

Чиста функція `buildSkillTreeView(ranks, will, locked)` → `{ branches: BranchView[] }`, порядок `['demonic','bionic','angelic']`. `BranchView = { id, crest, rows: [[1L,1R],[2L,2R],[3L,3R]], cap, forkLit, capLit }`, `SkillNodeView = { id, branch, rank, maxRank, nextCost, status, parentLit }`. Статус — тільки через engine `getSkillStatus`. Старий `SkillView`/`skills` у `HeroDetailsView` прибрати. Юніт-тест на view.

### S2.2 Компоненти (`a-game-scenes/map-scene/components/hero-details/`)

Розбити, щоб пройти ESLint `max-lines`:

- `hero-skill-tree.vue` — корінь Волі + з'єднувач + 3 колонки + панель деталей; тримає `selectedId` (за замовчуванням `'b_crest'`).
- `skill-branch-column.vue` — герб (62px, скруглення 18), назва школи (Alegreya SC, колір школи), підпис, «вилка» до двох колонок, 3 ряди по 2 вузли (56px, скруглення 14) з вертикальними лініями, «вилка» до `cap` (58px).
- `skill-node.vue` — `<button>`, іконка, круглий значок рангу в правому нижньому куті (як зараз), мітка «НОВЕ» для `a_teleport` поки ранг 0.
- `skill-detail-panel.vue` — іконка 72px, назва, «Рів. n/max», школа, поточний ефект, наступний рівень, «Спершу відкрий: …» для `requires`, ціна з іконкою Волі «N Волі · у тебе M», кнопка.

Візуальні стани вузла:

- відкритий (ранг ≥ 1): фон `колір школи + 38` (alpha), рамка суцільна кольору школи, іконка `#f6eedc`, легке світіння;
- `ready`: рамка кольору школи з alpha `99`, іконка кольору школи;
- `need-will`: рамка пунктиром;
- `requires`/`locked`: фон `#121518`, рамка `#2a3236`, іконка `#56636a`, opacity .6;
- `soon`: як `requires`, + мітка «Скоро» замість ціни в панелі;
- виділений: `box-shadow: 0 0 0 3px #121416, 0 0 0 5px #f3ead8`.
  Лінія між вузлами світиться кольором школи, коли батько відкритий, інакше `#2a3236`.

Кольори шкіл: demonic `#d0588c`, bionic `#e2a24f`, angelic `#8dcdef`. Решта палітри — з поточного `hero-skill-tree.vue` (`#0f1113`, `#3a474e`, `#e8d7a8`, `#cbbfa6`, `#a39886`). Колонка вибраної школи має трохи світліший фон `#15191c` і рамку кольору школи з alpha `66`.

Кнопка в панелі: `Пробудити` (герб, ранг 0) / `Відкрити` (ранг 0) / `Покращити` / `Максимум` / `Скоро` / `Заблоковано` / `Бракує Волі`; активна тільки в `ready`; клік → існуючий `heroStore.unlockSkill(id)` (тип `SkillId` новий).

### S2.3 Іконки

Додати в `components/gui/icons/item-icons.ts` (`ICON_PATHS`, viewBox 24, stroke):

```ts
human:  'M12 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z M5 21v-3a7 7 0 0 1 14 0v3 M9 14l3 3 3-3',
horns:  'M5 3c-1.5 5 .5 8.5 4 9.5 M19 3c1.5 5-.5 8.5-4 9.5 M12 21a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M10.5 16.5h.01 M13.5 16.5h.01',
wings:  'M12 7v14 M12 10C9.5 4.5 4.5 4 2 6.5c2 .2 3.5 2 3.8 4.6 2.4.6 4.3.3 6.2-1.1z M12 10c2.5-5.5 7.5-6 10-3.5-2 .2-3.5 2-3.8 4.6-2.4.6-4.3.3-6.2-1.1z M9.5 3h5',
anvil:  'M3 7h13l5-3v6l-5 1v3H8v-3L3 10z M10 14v5 M14 14v5 M6 20h12',
heart:  'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z M8 11h2l1-2 2 4 1-2h2',
bow:    'M5 3c6 2 10 6 12 12 M5 3v14 M17 15H5 M3 21l14-14 M13 7h4v4',
bolt:   'M13 2L4 14h7l-1 8 9-12h-7z',
star:   'M12 2l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17l-5.9 3 1.2-6.5L2.5 8.9 9.1 8z',
spiral: 'M12 12a1.5 1.5 0 1 1 1.5 1.5 3 3 0 1 1 3-3 4.5 4.5 0 1 1-4.5-4.5 6.5 6.5 0 1 1-6.5 6.5',
drop:   'M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z M9 15a3 3 0 0 0 3 3',
moon:   'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z M15 4l.5 1.5L17 6l-1.5.5L15 8l-.5-1.5L13 6l1.5-.5z',
skull:  'M12 2a8 8 0 0 0-8 8v5h3v5h10v-5h3v-5a8 8 0 0 0-8-8z M9 10.5h.01 M15 10.5h.01 M10 20v-3 M14 20v-3',
flame:  'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3 0-5 1-8z',
eye:    'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
portal: 'M5 21V9a7 7 0 0 1 14 0v12 M3 21h18 M12 10.5a1.5 1.5 0 1 1-1.5 1.5 3 3 0 1 1 3 3 4.5 4.5 0 0 1-4.5-4.5',
gate2:  'M5 21V9a7 7 0 0 1 14 0v12 M3 21h18 M9 12h6 M13 10l2 2-2 2 M15 17H9 M11 15l-2 2 2 2',
cross:  'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
sun:    'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
ward:   'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z M12 8v2 M12 14v2 M8 12h2 M14 12h2',
feather:'M20 4C10 4 5 10 5 19 M5 19l3-3 M20 4c0 8-5 12-12 12 M10 11h6',
```

(`sword`, `shield` вже є.) Мапа `SKILL_ICON: Record<SkillId, TIconName>` — у web: b_crest human, b_strike sword, b_guard shield, b_heavy anvil, b_endure heart, b_dash bolt, b_aim bow, b_cap star; d_crest horns, d_curse spiral, d_blood drop, d_fear skull, d_shadow moon, d_devour flame, d_sight eye, d_cap horns; a_crest wings, a_teleport portal, a_heal cross, a_gate2 gate2, a_ward ward, a_wings feather, a_light sun, a_cap wings.

### S2.4 Тексти (i18n `locales/uk/ui.json` і `en/ui.json`, `heroDetails.tree.*`)

Школи: Демонічна «темна магія» / Біонічна «людська форма» / Ангельська «свята магія» (en: Demonic «dark magic» / Bionic «human form» / Angelic «holy magic»).
Для кожного вузла: `name` і `fx` — масив текстів по рівнях (`tm()`). Українські тексти:

- b_crest **Людська форма** — [«Шлях тіла відкрито: удари, захист, рух і витривалість героя.»]
- b_strike **Сила удару** — рівень n: «+{bonus} до атаки в ближньому бою.» (bonus = n×0.05, два знаки)
- b_guard **Стійкість** — «+{bonus} до захисту.»
- b_heavy **Важкий удар** — [«Сила поштовху +1: легкий ворог відлітає на 1 гекс.», «Сила поштовху +2: відлітає на 2 гекси.», «Сила поштовху +3: відлітає навіть важкий ворог.»]
- b_endure **Витривалість** — [«+1 серце в кожному бою.», «+2 серця в кожному бою.»]
- b_dash **Ривок** — [«1 крок у кожній локації без витрати Волі.», «2 кроки …», «3 кроки …»]
- b_aim **Влучне око** — «Постріл через 2 гекси, сила +{bonus}.» (5 рівнів)
- b_cap **Залізне тіло** — [«Перший удар ворога в кожному бою не завдає шкоди.»]
- d_crest **Темний знак** — [«Пробуджує темну магію: прокляття, страх і ціна крові.»]
- d_curse **Прокляття** — «Ворог у бою втрачає {bonus} захисту.» (5)
- d_blood **Ціна крові** — [«1 раз за локацію: заплати 1 серцем замість 3 Волі.», «2 рази …», «3 рази …»]
- d_fear **Страх** — [«Відганяє ворога на 1 гекс без удару.», «Відганяє ворога на 2 гекси.», «Відганяє всіх сусідніх ворогів на 1 гекс.»]
- d_shadow **Тіньовий крок** — [«Пройти крізь 1 зайнятий гекс.», «Пройти крізь 2 зайняті гекси.»]
- d_devour **Пожирач** — [«+1 Воля за кожну перемогу в бою.», «+2 Волі …», «+3 Волі …»]
- d_sight **Темний зір** — [«Бачиш ворогів у тумані на 1 гекс далі.», «… на 2 гекси далі.»]
- d_cap **Демонічна форма** — [«Раз за бій: подвійна атака ціною 1 серця.»]
- a_crest **Благословення** — [«Пробуджує святу магію: брама, світло і зцілення.»]
- a_teleport **Телепорт** — один рядок із параметром ціни: «Дозволяє відкрити портал у табір за сувоєм. Ціна порталу: {cost} Волі.» (`cost` береться з `willCostByRank` для поточного рангу, не хардкодити).
- a_heal **Зцілення** — [«1 раз за локацію віднови 1 серце.», «2 рази …», «3 рази …»]
- a_gate2 **Двобічна брама** — [«Портал із підземелля більше не руйнує його: можна повернутися туди, де зупинився.»]
- a_ward **Світлий щит** — [«+1 блок проти першого удару в бою.», «+2 блоки …», «+3 блоки …»]
- a_wings **Крила** — [«Перелетіти через 1 перешкоду за хід.», «… через 2 перешкоди за хід.»]
- a_light **Світло** — [«Туман відкривається на 1 гекс далі.», «… на 2 гекси далі.»]
- a_cap **Ангельська форма** — [«Раз за локацію Телепорт відкривається безкоштовно.»]

Підписи панелі: «Рів.», «Наступний рівень», «Рівень 1», «Ще не відкрито.», «Навичку повністю розвинено.», «Спершу відкрий: {list}», «Волі · у тебе {will}», «Скоро», «НОВЕ» + кнопки з S2.2. Англійською — прямий переклад.

### S2.5 data-testid

`hero-skill-tree` (лишається), `hero-skill-will`, `hero-skill-branch-<branch>`, `hero-skill-node-<id>`, `hero-skill-node-<id>-rank`, `hero-skill-detail`, `hero-skill-detail-name`, `hero-skill-detail-rank`, `hero-skill-detail-cost`, `hero-skill-detail-action`. Старі `hero-skill-attack-*` прибрати.

---

## Фаза S3 — web: Телепорт на мапі [DONE — 2026-10-26, переглянуто]

Окремої кнопки здібності **немає** — портал, як і раніше, запускається сувоєм у руці.

- `use-portal.ts` `previewOpen`: після `planPortalOpening` викликає engine `resolvePortalCost(heroStore.knowledge?.skills, inventoryStore.countItem(SCROLL))`. Відмова → `{ ok:false, reason }` (`NO_SCROLL` / `NOT_AN_ANGEL`); нестача Волі → `{ ok:false, reason:'INSUFFICIENT_WILL', cost }`. Логіку не дублювати.
- `tool-hex-tile.vue`: кнопка «Use» для сувою пропонується і при `NOT_AN_ANGEL` (щоб гравець міг натиснути й побачити повідомлення); ціну в повідомленні про брак Волі та у підказці брати з preview.
- `openPortal` передає команду в engine; відмова `NOT_AN_ANGEL` → `portalRefusalText` показує «Only Angels can fly!» / «Літати вміють лише ангели!» (`portal.refusal.NOT_AN_ANGEL`), `flashDenied`, нічого не витрачено.
- Журнал подій: як раніше «opened a portal».
- Токен/кнопка «Брама» з попередньої версії плану (`gate-ability-button.vue`) **видалені**.

---

## Фаза S4 — e2e (`apps/playwright`, тільки Feature-класи, без локаторів у спеках)

- `hero-board-panel.component.ts`: нові методи на нових testid (вибрати вузол, прочитати ранг, натиснути дію в панелі, перевірити статус/ціну).
- Оновити 3 наявні тести в `e2e/world/hero-board-panel.spec.ts` на `b_strike` (старт Волі 20, ранг коштує 6 → тепер можна купити кілька рангів — переписати сценарій «не можна купити другий» на «не вистачає Волі після N покупок» або дати менше Волі через тестовий хук).
- Новий тест: вкладка «Шлях» відкривається з виділеним `b_crest`, панель показує «Людська форма».
- Новий тест: вузол «Скоро» не купується; вузол з невиконаними `requires` показує «Спершу відкрий: …».
- Новий тест: з сувоєм у руці, але без навички: «Use» → повідомлення «Only Angels can fly!» (через Feature), Воля і кількість сувоїв не змінились, портал не з'явився.
- Новий тест: `a_crest` → `a_teleport` (ранг 1), потім на мапі відкрити портал сувоєм; Воля зменшилась на 10, сувоїв на 1 менше. (Волю дати через `__HEXOFLAT_TEST__`/dev-grant: 10 + 10 + 10 = 30 > стартових 20.)

---

## Критерії готовності пілоту

1. Дерево виглядає як макет: корінь Волі, 3 школи, Біонічна по центру й вибрана, значки рангу, панель деталей.
2. Старі збереження з `attack/defense` відкриваються з тими самими рангами в `b_strike/b_guard`; бонуси в бою ті самі.
3. Купуються лише 6 реалізованих вузлів; решта — «Скоро».
4. Портал, як і раніше, відкривається сувоєм (сувій витрачається). З `a_teleport` ≥ 1 він коштує 10…1 Волі за рангом; без навички «Use» дає лише «Only Angels can fly!» і нічого не витрачає.
5. `pnpm lint`, `typecheck`, unit, api-tests, e2e зелені; ESLint-рачет не послаблено.
6. Додати в `CLAUDE.md` короткий абзац «Дерево Шляху v2 (гілка `new-skills-tree-view`)» з посиланням на цей файл.

## Prompt для Claude Code (вставити в новий чат)

```
Працюємо на гілці new-skills-tree-view. Прочитай docs/SKILL-TREE-V2-PLAN.md повністю, потім скіли hexoflat-engine, hexoflat-web-state, hexoflat-e2e.
Реалізуй пілот по фазах S1 → S2 → S3 → S4. Після кожної фази: прогнати lint/typecheck/unit (і e2e після S4), коротко звітувати що зроблено, і чекати мого "далі".
Не комітити — коміти роблю я. Якщо план суперечить коду — зупинись і запитай, не вигадуй.
```
