# E1 — Фікстура, чотиристанове відкриття, органічна межа

**Гілка:** `exploration/e1-fixture-discovery`
**Воркфлов:** [`../EXPLORATION-SLICE-WORKFLOW.md`](../EXPLORATION-SLICE-WORKFLOW.md) §3.1, §3.2, фаза E1
**Дизайн:** `../design/exploration-v0.1/00-exploration-vertical-slice-final-v0.1.md` §6–9, STEP 2, 4–8

---

## 0. Передумови з E0

Перед стартом перевірити, що з E0 реально є в транку:

- [x] `FEATURE_EXPLORATION_SLICE` — є: `packages/engine/src/features/feature-flags.ts`, інваріант «мультиплеєр → завжди off», обгортки в `apps/web` і `apps/api`;
- [x] індекс `Map<coordinateKey, HexTileModel>` у `HexMapModel` — є: лінивий `getTileAt()` з інвалідацією;
- [x] `commandId` / ідемпотентність — є: envelope на всіх пʼяти схемах + журнал `appliedCommands` (кап 256); дубль повертає події першого прогону й не крутить RNG.

Перевірено 17.08.2026 перед стартом E1 — усі три на місці, нічого не бракує.

Seeded RNG у E1 не використовується — фікстура детермінована за визначенням. Якщо E0 ще не завершений, можна робити блоки 1–4, але блок 5 без ідемпотентності не приймається.

---

## 1. Обсяг

### Блок 1 — Фікстура `BROKEN_SPIRE_APPROACH_V1`

**Куди:** нове `packages/engine/src/content/fixtures/broken-spire-approach-v1.ts` + Zod-схема поряд. Фікстура — це контент, тому підпорядковується правилу #3: валідується, версіонується, відокремлена від рантайм-стану.

**Метадані:**

```ts
const VERTICAL_SLICE_WORLD_SEED = 'HF-EXPLORATION-VS-001';
const GENERATION_VERSION = 'exploration-vs-0.1';
const FIXTURE_ID = 'BROKEN_SPIRE_APPROACH_V1';
```

**Координати брати з таблиці §3.1 воркфлову — odd-q колонку, не axial із дизайн-документа.** Axial-колонка там лишена виключно для звірки очима.

Технічна сітка **14 × 9** (мінімально потрібно 11 × 6; надлишок ніколи не рендериться, бо лишається `UNKNOWN`, зате дає простір органічній межі не впиратись у край масиву). Авторських гексів рівно 27, решта — `UNKNOWN`.

**Нові enum-и в рушії** (терен і прохідність — окремі осі, це принципово: Stone Crust у E3 змінює прохідність, не терен):

```ts
type FixtureTerrain = 'GROUND' | 'CAMP' | 'STONE_MASS' | 'STONE_CRUST' | 'RUIN' | 'VEGETATION';
type Traversal = 'OPEN' | 'BLOCKED' | 'DESTRUCTIBLE';
```

У E1 `DESTRUCTIBLE` поводиться рівно як `BLOCKED`. Поведінка руйнування — це E3, тут тільки декларація стану.

### Блок 2 — `DiscoveryState` з сумісним `isRevealed`

```ts
type DiscoveryState = 'UNKNOWN' | 'OBSERVED' | 'DISCOVERED' | 'UNDERSTOOD';
```

**Ключове рішення (§3.2):** `isRevealed` **не видаляється**, а стає похідним:

```ts
get isRevealed(): boolean { return this._discovery !== 'UNKNOWN'; }
set isRevealed(v: boolean) { this._discovery = v ? 'DISCOVERED' : 'UNKNOWN'; }
```

У репозиторії **понад 30 місць** читають `isRevealed` — `combat-rules.ts`, `ai-controller.ts`, `movement-grid.ts`, `move-planner.ts`, `tiles-layer.ts`, `use-tile-click.ts`, `use-move-preview.ts`, `hex-world-map.vue`. Шим існує саме для того, щоб **жодного з них не чіпати в E1**. Не мігруй їх — це прибирання після Stop Gate.

**Файли:**

