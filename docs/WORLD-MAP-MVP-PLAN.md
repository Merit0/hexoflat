# Hexoflat — World Map MVP Generator: план реалізації

**Гілка:** `map-generator` (створена й перемкнена Oleh-ом; жодна фаза не створює гілок).
**Кожна фаза = окремий коміт у цій гілці.** Одна фаза — один чат Claude Code.
**Джерело дизайну:** [`docs/design/world-map-mvp-generator-v0.1.md`](./design/world-map-mvp-generator-v0.1.md) (v0.1, Oleh).
**Цей документ важливіший за v0.1 там, де вони розходяться** — v0.1 фіксує _намір_ і критерії якості, цей план фіксує _реалізацію_ під наявну кодову базу й правило фізичної відтворюваності.

---

## Частина 0 — Що вже є в репо (перевірено 01.09.2026)

Перед плануванням був зроблений аудит. Фактичний стан, який v0.1 не враховує:

1. **`WorldGenerator` уже існує, але це не генератор.** `packages/engine/src/generators/world-generator.ts` — це builder: будує повну прямокутну сітку `width × height`, накладає рукотворний `config` (`IHexMapPlacement[]`) і чистить safe zone навколо входу. Зовнішня карта — рукотворна `HexMapProvider.getHomeLand()`, зареєстрована як локація `silesia` у `MapRegistry` (`packages/engine/src/registry/world-map-registry.ts`).
   → **MVP замінює саме `silesia`**, а не будує паралельну підсистему. Рендер, pathfinding, persistence і WS-синк лишаються ті самі.

2. **Рендер сьогодні малює весь прямокутник.** `apps/web/src/render/layers/tiles-layer.ts` для кожного нерозкритого тайла ставить `FOG_TILE_URL`. Тобто буквально «прямокутна дошка прихованих клітинок», яку v0.1 §3.2 забороняє. Станів лише два — `isRevealed: boolean`.

3. **Seeded RNG немає.** `packages/engine/src/utils/random.ts` містить лише `defaultRandom = () => Math.random()`; `rngState` у `HexEngineState` немає. Фаза A0 з `docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md` **не зроблена**. Отже детермінізм (v0.1 §19, §26) сьогодні неможливий у принципі.

4. **Координати всюди offset odd-q** (`IHexCoordinates { columnIndex, rowIndex }`), а v0.1 пропонує axial `{q, r}`. Друга система координат у моделі не заводиться. У `utils/hex-utils.ts` уже є `oddQToAxial`, `getOddQNeighbors`, `coordinateKey`, `hexDistance` — зворотної конверсії (`axialToOddQ`) немає, її треба додати.

---

## Частина 1 — Ухвалені рішення

### 1.1. Генератор — це колода секцій, а не пер-гексовий шум

Світ складається з рукотворних **секцій** (мультигексових фрагментів: гряда, розвилка, кишеня, вузький прохід, край фронтиру), які з'єднуються за **швами**. Сид визначає порядок добору, поворот і місце приєднання.

Чому не процедурний шум із циклом відхилення:

- **Фізична відтворюваність** (жорстке правило проєкту): пер-гексовий шум із `symmetryScore` за столом не відтворюється; «витягни тайл — поклади на стіл» відтворюється тривіально.
- **Неправильна форма й відсутність прямокутника** випливають із силуетів самих секцій, їх не треба доводити метриками.
- **Більшість інваріантів v0.1 §21 гарантуються за побудовою** (секція з тегом `POCKET` _дає_ кишеню), а не перевіряються постфактум 17 умовами відхилення.
- **Детермінізм** — це порядок колоди, а не відтворюваність шумової функції.

### 1.2. Модель інкрементальна, поведінка MVP — ні

Світ у моделі описується як граф: **викладені секції + список відкритих швів**. Одноразова викладка і нарощування — це одна й та сама операція «витягни секцію → приєднай до шва», викликана різну кількість разів.

- **Модель:** інкрементальна (секції, шви, стан колоди — які секції вже використані).
- **Поведінка в MVP:** викласти стартовий набір при вході в локацію і **більше не викладати нічого**. Жодного стрімінгу, жодної реакції на рух героя.

Це не порушує v0.1 §27: нарощування не додається — воно просто не робиться неможливим. Одноразова модель зробила б Frontier Promise (§11) обіцянкою, яку нема чим виконати: силует на краю туману вказував би на секцію, якої не існує, і при першому ж тесті руху довелось би або ставити стіну, або переписувати модель даних разом зі збереженнями.

### 1.3. Три стани видимості — похідні, без зміни схеми тайла

Ніяких нових полів у `HexTileModel` і ніяких змін у snapshot:

| Стан                    | Умова                                                                      | Рендер                                   |
| ----------------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| `KNOWN`                 | тайл існує в `map.tiles` і `isRevealed === true`                           | повний терен + hexobject                 |
| `GHOST_FRONTIER`        | тайл існує, `isRevealed === false`, і **має хоч одного розкритого сусіда** | приглушений силует терену, без hexobject |
| `HIDDEN` (Deep Unknown) | тайла в `map.tiles` немає **або** він не сусідить із розкритим             | **не рендериться взагалі**               |

Ghost-шар автоматично рівно один гекс завглибшки (v0.1 §15), бо визначений через сусідство. Обчислюється в рендер-шарі як похідне значення — не зберігається, не серіалізується, `CONTENT_VERSION` не бампається.

### 1.4. Карта стає розрідженою (sparse)

Це головна технічна зміна в наявному коді: `map.tiles` більше не покриває весь прямокутник `width × height`. `width`/`height` стають **bounding box** викладених секцій, потрібним лише для геометрії рендера. `HexMapModel.generateTiles()` (повна прямокутна генерація) для згенерованих карт **не викликається**.

Наслідок, який треба перевірити характеризаційними тестами до змін: `hero-movement/pathfinding-service.ts`, `hero-movement/reachable-range-service.ts`, `map/free-hex-finder.ts` і `applyCommand`'s `findTile` мають трактувати відсутній тайл як непрохідний, а не падати.

### 1.5. Генерація — чиста функція, не команда

`generateWorldMap(input) → { map, descriptor }` — детермінована чиста функція від `(seed, archetype, config, набір секцій)`. Вона **не** проходить через `applyCommand`.

