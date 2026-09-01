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

### Фаза M1 — Розріджена карта і три стани видимості

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

### Фаза M2 — Контент секцій і складач графа секцій

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

### Фаза M3 — Архетип FORKED_FRONTIER, валідатор і підключення до `silesia`

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

### Фаза M4 — Решта архетипів, Frontier Promises, кадрування камери

**Мета.** Повний набір v0.1 §9 і те, заради чого все робиться — цікавість до країв карти.

**Що робити.**

- Архетипи `RIDGE_AND_POCKET`, `OPEN_FIELD_NARROW_PASS`, `LANDMARK_PULL` як дані (нових гілок у коді генератора бути не повинно — якщо потрібні, значить формат рецепта замалий, розширити формат).
- За потреби дописати секції під нові архетипи (гряда з обходом, велике відкрите поле, вузький прохід).
- **Promises:** контент-тип із Zod-схемою (типи з v0.1 §14 + сила `SUBTLE`/`MEDIUM`/`STRONG`), прив'язка **до відкритого шва**, розміщення через rng-підпотік, ліміти `requiredPromises`/`maxPromises` з конфіга. Рендер — силует/маркер на ghost-шарі біля шва. **Заборонено:** знаки оклику, стрілки квестів, підписи, що розкривають зміст (v0.1 §5 «Layer 5»).
- **Gameplay Anchors** (v0.1 §8 «Layer 6») — тільки резервування слотів у дескрипторі, без ігрової логіки. Інваріант: у кожного зарезервованого слота взаємодії є ≥1 сусідній прохідний гекс для героя.
- **Кадрування камери:** видно якір кемпу, героя, `KNOWN`-зону і ≥1 promise; згенерований кластер **не розтягується** на всю панель — порожній простір навколо очікуваний і бажаний (v0.1 §16).

**Чого НЕ робити.** Жодної логіки взаємодії, жодного руху, жодного контенту квестів. Anchors — це порожні слоти.

**Критерій приймання.** Усі 4 архетипи дають валідні карти; кожна прийнята карта має ≥1 promise сили `MEDIUM`/`STRONG`; тест «promise завжди на відкритому шві»; тест «у кожного interaction-anchor є прохідний сусід»; детермінізм зберігається; ESLint зелений.

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

### Фаза M5 — Debug-панель, e2e і набір із 10 карт

**Мета.** Зробити генератор придатним для людського огляду й заморозити його.

**Що робити.**

- **Debug-панель (dev-only)**: сид, архетип, метрики валідації, причини відхилень, кнопки `regenerate`/`next seed`/`force archetype`, перемикачі «показати технічну сітку» і «показати ghost-шар», експорт/копіювання сида. Не потрапляє в продакшн-збірку.
- **E2E** за правилами `CLAUDE.md` #6 і скіла `hexoflat-e2e`: тільки Feature-класи, локатори лише в компонентах, стан — через `window.__HEXOFLAT_TEST__` (`apps/web/src/e2e/`). Мінімум два сценарії: (1) вихід із кемпу дає карту з якорем кемпу й героєм поруч; (2) той самий сид після перезавантаження дає ту саму карту. Дескриптор генератора віддавати через тестовий хук, а не парсити DOM.
- **Набір зразків**: скрипт, що генерує 10 прийнятих карт (3 `FORKED_FRONTIER`, 3 `RIDGE_AND_POCKET`, 2 `OPEN_FIELD_NARROW_PASS`, 2 `LANDMARK_PULL`), для кожної зберігає скріншот дошки + сид, архетип, кількість гексів, гілок, чокпоінтів, кишень, promise-ів і число відхилень до прийняття. Складати у `docs/design/samples/world-map-mvp/`.
- **Огляд**: 14 питань із v0.1 §24 — це критерій **Oleh-а як приймального тестувальника**, не автотест. Claude Code лише готує матеріал.

**Чого НЕ робити.** Не додавати біоми, погоду, ресурси, ворогів, рух — і взагалі нічого з v0.1 §27.

**Критерій приймання.** Debug-панель працює в dev і відсутня в продакшн-збірці; e2e зелені в CI; 10 зразків згенеровані й закомічені; після цього генератор **заморожується** до завершення дизайну руху героя.

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