- `packages/engine/src/map/models/hex-tile-model.ts` — поле `_discovery`, геттер/сеттер `discovery`, шим `isRevealed`;
- `packages/engine/src/map/models/hex-map-model.ts` — `toJSON`/`fromJSON`: серіалізувати `discovery`; старий payload без нього читати через `isRevealed` (`true → DISCOVERED`, `false → UNKNOWN`);
- `packages/engine/src/map/builders/hex-tile-builder.ts` — метод `.discovery()`;
- `packages/engine/src/map/fog-service.ts` — додати `observe()` для переходу в `OBSERVED`; наявні функції продовжують працювати через сеттер.

`CONTENT_VERSION` лишається **1** — зміна адитивна. Бамп витер би всі збереження задарма. Покрити тестом обидва шляхи, включно з `computeChecksum` на payload без `discovery`.

### Блок 3 — Рендерер: `UNKNOWN` не існує

- `apps/web/src/render/layers/tiles-layer.ts` — зараз рядок 165 малює `FOG_TILE_URL` для нерозкритих. Для `UNKNOWN` спрайт **не створюється взагалі**. `OBSERVED` — приглушений/силуетний варіант. `DISCOVERED`/`UNDERSTOOD` — як зараз.
- `apps/web/src/composables/use-hex-board-sizing.ts` — **найважливіше місце фази.** Межі дошки рахуються як min/max по пікселях **усіх** тайлів (рядки ~51–56). Якщо просто перестати малювати `UNKNOWN`, межі лишаться прямокутником 14×9, камера відцентрується на порожнечу, а масштаб порахується під невидиму площу. Фільтрувати за `discovery !== 'UNKNOWN'` і перераховувати при зміні.
- `tile-dirty-tracker.ts` — зміна `discovery` позначає тайл брудним.

Це та фаза, де інваріант **I13** (гравець не бачить прямокутної дошки) або виконується, або ні. Скіл `hexoflat-render` — обов'язково прочитати перед правками.

### Блок 4 — Початковий стан світу

На вході у світ (фікстурні дані, не рантайм-правило):

| Гекс                                                                                        | Стан                               |
| ------------------------------------------------------------------------------------------- | ---------------------------------- |
| `camp_world_anchor (2,1)`                                                                   | UNDERSTOOD                         |
| `world_exit_spawn (3,1)`                                                                    | DISCOVERED — герой зʼявляється тут |
| `old_marked_ridge (3,0)`, `camp_nw (2,0)`, `camp_w (1,0)`, `camp_sw (1,1)`, `camp_se (2,2)` | DISCOVERED                         |
| `camp_e_south (3,2)`                                                                        | OBSERVED — органічна підказка краю |
| `ridge_junction (4,2)`                                                                      | OBSERVED                           |
| решта                                                                                       | UNKNOWN                            |

Позначка на `old_marked_ridge` видима, але **сенсу не має** — його дасть Insight аж у E6. У E1 це просто малюнок на камені.

### Блок 5 — Оновлення відкриття по кроку

Правило: увійшов → `DISCOVERED`; згенеровані сусіди → `OBSERVED` (не `DISCOVERED`).

**Живе в рушії**, як частина обробки `MOVE_HERO`, з подіями `HexDiscovered` / `HexObserved`. Не в `world-map-store`.

Це **інша** поведінка, ніж наявний `revealAroundHero` (він відкриває гекс героя й шість сусідів однаково й повністю). Стару функцію не змінювати — наявна світова мапа має продовжити працювати як була. Нове правило вмикається тільки під `FEATURE_EXPLORATION_SLICE`.