Обґрунтування (це не виняток із правила #1): правило #1 регулює **зміни стану гри під час гри**. Створення карти при завантаженні локації вже сьогодні відбувається поза конвеєром (`MapRegistry.create()` у `world-map-store`). Відтворюваність забезпечується інакше: у стані зберігається **сид і версія генератора**, а карта — чиста функція від них.

Коли з'явиться викладання секцій **під час гри** (відкриття шва рухом героя) — це вже зміна стану, і вона **зобов'язана** бути командою + подією. Закласти місце, не реалізовувати.

### 1.6. Контент — у `content/`, не в TS-union'ах генератора

Терени, секції, архетипи й типи promise описуються як дані з Zod-схемами в `packages/engine/src/content/` за наявним зразком (`resources.content.ts` + `content-schema.ts` + `validate-content.ts`), а не як union-типи всередині генератора. Правило #3 з `CLAUDE.md`.

### 1.7. Promise прив'язується до шва, а не до координати

`FrontierPromise` вказує на **відкритий шов**, а не на гекс. Це робить його не декорацією, а обмеженням на те, яку секцію тягнути, коли цей шов колись відкриють. Одноразова зона такого не дозволяє.

### 1.8. Валідатор — тільки машинно-перевірюване, з детермінованим fallback

З 17 умов відхилення v0.1 §13 автоматизується частина; решта («візуально шумно», «виглядає як дошка з бордюром») — це критерії **людського огляду** (§24), не коду. Валідатор перевіряє лише:

1. **Зв'язність** — від спавну героя досяжна вся `KNOWN`-зона.
2. **Покриття тегів** — композиція містить принаймні по одній секції з тегами `BRANCH`, `OPEN_AREA`, `CHOKEPOINT`, `POCKET`.
3. **Гілки** — ≥2 відкритих шви, розведені не менш ніж на 2 напрямки.
4. **Promise** — ≥1 promise сили `MEDIUM`/`STRONG` на відкритому шві.
5. **Асиметрія** — зсув центроїда викладених гексів від якоря кемпу ≥ порогу.
6. **Немає замикання** — у героя є ≥1 прохідний сусід.

**Fallback обов'язковий:** після `maxSeedAttempts` невдач генератор не кидає помилку й не крутиться вічно, а повертає найкращий за скором кандидат детерміновано, з позначкою у `validation`.

---

## Частина 2 — Фізичний еквівалент (обов'язкова перевірка правила проєкту)

| Цифрове поняття  | Фізичний предмет / дія за столом                                              |
| ---------------- | ----------------------------------------------------------------------------- |
| Секція           | Картонний тайл на кілька гексів                                               |
| Колода секцій    | Стопка тайлів, перетасована                                                   |
| Сид              | Порядок стопки після тасування                                                |
| Шов              | Позначений край тайла, до якого прикладається наступний                       |
| Відкритий шов    | Край, до якого ще нічого не приклали                                          |
| Promise на шві   | Токен-підказка на краю: з якої стопки тягнути, коли цей край відкриють        |
| `KNOWN`          | Тайл лежить лицем догори                                                      |
| `GHOST_FRONTIER` | Сусідній тайл лежить, але накритий маркером туману — видно тільки рельєф краю |
| `HIDDEN`         | На столі просто нічого немає                                                  |
| Валідація сида   | Правила складання в рулбуці: «розвилка мусить мати два виходи»                |
| Camp Anchor      | Токен кемпу на своєму гексі                                                   |

Роль «Наглядача» (розкладка на старті) — розкласти стартові тайли за правилом архетипу. Складність у межах бюджету: людина тягне 4–7 тайлів і прикладає їх до позначених країв.

---

## Частина 3 — Фази

Кожна фаза — окремий коміт у `map-generator`. Не змішувати фази в одному чаті. Перед кожним комітом — питати (`CLAUDE.md`, workflow rules).

---

### Фаза M0 — Seeded RNG з іменованими підпотоками [DONE — 2026-09-01]

**Це Фаза A0 з `docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md` плюс одне доповнення.** Робиться першою й окремо, бо: (а) вона лагодить те, що зламане вже зараз — snapshot відновлює стан, але не відтворює гру, тож replay і авторитетна валідація в co-op не працюють; (б) вона змінює рандом бойового AI, і якщо змішати це з картою, при будь-якій дивній поведінці бою буде незрозуміло, що саме винне; (в) тест «той самий сид → та сама карта» неможливо написати раніше, ніж існує сид.

**Доповнення до A0 — іменовані підпотоки.** Крім одного глобального потоку потрібна функція виду `deriveStream(seed, label) → RandomNumberGenerator` (наприклад через `sha256Hex(seed + ':' + label)` як стартовий стан). Інакше генерація карти й бойовий AI ділять один лічильник, і будь-яка зміна в генераторі зсуває всі майбутні кидки в бою — порівняння сидів між версіями стає безглуздим. Фізичний аналог: карту розкладаєш однією колодою, бій розв'язуєш іншими кубиками.

**Що робити.**

- Seeded-генератор на базі `packages/engine/src/utils/hash/sha256.ts` + тест «однаковий сид → однакова послідовність».
- `deriveStream(seed, label)` — незалежні підпотоки; тест: два підпотоки з одного сида не корелюють і не зсувають один одного.
- `rngState` (seed + лічильник) у `HexEngineState`, протягнутий через `applyCommand`.
- `snapshot.ts`: `rngState` у payload. Зміна **адитивна** — `CONTENT_VERSION` лишається `1`, старі payload-и без `rngState` отримують свіжий сид при завантаженні. Бамп версії витер би всі збереження задарма. Тестами покрити обидва шляхи, включно з `computeChecksum` на payload без `rngState`.
- Перевести 7 наявних викликів `defaultRandom` на rng з контексту: `combat-store.ts` (×3), `world-map-store.ts` (×1), `hero-inventory-store.ts` (×1), `map/free-hex-finder.ts` (2 сигнатури).

**Чого НЕ робити.** Жодних секцій, жодного генератора карти, жодного UI, жодної зміни ігрових правил чи балансу — тільки джерело випадковості.

**Критерій приймання.** `pnpm --filter @hexoflat/engine test` зелений; тест доводить однакові рішення AI на однаковому сиді; `defaultRandom` не викликається в жодному сторі; старе збереження без `rngState` вантажиться без помилки; `CONTENT_VERSION` == 1.

**Як реалізовано.** `packages/engine/src/utils/random-seeded.ts` — `createSeededRandom`/`deriveStream` на `sha256Hex`. `HexEngineState.rngState?` (опційне поле, щоб існуючі `{ map, heroes: {} }` не ламались); `snapshot.ts` серіалізує/відновлює його поза checksum-ованим вмістом, лишаючи `computeChecksum` над `{version, map, heroes}` незмінним. `apps/api`: свіжа кімната отримує `rngState` з `crypto.randomUUID()`. `apps/web`: окремий `services/rng/world-rng.ts` (без імпорту сторів) тримає поточний world seed і іменовані підпотоки; `world-map-store` мінтить/читає сид у `loadFromStorage`, зберігає його в `TWorldState.worldSeed`. Лише сид переживає перезавантаження — лічильники підпотоків стартують з нуля щосесії. `combat-store` бере потік через `useWorldMapStore().rng('combat')` (не напряму через сервіс) — інакше третій `defaultRandom`-виклик впирався в ratchet-ліміт `max-lines` для `combat-store.ts`; `hero-inventory-store` імпортує сервіс напряму.

**Старт чату:**

```
Working in hexoflat, branch map-generator is already checked out — work there, do not create
any branch. Read docs/WORLD-MAP-MVP-PLAN.md — Phase M0 only.

Add a seeded RNG built on packages/engine/src/utils/hash/sha256.ts: put rngState (seed +
counter) into HexEngineState, thread it through applyCommand, persist it in snapshot.ts, and
switch the 7 existing defaultRandom call sites (combat-store x3, world-map-store x1,
hero-inventory-store x1, free-hex-finder x2 signatures) over to it. Also add
deriveStream(seed, label) returning an independent RandomNumberGenerator, so world generation
and combat AI never share a counter — prove with a test that consuming one stream does not
shift another.

The snapshot change is additive: keep CONTENT_VERSION at 1, old payloads without rngState must
load with a fresh seed rather than being discarded. Cover both paths with tests, including
computeChecksum on a payload with no rngState. Prove determinism with a test that runs the same
seed twice and gets the same enemy AI decisions.

No world map work, no content schemas, no dice, no UI. Do not change any game rule or balance —
only the source of randomness. One commit for this phase. Ask before committing.
```

---

### Фаза M1 — Розріджена карта і три стани видимості [DONE — 2026-09-01]

**Мета.** Зробити так, щоб карта могла складатися з довільної множини гексів (не прямокутника), а Deep Unknown не рендерився взагалі. Генератора ще немає — доводиться рукотворною розрідженою тестовою картою.

**Що робити.**

1. **Характеризаційні тести спершу** (до будь-яких змін) — зафіксувати поточну поведінку `pathfinding-service`, `reachable-range-service`, `free-hex-finder`, `applyCommand.findTile` на карті з «дірками» (тайли відсутні в `map.tiles`). Відсутній тайл має трактуватись як непрохідний, а не кидати помилку.
2. `axialToOddQ` у `utils/hex-utils.ts` (зворотна до наявної `oddQToAxial`) + тест round-trip на діапазоні з від'ємними координатами.
3. Похідна видимість: чиста функція `getTileVisibility(map, tile) → 'KNOWN' | 'GHOST_FRONTIER'` і селектор списку тайлів до рендера (усе інше відкидається). Місце — engine (чиста логіка), споживач — `tiles-layer.ts`.
4. `tiles-layer.ts`: рендерити тільки `KNOWN` і `GHOST_FRONTIER`. `GHOST_FRONTIER` — приглушений фон терену без hexobject-спрайта (не `FOG_TILE_URL` на весь прямокутник). Вузли для тайлів, яких немає в списку, знімаються наявним механізмом `seen`/dirty-tracker.
5. Перевірити, що `use-hex-board.ts` і `calcHexPixelPosition` коректно працюють, коли `width`/`height` — bounding box, а тайли розріджені.
6. Тимчасова рукотворна розріджена карта під тестом/дев-прапорцем як доказ (не як контент гри).

**Чого НЕ робити.** Ніяких секцій, архетипів, promise, генератора. Не чіпати `silesia` як ігрову локацію — вона поки лишається рукотворною.

**Критерій приймання.** Unit-тести engine зелені; характеризаційні тести доводять безпечну поведінку на дірках; на розрідженій тестовій карті у Deep Unknown **не створюється жодного PixiJS-вузла** (перевіряється тестом на кількість вузлів, не скріншотом); ghost-шар рівно один гекс завглибшки; ESLint (`max-lines`, `complexity`, `import-x/no-cycle`) зелений.

**Як реалізовано.**

- **Пункти 1 і 5 виявилися вже виконаними в коді.** `hero-movement/movement-grid.ts` (`buildTileIndex` / `getTraversableNeighbors` / `isTraversableTile`) уже трактує відсутній тайл як `undefined` → непрохідний, тож `pathfinding-service`, `reachable-range-service`, `move-planner`, `free-hex-finder` і `applyCommand.findTile` розріджену карту переживають без падінь. `use-hex-board-sizing.ts` рахує `mapBounds` як bounding box зі списку тайлів через `calcHexPixelPosition`, `map.width`/`height` ніде в рендері/pathfinding не читаються. Додано `packages/engine/src/map/sparse-map.characterization.test.ts` (дірка в _середині_ `map.tiles`, не лише за краєм прямокутника) як регресійний замок.
- `axialToOddQ` уже існувала приватною в `hex-utils.ts` — просто зроблено `export` + `hex-utils.test.ts` з round-trip на від'ємних координатах.
- `getTileVisibility(map, tile)` і `selectVisibleTiles(map)` — у `map/fog-service.ts` (поряд із reveal-логікою, спільний `indexByCoordinate`). `KNOWN` = `isRevealed`; `GHOST_FRONTIER` = не розкритий, але має розкритого сусіда; решта → `null` (не рендериться).
- `hex-world-map.vue`: `tiles` розділено на `allTiles` (повний список — годує `useHexBoardSizing`, тож `mapBounds`/камера/e2e-фракції не змінюються) і `visibleTiles` (`selectVisibleTiles` — годує `useHexBoard` → `tilesLayer.syncTiles`). HIDDEN-тайли просто не потрапляють у масив → наявний механізм `seen` у `syncTiles` не створює для них PixiJS-вузла.
- `tiles-layer.ts`: прибрано `FOG_TILE_URL`; фон тайла завжди його власний терен, `node.root.alpha = tile.isRevealed ? 1 : 0.4` дає приглушений силует для `GHOST_FRONTIER` (спрайт hexobject для нерозкритих і так не малювався).
- **Камеру навмисно не чіпано** — `mapBounds` лишається по всій карті, кластер видимих тайлів з'являється там, де він географічно є, з порожнім тлом навколо (v0.1 §16). Ре-кадрування камери до кластера — це Фаза M4.
- Візуально перевірено в dev: вхід у `silesia` показує ~7 `KNOWN` + кільце `GHOST_FRONTIER` в 1 гекс, далі — чиста дошка без сітки й без прямокутника туману.

**Старт чату:**

```
Working in hexoflat, branch map-generator is already checked out — work there, do not create
any branch. Read docs/WORLD-MAP-MVP-PLAN.md — Phase M1 only. Phase M0 is already merged.

Make the hex map able to be sparse (map.tiles no longer covers the full width x height
rectangle) and make Deep Unknown render nothing at all.

1. FIRST write characterization tests pinning current behaviour of pathfinding-service,
   reachable-range-service, free-hex-finder and applyCommand's findTile when tiles are missing
   from map.tiles. A missing tile must be treated as impassable, never throw.
2. Add axialToOddQ to packages/engine/src/utils/hex-utils.ts (inverse of the existing
   oddQToAxial) with a round-trip test covering negative coordinates.
3. Add a pure engine function getTileVisibility(map, tile) -> 'KNOWN' | 'GHOST_FRONTIER', where
   KNOWN = tile exists and isRevealed, GHOST_FRONTIER = tile exists, not revealed, and has at
   least one revealed neighbour. Everything else is not rendered.
4. Change apps/web/src/render/layers/tiles-layer.ts to render only those two states.
   GHOST_FRONTIER = muted terrain background, no hexobject sprite. Do NOT paint FOG_TILE_URL
   across a full rectangle any more.
5. Verify use-hex-board.ts and calcHexPixelPosition still work when width/height are just a
   bounding box and tiles are sparse.
6. Prove it with a hand-made sparse test map behind a test/dev flag — not as game content.

Do not touch the silesia location content, do not add sections, archetypes, promises or any
generator. One commit for this phase. Ask before committing.
```

---

### Фаза M2 — Контент секцій і складач графа секцій [DONE — 2026-09-01]

**Мета.** Детермінований складач: колода секцій → викладена розріджена карта. Без архетипів, без UI, тільки engine + unit-тести.

**Модель даних (пропозиція, адаптувати під конвенції репо).**

```ts
// local axial coordinates, anchor hex is (0,0)
type WorldSectionHex = { q: number; r: number; terrain: TWorldTerrainKey };

// A seam is one hex plus the direction of the edge that stays open.
type WorldSectionSeam = { q: number; r: number; dir: 0 | 1 | 2 | 3 | 4 | 5 };

type WorldSectionDef = {
  key: string;
  tags: TWorldSectionTag[]; // 'BRANCH' | 'OPEN_AREA' | 'CHOKEPOINT' | 'POCKET' | 'BARRIER' | 'FRONTIER' | 'CAMP_ANCHOR'
  hexes: WorldSectionHex[];
  seams: WorldSectionSeam[];
  allowRotation: boolean;
  weight: number;
};
```

**Терени MVP (рівно 7, більше не додавати):** `OPEN_GROUND`, `STONE_RIDGE`, `FOREST_EDGE`, `BROKEN_GROUND`, `NARROW_PASS`, `POCKET_FLOOR`, `FRONTIER_EDGE`. Кожен мапиться на прохідність (`OPEN` / `BLOCKED` / `RESERVED_INTERACTION`) і фон тайла.

**Алгоритм приєднання (тримати саме таким простим).**

1. Взяти відкритий шов світу: гекс `H`, напрямок `d`.
2. Детерміновано (через підпотік rng) перебирати кандидатів: секція × поворот.
3. Поворот у axial на 60° за годинниковою: `(q, r) → (-r, q + r)`. Терен і шви обертаються разом.
4. Секція приєднується так, щоб її шовний гекс став сусідом `H` у напрямку `d`, а напрямок її шва після повороту дорівнював `opposite(d)`.
5. Відкинути кандидата, якщо хоч один його гекс перетинається з уже викладеним.
6. Прийнятий кандидат: гекси додаються, використаний шов знімається з обох боків, решта швів секції стають новими відкритими швами.

**Що робити.**

- Zod-схеми секцій/теренів у `packages/engine/src/content/` за зразком наявного контенту; підключити до `validate-content.ts` і `content.test.ts`.
- Стартовий набір: **8–12 секцій**, серед них обов'язково одна `CAMP_ANCHOR`, і принаймні по одній з тегами `BRANCH`, `OPEN_AREA`, `CHOKEPOINT`, `POCKET`, `BARRIER`. Секції по 4–9 гексів.
- Складач + нормалізація: після викладки перевести axial → odd-q, зсунути так, щоб мінімальні `columnIndex`/`rowIndex` були 0, порахувати `width`/`height` як bounding box, зібрати `HexMapModel` із розрідженим `tiles`.
- `CONTENT_VERSION`: бампати **тільки** якщо змінюється форма вже наявного контенту. Додавання нових категорій — адитивне, версію не чіпати. Рішення зафіксувати коментарем у коді.

**Чого НЕ робити.** Ніяких архетипів, promise, валідатора, інтеграції з `silesia`, UI, debug-панелі.

**Критерій приймання.** Тест «однаковий сид → байт-у-байт однакова викладка»; тест «різні сиди → різні викладки»; тест «жодного перетину гексів»; тест «усі викладені гекси зв'язні»; тест «поворот 6 разів повертає секцію в початковий стан»; контент проходить Zod-валідацію; ESLint зелений.

**Як реалізовано.**

- **Гекс-математика** (`utils/hex-utils.ts`): експортовано `AXIAL_DIRS`, додано `axialNeighbor`, `oppositeDir`, `rotateAxial` (крок = 60° CW `(q,r)→(-r,q+r)`), `rotateDir` (виводиться з обертання вектора напрямку через `AXIAL_DIRS`, а не hardcoded формулою). `dir` — це індекс у `AXIAL_DIRS`, той самий порядок, що й `getOddQNeighbors`.
- **Контент** (`content/`, окрема категорія — НЕ через `ContentDefinitionSchema`/`CONTENT`, бо секції не keyed by `THexobjectKey`): `world-section-schema.ts` (Zod), `world-terrain.content.ts` (7 теренів → `traversability`; фон тайла — M5), `world-sections.content.ts` (10 секцій: `camp-anchor`, `fork`, `open-field`, `forest-clearing`, `narrow-pass`, `stone-ridge`, `broken-slope`, `side-pocket`, `sheltered-pocket`, `frontier-shelf` — усі 7 тегів і всі 7 теренів покриті), `world-content.test.ts` (схема + інваріанти: суміжність гексів секції, шов на гексі секції, унікальні ключі, покриття тегів/теренів). Експорти додано в `content/index.ts`. `validate-content.ts` і `content.test.ts` (хексобʼєкти) не чіпано.
- **Складач** — чиста функція `assembleWorld({seed, sections, startSectionKey?, maxSections})` у `generators/world-map-assembler.ts` (не команда, не клас). rng = `deriveStream(seed, 'world-map')` з M0. Стартова секція = перша з тегом `CAMP_ANCHOR` (rotation 0, origin). Цикл: rng-вибір відкритого шва → перебір `невикористана секція × поворот × її шов`, що дає `dir === oppositeDir(worldSeam.dir)`, з перевіркою на перетин → детермінований сорт кандидатів + `pickRandom`. `weight` поки НЕ використовується (uniform pick) — лишений у схемі для M3. Секція одноразова (deck-семантика). Шви, що дивляться в уже викладений гекс, відсікаються.
- **Нормалізація:** усе внутрішньо в axial, наприкінці `axialToOddQ`. **Зсув колонок мусить бути парним** — суміжність в odd-q залежить від парності колонки, непарний зсув ламає сітку й `calcHexPixelPosition`. Тому min `columnIndex` = 0 **або 1**, min `rowIndex` = 0 (зсув рядків довільний). Тест нормалізації послаблено до `col ∈ {0,1}`. `HexMapModel` збирається з розрідженим `tiles` (сортовані за `coordinateKey` для стабільного `toJSON`), `generateTiles()` не викликається.
- **Вихід:** `{ seed, map, terrainByCoord, placedSections, openSeams }`. `terrainByCoord` (`coordinateKey → terrain`) — окремий канал, бо `HexTileModel` не має поля terrain і M2 його не додає (як terrain потрапить у тайл/рендер — рішення M3+).
- **`CONTENT_VERSION` не бампнуто** — нова категорія контенту, у збереження нічого не серіалізується (сид зберігає M3). Обґрунтування тут і в commit-меседжі, не коментарем у коді (правило користувача).
- **Знайдений баг у процесі:** перша версія нормалізації робила довільний зсув колонок → на частині сидів карта розпадалась на незвʼязні компоненти. Виправлено парним зсувом; тест звʼязності розширено до 27 сидів.

**Старт чату:**

```
Working in hexoflat, branch map-generator is already checked out — work there, do not create
any branch. Read docs/WORLD-MAP-MVP-PLAN.md — Phase M2 only. Phases M0 and M1 are merged.

Build the section content and the deterministic section-graph assembler in packages/engine.
No archetypes, no promises, no validator, no UI, no integration with the silesia location yet.

- Add Zod content schemas for world terrain (exactly 7 keys: OPEN_GROUND, STONE_RIDGE,
  FOREST_EDGE, BROKEN_GROUND, NARROW_PASS, POCKET_FLOOR, FRONTIER_EDGE) and world sections,
  following the existing pattern in packages/engine/src/content (content-schema.ts,
  validate-content.ts, content.test.ts).
- Author 8-12 sections of 4-9 hexes each in local axial coordinates, with tags CAMP_ANCHOR,
  BRANCH, OPEN_AREA, CHOKEPOINT, POCKET, BARRIER, FRONTIER — at least one of each.
- A seam is { q, r, dir 0..5 }: one hex plus the open edge direction.
- Assembler: take an open seam (hex H, direction d), iterate section x rotation candidates in
  an order driven by a named rng substream from Phase M0, rotate in axial with
  (q, r) -> (-r, q + r), attach so the candidate's seam hex lands on H's neighbour in direction
  d and its rotated seam direction is opposite(d), reject on any hex overlap, then remove the
  consumed seam on both sides and add the section's remaining seams as open.
- Normalise: axial -> odd-q via axialToOddQ, shift so min columnIndex/rowIndex are 0, set
  width/height from the bounding box, produce a HexMapModel with a sparse tiles array. Never
  call HexMapModel.generateTiles() for a generated map.
- Keep CONTENT_VERSION at 1 — new content categories are additive. Note the reasoning in a code
  comment.

Tests must prove: same seed -> identical layout; different seeds -> different layouts; no hex
overlap; all laid hexes connected; rotating a section 6 times returns it to its original state.
One commit for this phase. Ask before committing.
```

---

### Фаза M3 — Архетип FORKED_FRONTIER, валідатор і підключення до `silesia` [DONE — 2026-09-02]

**Мета.** Перша реально згенерована ігрова карта на екрані.

**Що робити.**

- **Архетип як рецепт** (дані, не код): впорядкований список вимог до тегів секцій + ваги. `FORKED_FRONTIER`: `CAMP_ANCHOR` → `BRANCH` → з двох її швів одна гілка веде до `OPEN_AREA`, друга — до `CHOKEPOINT` → `POCKET`; решта швів лишаються відкритими.
- **Конфіг** (`WorldMapMvpConfig` з v0.1 §22, скорочений до реально вживаних полів): `knownHexMin/Max`, `minOpenAreaSize`, `minPocketSize`, `maxSeedAttempts`, `symmetryRejectThreshold`, `archetypeWeights`. Ніяких сирих чисел у коді генератора.
- **Валідатор** — рівно 6 інваріантів із §1.8 цього плану. Плюс **детермінований fallback**: після `maxSeedAttempts` повернути найкращий кандидат зі скором і заповненим `validation.rejectionReasons`, не кидати помилку й не зациклюватись.
- **Camp Anchor і спавн героя**: якір кемпу — на своєму гексі секції `CAMP_ANCHOR`; герой спавниться на сусідньому прохідному гексі. Якщо напрямок виходу з кемпу відомий — обрати гекс із того боку; якщо ні — детермінований вибір за rng (не довільний).
- **Скільки викладати:** секції докладаються, доки `KNOWN`-зона не досягне `knownHexMin`, плюс секції, що торкаються її (вони дають ghost-шар). Далі — стоп, шви лишаються відкритими.
- **Підключення:** `MapRegistry` для `silesia` створює згенеровану карту замість `HexMapProvider.getHomeLand()`. Сид і версія генератора (`world-map-mvp-v0.1:<seed>:<archetype>`) зберігаються разом із картою (`world-storage.ts` / nav-стан), щоб карта відтворювалась.
- **Міграція збережень:** старе збереження `silesia` з рукотворною картою має вантажитись без падіння. Якщо простіше — при завантаженні старої карти без сида згенерувати нову зі свіжим сидом і залогувати це подією у `game-events-store`. Рішення зафіксувати в коді коментарем.
- **Debug console API** (dev-only, не в продакшн-UI): `generate(seed?)`, `regenerate()`, `nextSeed()`, `forceArchetype(key)`, `getDescriptor()`.

**Чого НЕ робити.** Інші три архетипи, promise-система, debug-панель у UI, камера, e2e — усе це M4/M5.

**Критерій приймання.** Вихід із кемпу відкриває згенеровану карту; той самий сид дає ту саму карту після перезавантаження сторінки; валідатор ніколи не зациклюється (тест зі свідомо неможливим конфігом і `maxSeedAttempts`); Deep Unknown не рендерить вузлів; старе збереження вантажиться без помилки; unit + api тести зелені.

**Як реалізовано.**

- **Рецепт керує складачем** через новий опційний `requiredTags: TWorldSectionTag[]` у `assembleWorld` (без окремого оркестратора). `grow` на кроці `i` обмежує кандидатів секціями з тегом `requiredTags[i]`, шукаючи по **всіх** відкритих швах; якщо тег нікуди не приткнути — крок пропускається (не зациклюється). `PlacedSection` тепер несе `tags`.
- **Архетипи** — `content/world-archetypes.content.ts` (`WORLD_ARCHETYPES: WorldArchetypeDef[]`, Zod-схема + `WORLD_ARCHETYPE_KEYS` union з усіх 4-х). У M3 визначено лише `FORKED_FRONTIER: ['BRANCH','OPEN_AREA','CHOKEPOINT','POCKET']` (camp-anchor — завжди фіксований старт, не в рецепті).
- **Конфіг** — `generators/world-map-config.ts` (`DEFAULT_WORLD_MAP_CONFIG`), сирих чисел у генераторі/валідаторі немає.
- **Валідатор** — `generators/world-map-validator.ts`, **6 інваріантів (5 із §1.8 + перевірка розмірів open-area/pocket замість Promise-перевірки, яка чекає на M4)**: зв'язність по не-BLOCKED тайлах від якоря кемпу, покриття тегів, гілки (≥2 шви, розведені на ≥2 напрямки), розмір open-area/pocket секцій, асиметрія (зсув центроїда), відсутність замикання. `score` = кількість пройдених; `accepted` = всі.
- **Генератор** — `generators/world-map-generator.ts`: `generateWorldMap({seed, archetype, config?}) → WorldMapMvpResult`. Цикл до `maxSeedAttempts` з під-сидами `sha256Hex(seed:attempt:i)`; кожна спроба `assembleWorld` (з `requiredTags`) → `decorate` → `validateWorld`; повертає прийняту або **найкращу за score** (fallback, не кидає, не зациклюється). `decorate`: `CAMPING_ENTRANCE` на якорі кемпу + `map.config` з `entry.DEFAULT`; SOLID `WOOD_AND_LEAVES` на кожен `STONE_RIDGE`-тайл; детермінований `heroSpawn` через `findFreeHexNear(deriveStream(seed,'hero-spawn'))`. `versionId = world-map-mvp-v0.1:<seed>:<archetype>`.
- **"Скільки викладати"** — `maxSections = recipe.requiredTags.length + 1` (~5 секцій, ~25–34 гекси). `knownHexMin/Max` стали метриками валідатора, не контролем циклу викладки (невелика реінтерпретація).
- **Підключення `silesia`** — `MapDefinition.create` тепер `(seed?) => HexMapModel`; додано опційний `generate?: (seed, archetype?) => WorldMapMvpResult`. `silesia` віддає обидва; `camping`/`cave` ігнорують. Дескриптор (seed/archetype/versionId/validation) прокидається через сервіс `world-map-generation.ts` (`resolveWorldMap`) у `world-map-store.worldDescriptor` + `TWorldState.worldArchetype` (адитивно, як M1-`worldSeed`).
- **`world-map-store`**: блок `if(!this.map)` винесено в `buildFreshMap`; додано `regenerateWorld(seed?)` (dev-triggered). Логіку генерації винесено в `services/world/world-map-generation.ts`, бо `world-map-store` уже на ratchet-ліміті `max-lines`.
- **Детермінізм-фікс:** `reseedWorld` більше не робить early-return при незмінному сиді — інакше `regenerate()` тим самим сидом не скидав лічильник `getStream('world')` і герой спавнився в іншому гексі → різний `isRevealed` → різний `map.toJSON()`. Перевірено в браузері: `regenerate()` двічі → байт-у-байт однакова карта.
- **Міграція збережень:** старий `silesia`-save (рукотворний прямокутник) вантажиться через `readSavedMap` → `this.map` встановлено → `def.create` не викликається. Без примусової регенерації. `CONTENT_VERSION` не чіпано (обґрунтування в commit-меседжі, не коментарем).
- **Debug console API** — `services/world/world-map-debug.ts`, `window.__WORLD_MAP_DEBUG__` (`generate`/`regenerate`/`nextSeed`/`forceArchetype`/`getDescriptor`), gated `import.meta.env.DEV`, встановлюється з `hex-world-map.vue` (як e2e-хуки). `forceArchetype` у M3 = `regenerate()` (один архетип; справжнє перемикання — M4).
- **`apps/api` не чіпано** — досі `HexMapProvider.getHomeLand()`.
- **Візуально перевірено в dev:** вхід у `silesia` показує згенерований кластер з якорем `CAMPING_ENTRANCE`, героєм поруч, ghost-кільцем в 1 гекс, порожнім Deep Unknown; `validation.accepted === true` (score 6); `nextSeed()` дає іншу прийняту карту; жодних нових помилок у консолі.

**Старт чату:**

```
Working in hexoflat, branch map-generator is already checked out — work there, do not create
any branch. Read docs/WORLD-MAP-MVP-PLAN.md — Phase M3 only. Phases M0-M2 are merged.

Add the first archetype and put a generated map on screen.

- Define archetypes as data (an ordered list of required section tags plus weights), not as
  code branches. Implement FORKED_FRONTIER only: CAMP_ANCHOR -> BRANCH, then one branch leads
  to OPEN_AREA and the other to CHOKEPOINT -> POCKET; remaining seams stay open.
- Add a WorldMapMvpConfig object (knownHexMin/Max, minOpenAreaSize, minPocketSize,
  maxSeedAttempts, symmetryRejectThreshold, archetypeWeights). No raw numbers inside the
  generator.
- Implement the validator with exactly the 6 invariants listed in section 1.8 of the plan, plus
  a deterministic fallback: after maxSeedAttempts, return the best-scoring candidate with
  validation.rejectionReasons filled in. Never throw, never loop forever — prove it with a test
  using a deliberately unsatisfiable config.
- Place the Camp Anchor on the CAMP_ANCHOR section's anchor hex and spawn the hero on an
  adjacent passable hex, preferring the camp exit side when that direction is known, otherwise
  choosing deterministically via the rng.
- Lay sections until the KNOWN area reaches knownHexMin, plus the sections touching it (those
  provide the ghost layer). Then stop, leaving seams open.
- Wire MapRegistry's silesia location to the generated map instead of
  HexMapProvider.getHomeLand(). Persist the seed and the generator version string
  "world-map-mvp-v0.1:<seed>:<archetype>" alongside the map so it is reproducible.
- Old silesia saves must load without crashing. If a save has no seed, generate a fresh one and
  log it as a game event; document the choice in a code comment.
- Add a dev-only console API: generate(seed?), regenerate(), nextSeed(), forceArchetype(key),
  getDescriptor(). It must not leak into the production player UI.

Do not implement the other three archetypes, the promise system, any debug panel UI, camera
framing or e2e tests. One commit for this phase. Ask before committing.
```

---

### Фаза M4 — Решта архетипів, Frontier Promises, кадрування камери [DONE — 2026-09-02]

**Мета.** Повний набір v0.1 §9 і те, заради чого все робиться — цікавість до країв карти.

**Що робити.**

- Архетипи `RIDGE_AND_POCKET`, `OPEN_FIELD_NARROW_PASS`, `LANDMARK_PULL` як дані (нових гілок у коді генератора бути не повинно — якщо потрібні, значить формат рецепта замалий, розширити формат).
- За потреби дописати секції під нові архетипи (гряда з обходом, велике відкрите поле, вузький прохід).
- **Promises:** контент-тип із Zod-схемою (типи з v0.1 §14 + сила `SUBTLE`/`MEDIUM`/`STRONG`), прив'язка **до відкритого шва**, розміщення через rng-підпотік, ліміти `requiredPromises`/`maxPromises` з конфіга. Рендер — силует/маркер на ghost-шарі біля шва. **Заборонено:** знаки оклику, стрілки квестів, підписи, що розкривають зміст (v0.1 §5 «Layer 5»).
- **Gameplay Anchors** (v0.1 §8 «Layer 6») — тільки резервування слотів у дескрипторі, без ігрової логіки. Інваріант: у кожного зарезервованого слота взаємодії є ≥1 сусідній прохідний гекс для героя.
- **Кадрування камери:** видно якір кемпу, героя, `KNOWN`-зону і ≥1 promise; згенерований кластер **не розтягується** на всю панель — порожній простір навколо очікуваний і бажаний (v0.1 §16).

**Чого НЕ робити.** Жодної логіки взаємодії, жодного руху, жодного контенту квестів. Anchors — це порожні слоти.

**Критерій приймання.** Усі 4 архетипи дають валідні карти; кожна прийнята карта має ≥1 promise сили `MEDIUM`/`STRONG`; тест «promise завжди на відкритому шві»; тест «у кожного interaction-anchor є прохідний сусід»; детермінізм зберігається; ESLint зелений.

**Як реалізовано.**

- **Архетипи** — 4 записи в `world-archetypes.content.ts` як дані (`requiredTags` + `weight`), нового коду в генераторі нема. `silesia` не форсує архетип: `generateWorldMap` при відсутньому `archetype` робить `pickArchetype(seed, archetypeWeights)` — детермінований зважений вибір через `deriveStream(seed, 'archetype')`. `versionId` містить обраний архетип. Перевірено: усі 4 архетипи accepted для ≥3/5 сидів; 12 `nextSeed()` у браузері покрили всі 4.
- **Промиси** — enum типів/сили в `content/world-section-schema.ts` (`WorldPromiseSchema`), розміщення в `generators/world-map-promises.ts` (`deriveStream(seed, 'promises')`). Шви сортуються за hex-відстанню від якоря кемпу спадно; найдальший бере найсильніший промис (STRONG/MEDIUM), решта SUBTLE (з максимум одним MEDIUM). Тип — з strength-gated пулів. Кількість у `[requiredPromises, min(maxPromises, seams)]`. Гарантія ≥1 не-SUBTLE.
- **Валідатор** — сигнатура стала `validateWorld({ world, campAnchor, config, requiredTags, promises })`. 6 інваріантів: зв'язність, покриття `requiredTags` (тепер архетип-залежне, не фіксований набір!), гілки, **promise (≥1 не-SUBTLE)** — повернуто справжню §1.8 #4 замість M3-заглушки, асиметрія, відсутність замикання. `openAreaSize`/`pocketSize` лишились метриками.
- **Gameplay Anchors** — `generators/world-map-anchors.ts`, `reserveAnchors(world, promises, seed)`, максимум по 1 слоту кожного виду, тільки коли є валідний гекс. Interaction-слоти (`TERRAIN_INTERACTION`/`RESOURCE_HINT`/`SIDE_INTEREST`) — лише на гексах з ≥1 прохідним сусідом (за побудовою + тест `interactionAnchorsHavePassableNeighbour`). Anchors — чисті дані в дескрипторі, нічого не ставиться на карту.
- **`WorldMapMvpResult`** отримав `promises` і `anchors`. Пайплайн спроби: assemble → decorate → placePromises → reserveAnchors → validate.
- **Рендер промисів** — новий шар `render/layers/frontier-promise-layer.ts` (за зразком `enemy-vision-layer`), мультимаркер. Позиція = `getOddQNeighbors(seam.coord)[seam.dir]` — гекс у Deep Unknown за ghost-фронтиром. М'який світний диск, alpha за силою (0.28/0.45/0.62). Без тексту/стрілок/знаків оклику. Підключено в `use-hex-board.ts` + `hex-world-map.vue`.
- **Камера (мінімально)** — `useHexBoardSizing(tiles, extraPoints?)`: promise-позиції вкладаються в bounding box `mapBounds` + `FRAME_PAD` (0.6 тайла) відступу, щоб завжди був темний бордюр. `scale` (cap 1.1) не чіпано. `create-test-api` не зачеплено (e2e — тільки camping, без промисів).
- **Переживання reload** — весь `WorldDescriptor` (seed/archetype/versionId/validation/promises/anchors) серіалізується в `TWorldState.worldDescriptor` (замість M3-`worldArchetype`); `loadFromStorage` відновлює його одним рядком. Промиси малюються після перезавантаження. Перевірено round-trip у браузері.
- **`CONTENT_VERSION` не бампнуто** — нова категорія контенту (promise-enum), поля дескриптора адитивні, у карту-блоб нічого нового не серіалізується.
- **Візуально перевірено в dev:** усі 4 архетипи рендеряться прийнятими; промиси — тьмяні силуети в темряві за фронтиром; ≥1 сильний завжди; камера тримає промис у кадрі з відступом; жодних нових помилок у консолі.

**Старт чату:**

```
Working in hexoflat, branch map-generator is already checked out — work there, do not create
any branch. Read docs/WORLD-MAP-MVP-PLAN.md — Phase M4 only. Phases M0-M3 are merged.

Add the remaining archetypes, the Frontier Promise system and camera framing.

- Implement RIDGE_AND_POCKET, OPEN_FIELD_NARROW_PASS and LANDMARK_PULL as data recipes. No new
  branching in generator code — if a recipe cannot be expressed, widen the recipe format
  instead of special-casing.
- Author extra sections if the new archetypes need them (ridge with a way around, large open
  field, narrow pass).
- Add Frontier Promises as a Zod content type (the types from the v0.1 design doc section 14
  plus strength SUBTLE/MEDIUM/STRONG). A promise attaches to an OPEN SEAM, not to a coordinate,
  so that later, when that seam is opened, it can constrain which section is drawn. Placement
  uses an rng substream and honours requiredPromises/maxPromises from the config. Render them
  as silhouettes/markers on the ghost layer near the seam. Never render exclamation marks,
  quest arrows, objective lines, or labels that reveal what is hidden.
- Reserve Gameplay Anchor slots in the descriptor only — no gameplay logic. Enforce the
  invariant that every reserved interaction anchor has at least one adjacent passable hex.
- Camera framing must include the camp anchor, the hero, the KNOWN area and at least one
  promise, and must NOT stretch the cluster to fill the board panel — empty surrounding space is
  intended.

Tests: all four archetypes produce valid maps; every accepted map has at least one MEDIUM or
STRONG promise; every promise sits on an open seam; every interaction anchor has a passable
neighbour; determinism still holds. One commit for this phase. Ask before committing.
```

---

### Фаза M5 — Debug-панель, e2e і набір із 10 карт [DONE — 2026-09-02]

**Мета.** Зробити генератор придатним для людського огляду й заморозити його.

**Що робити.**

- **Debug-панель (dev-only)**: сид, архетип, метрики валідації, причини відхилень, кнопки `regenerate`/`next seed`/`force archetype`, перемикачі «показати технічну сітку» і «показати ghost-шар», експорт/копіювання сида. Не потрапляє в продакшн-збірку.
- **E2E** за правилами `CLAUDE.md` #6 і скіла `hexoflat-e2e`: тільки Feature-класи, локатори лише в компонентах, стан — через `window.__HEXOFLAT_TEST__` (`apps/web/src/e2e/`). Мінімум два сценарії: (1) вихід із кемпу дає карту з якорем кемпу й героєм поруч; (2) той самий сид після перезавантаження дає ту саму карту. Дескриптор генератора віддавати через тестовий хук, а не парсити DOM.
- **Набір зразків**: скрипт, що генерує 10 прийнятих карт (3 `FORKED_FRONTIER`, 3 `RIDGE_AND_POCKET`, 2 `OPEN_FIELD_NARROW_PASS`, 2 `LANDMARK_PULL`), для кожної зберігає скріншот дошки + сид, архетип, кількість гексів, гілок, чокпоінтів, кишень, promise-ів і число відхилень до прийняття. Складати у `docs/design/samples/world-map-mvp/`.
- **Огляд**: 14 питань із v0.1 §24 — це критерій **Oleh-а як приймального тестувальника**, не автотест. Claude Code лише готує матеріал.

**Чого НЕ робити.** Не додавати біоми, погоду, ресурси, ворогів, рух — і взагалі нічого з v0.1 §27.

**Критерій приймання.** Debug-панель працює в dev і відсутня в продакшн-збірці; e2e зелені в CI; 10 зразків згенеровані й закомічені; після цього генератор **заморожується** до завершення дизайну руху героя.

**Як реалізовано.**

- **Debug-панель** — `a-game-scenes/map-scene/components/world-map-debug-panel.vue`, підключена в `hex-world-map.vue` через `defineAsyncComponent` під `v-if="import.meta.env.DEV"` (у прод-збірці — окремий lazy-чанк, який ніколи не запитується; не в головному й не в `hex-world-map` бандлі, `size-limit` не зачеплено). Показує сид (+ копіювання в буфер), вердикт `ACCEPTED/FALLBACK` + score, 4 кнопки форсу архетипу (активний підсвічений), `regenerate`/`next seed`, метрики валідатора (`hexCount/branchCount/chokepointCount/openAreaSize/pocketSize/promiseCount/symmetryOffset`), список `rejectionReasons`, і два перемикачі.
- **Перемикачі — з рендер-підтримкою.** «technical grid» → новий шар `render/layers/hex-grid-layer.ts` (cyan hex-outline на кожен тайл видимого набору, `zIndex 900`), опція `showTechnicalGrid` в `use-hex-board.ts`, синк складено в наявний tiles-watcher (щоб не роздувати `useHexBoard` понад ліміт `max-lines-per-function`). «ghost layer» → `visibleTiles` у `hex-world-map.vue` під DEV фільтрує до `isRevealed`-тайлів, коли вимкнено (в проді — завжди `selectVisibleTiles`, без змін). Стан перемикачів — два модульні `ref` у `services/world/world-map-debug.ts` (не Pinia, не персиститься).
- **Форс архетипу протягнуто по-справжньому:** `world-map-debug.ts` `regenerate(seed?, archetype?)`; `world-map-store.regenerateWorld(seed?, arch?)` → `buildFreshMap(..., arch?)` → `resolveWorldMap(def, seed, archetype?)` → `def.generate(seed, archetype)`. `__WORLD_MAP_DEBUG__.forceArchetype` більше не аліас `regenerate` (M3-заглушка знята).
- **E2E** — `e2e/world/world-map-generation.spec.ts`, два сценарії, тільки Feature-класи: `OpenSilesiaMapFeature`/`VerifyWorldMapFeature`, `SilesiaMapPage` (`/world/silesia`), `WorldMapComponent` (локатори + `page.evaluate` тут). Новий тест-хук: `getWorldDescriptor()` (сид/архетип/versionId/accepted/score/rejectedAttempts + метрики) і `getCampAnchorCoordinates()` (тайл із `CAMPING_ENTRANCE`), додані в `apps/web/src/e2e/*` і `apps/playwright/src/framework/test-api.ts`. Сценарій 1: карта згенерована й `accepted`, герой рівно за 1 гекс від якоря кемпу. Сценарій 2: reload → той самий `seed`/`archetype`/`versionId`/`hexCount`/`branchCount`/`promiseCount`.
- **Знайдено й виправлено передумовний баг (M3/M4).** На **першому** завантаженні сторінки прямо на `/world/silesia` герой опинявся за 3–7 гексів від кемпу, поза тайлами. Причина: `scheduleWorldSave` — дебаунснутий запис (750 мс), тож `watch(locationKey, immediate)` генерував карту A і зберігав її _у чергу_, а `onMounted(bootstrapWorld)` одразу викликав `goToLocation` вдруге, `readSavedMap` віддавав `null` (черга ще не змита), генерувалась карта B з новим сидом, але позиція героя зі спавну карти A «запам'ятовувалась» і накладалась на карту B. Виправлено в `services/persistence/world-storage.ts`: `readSavedMap`/`readSavedWorldState` тепер спершу дивляться в `pendingSaves` (read-your-writes), а `removeSavedWorld` скасовує ще не змиту чергу. Покрито `world-storage.test.ts`. Це також робить справжнім M4-твердження про переживання reload.
- **Набір зразків** — `packages/engine/src/generators/world-map-samples.gen.test.ts`, guard `GEN_SAMPLES=1` (у звичайному `pnpm test` — `describe.skip`, тому в CI не пише файлів), запуск: `pnpm --filter @hexoflat/engine samples:worldmap`. Генерує 10 прийнятих карт (3/3/2/2), для кожної — схематичний **SVG** (гекси за `calcHexPixelPosition`, колір = терен; camp anchor, спавн героя, відкриті шви пунктиром, promise-силуети, anchor-слоти) + рядок у `samples.json` (сид, архетип, `accepted/score/rejectedAttempts`, `hexCount/branchCount/chokepointCount/openAreaSize/pocketSize/promiseCount`, типи promise-ів, види anchor-ів, причини відхилень). Вивід у `docs/design/samples/world-map-mvp/` + `README.md` з легендою; SVG/`samples.json` у `.prettierignore` як машинний вивід. Скріншот canvas через Playwright не робимо — у проєкті скріншот-порівняння свідомо відкладені (`playwright.config.ts`), а SVG детермінований і читається в діффах.
- **Engine:** `WorldMapMvpResult.attempts` (кількість спроб до прийняття; для метрик і панелі). `WorldDescriptor.attempts` відповідно. `CONTENT_VERSION` не чіпано.
- **Візуально перевірено в dev:** панель рендериться, копіювання сида, форс усіх 4 архетипів (кожен `accepted`), regenerate/next seed, technical grid (cyan-контури), ghost layer (ховає GHOST_FRONTIER-кільце), reload → той самий сид/архетип/карта/позиція героя, герой суміжний з кемпом на першому завантаженні. Прод-збірка (`VITE_E2E_HOOKS=true … build`) — зелена, `size-limit` у межах.

**Після M5 генератор ЗАМОРОЖЕНО** (v0.1 §29): наступний крок — дизайн механіки руху героя проти цих зразків, в окремій гілці.

**Старт чату:**

```
Working in hexoflat, branch map-generator is already checked out — work there, do not create
any branch. Read docs/WORLD-MAP-MVP-PLAN.md — Phase M5 only. Phases M0-M4 are merged.

Make the generator reviewable, then stop.

- Add a dev-only debug panel: seed, archetype, validation metrics, rejection reasons,
  regenerate / next seed / force archetype buttons, toggles for "show technical grid" and "show
  ghost layer", and seed export/copy. It must not ship in the production build.
- Add e2e tests following CLAUDE.md rule 6 and the hexoflat-e2e skill: e2e specs call Feature
  classes only, locators live in components, and game state comes from
  window.__HEXOFLAT_TEST__ (apps/web/src/e2e/). Two scenarios: leaving camp produces a map with
  a camp anchor and the hero adjacent to it; and the same seed after a reload produces the same
  map. Expose the generator descriptor through the test hook rather than parsing the DOM.
- Add a script that generates 10 accepted maps (3 FORKED_FRONTIER, 3 RIDGE_AND_POCKET, 2
  OPEN_FIELD_NARROW_PASS, 2 LANDMARK_PULL) and, for each, saves a board screenshot plus seed,
  archetype, hex count, branch count, chokepoint count, pocket count, promises and the number
  of rejected attempts before acceptance. Put them in docs/design/samples/world-map-mvp/.

Do not add biomes, weather, resources, enemies, movement, or anything else from the v0.1 design
doc's non-goals list. One commit for this phase. Ask before committing.
```

---

## Частина 4 — Ризики і відкриті питання

1. **Розріджена карта може зачепити більше, ніж видно.** `world-map-store.ts`, `world-storage.ts` і WS-синк писались під повну прямокутну сітку. M1 навмисно починається з характеризаційних тестів; якщо там спливе щось велике — зупинитись і переоцінити, а не проштовхувати.
2. **Секцій може забракнути на різноманіття.** 8–12 секцій дадуть впізнавані повтори. Це навмисно: спершу перевіряємо, що граматика працює, і тільки потім розширюємо набір. Додавати секції — дешево, це чистий контент.
3. **`silesia` як робоче ім'я.** Локація вже так називається; перейменування — окреме питання світобудови, не частина цього плану.
4. **Заморозка після M5 — реальна.** Наступний крок після неї — дизайн механіки руху героя **проти згенерованих зразків**, а не проти абстрактної сітки (v0.1 §29). Не починати рух усередині цієї гілки.