Вміст не витікає: перехід в `OBSERVED` дає категорію («кам'яна перешкода», «щось зелене»), а не `hexobject.hexobjectKey`.

### Блок 6 — Далеке спостереження Шпиля

Broken Spire дає силует і румб із моменту виходу з кемпу, **не розкриваючи `(9,4)`**.

Реалізація: авторські метадані на фікстурі (`distantObservation: { silhouetteKey, bearingFrom }`), які створюють окрему сутність-обіцянку. Заборонено: змінювати `discovery` гекса `(9,4)`, підсвічувати його на мапі, показувати відстань у гексах.

---

## 2. Чого в E1 не робити

Will і Burst, `routeLimit`, Waypoint, переривання руху (E2); руйнування Stone Crust (E3); ресурси й Take (E4); Gather Will, шум, патруль (E5); сліди й Insight (E6); Trail Imprint і подорож (E7); повернення (E8). Не мігрувати 30+ місць із `isRevealed`. Не бампати `CONTENT_VERSION`. Не чіпати бій.

---

## 3. Приймання

- **Тест сусідства фікстури.** Прогнати axial-таблицю дизайн-документа через `col = q + 2; row = r + (col - (col & 1)) / 2` і довести, що для кожної пари axial-сусідів `getOddQNeighbors` дає ту саму пару в odd-q. Страхує від тихого зсуву парності колонок при майбутньому редагуванні фікстури.
- **Лінтер фікстури** (§42 дизайн-документа) — усі hard errors зелені.
- **VS-01** (вхід у кемп / органічний фронтир) із §43.
- **Жодного відрендереного `UNKNOWN`** — тест на кількість спрайтів.
- **Межі дошки не включають `UNKNOWN`** — окремий тест на `use-hex-board-sizing`, бо це найімовірніше місце тихого регресу.
- **I3 (приватність).** Вміст `UNKNOWN`-гекса недосяжний із в'юмоделі. Чесна примітка: в соло стан рушія живе в браузері, тож інваріант тут забезпечується на межі в'юмоделі, а не криптографічно; серверний фільтр — питання кооперативу, не цієї фази.
- **Save/load.** Старий payload без `discovery` вантажиться; новий round-trip зберігає всі чотири стани.
- **Наявна гра не зламана** — світова мапа поза фікстурою працює як раніше, e2e зелені.
- **e2e-хук** розширено: `getTileDiscovery(coord)` і `getRenderedTileCount()` у `apps/web/src/e2e/`. Без нових `data-testid` на тайли — скіл `hexoflat-e2e`.

---

## 4. Три ризики, названі наперед

1. **Межі й центрування дошки** (блок 3) — тихий регрес, який не впаде тестами, якщо тест не написати. Найдорожчий баг фази.
2. **Спокуса мігрувати `isRevealed`.** Виглядатиме як «зробимо чисто одразу». Не робити: 30+ місць, три з них у бою, який зараз не чіпаємо. Шим — свідоме рішення на весь слайс.
3. **`combat-store.ts:200`** пише `tile.isRevealed = true` напряму. Через сеттер це стане `DISCOVERED` — коректно, але має бути покрито тестом, бо це єдине місце, де бій пише у стан відкриття.

---

## 5. Стартовий промпт

```
Working in hexoflat. Read docs/exploration/e1-fixture-discovery.md in full, plus sections 3.1
and 3.2 of docs/EXPLORATION-SLICE-WORKFLOW.md and sections 6-9 of
docs/design/exploration-v0.1/00-exploration-vertical-slice-final-v0.1.md.

First verify the E0 preconditions listed in section 0 of the brief and tell me if any are
missing before writing code.

Then do E1 and only E1, in the order of blocks 1-6 in the brief:

1. The BROKEN_SPIRE_APPROACH_V1 fixture in the repo's odd-q coordinates. Use the odd-q table
   in workflow section 3.1 — NOT the axial table in the design doc. 14x9 technical grid, 27
   authored hexes, everything else UNKNOWN. Terrain and traversal are separate axes.
2. DiscoveryState on the tile, with isRevealed kept as a derived getter/setter shim. Do NOT
   migrate the 30+ existing isRevealed call sites — the shim exists precisely so they keep
   working untouched.
3. Renderer: UNKNOWN hexes get no sprite at all. Critically, also filter UNKNOWN out of the
   board bounds in use-hex-board-sizing.ts — otherwise the board stays a rectangle in layout
   and the camera centres on empty space. Read the hexoflat-render skill first.
4. Camp world-entry state per the table in block 4.
5. Step-based discovery update inside the engine as part of MOVE_HERO, emitting HexDiscovered
   and HexObserved. Entered -> DISCOVERED, generated neighbours -> OBSERVED. Do not modify the
   existing revealAroundHero — the current world map must keep behaving exactly as it does
   today; gate the new rule behind FEATURE_EXPLORATION_SLICE.
6. Broken Spire distant observation as authored silhouette/bearing metadata. It must not set
   discovery on (9,4), highlight it, or show a hex distance.

Acceptance per section 3 of the brief, including the axial<->odd-q adjacency-preservation test,
the fixture linter, the board-bounds test, and both save/load paths. CONTENT_VERSION stays 1.

No Will, no Burst, no tools, no terrain destruction, no resources, no patrol, no traces.
Do not touch combat. Do not commit.
```
