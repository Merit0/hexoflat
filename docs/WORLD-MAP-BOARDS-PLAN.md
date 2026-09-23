# Hexoflat — Дошки світу: статичні, підземелля, сценарні

**Гілка:** `map-generator-v2` (вже перемкнена; жодна фаза не створює гілок).
**Кожна фаза = окремий чат Claude Code.** Комітів Claude Code не робить.
**Замінює** `docs/WORLD-MAP-GENERATOR-V2-PLAN.md` з 23.09.2026. Той документ — історія рішень; з нього використовується лише зроблена фаза G0. Фази G2b, G4, G5, G6 звідти **не виконувати**.
**Порядок:** C1 → C2 → C2b → огляд у грі → C3 → C4.

---

## Частина 1 — Навіщо цей план

Генератор карти тричі не дав дошки, яка відчувається як дошка (v1 двічі, v2 на G3 — стежка з 7–10 гексів на 306 клітинках). Причина щоразу одна: відчуття дошки мало виникнути з алгоритму, а не бути заданим автором.

Вимоги Oleh-а (23.09.2026):

- **чітка логіка**, яку легко підтримувати й налаштовувати;
- **статичні карти** — кемп і світові локації завжди однакові, під повним контролем;
- **легко додати обʼєкт у потрібне місце базової карти**;
- **сценарні карти** — у сценарію є завдання й сетап обʼєктів; карта генерується з нуля щоразу;
- **підземелля** — генеруються з нуля щоразу;
- **тестування одразу в грі**, без зразків.

Тому: статична дошка — це креслення, яке малює автор. Генерована дошка складається з намальованих автором ділянок; випадковість лише обирає ділянки й розставляє обʼєкти в слоти.

---

## Частина 2 — Як працює код зараз (перевірено 23.09.2026)

Це факти, на які спираються всі фази. Якщо щось із цього в коді вже інакше — зупинитись і сказати, а не підганяти.

| Що               | Де                                                                                     | Як працює                                                                                                                                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Локації          | `packages/engine/src/registry/location-key.ts`, `world-map-registry.ts`                | `LocationKey = 'camping' \| 'silesia' \| 'cave'`. `MapDefinition`: `create: () => HexMapModel`, `entryHexobjectKey` (біля нього зʼявляється герой при першому вході), `fogPolicy`, `respawnAfterClearedMs` (лише `cave`, 60 с)                                                                                          |
| Карти зараз      | `map/providers/hex-map-provider.ts`, `map-tiles-schema-provider.ts`                    | `WorldGenerator` будує повний прямокутник і розставляє `IHexMapPlacement[]`. `silesia` = 17×15 + `homelandMapConfig`; `camping` = 10×6; `cave` = 16×5 + `skeletorsKingdomMapConfig`. `WorldGenerator` ще й прибирає обʼєкти в радіусі `safeZoneRadius` довкола входу                                                    |
| Координати       | `utils/hex-utils.ts`                                                                   | pointy-top, **odd-r**: непарні рядки зсунуті праворуч (`q = col − (r − (r&1))/2`)                                                                                                                                                                                                                                       |
| Портали          | `content/constructions.content.ts`, `registry/action-starters-registry.ts`             | `CAMPING_ENTRANCE`, `CAVE_ENTRANCE`, `CAVE_EXIT`, `HOMELAND_GATE` — **`SOLID`**-конструкції з дією `ENTER` (герой стоїть поруч, інструмент `HAND`, 400 мс). **Ціль задана типом обʼєкта** (`enter.locationKey`): `CAVE_ENTRANCE → cave`, `CAVE_EXIT → silesia`, `HOMELAND_GATE → silesia`, `CAMPING_ENTRANCE → camping` |
| Карта на локацію | `stores/world-map-store.ts` `loadLocationMap`, `services/persistence/world-storage.ts` | індекс `locationKey → mapId`; збережена карта з `mapId` вантажиться, інакше `def.create()`. Для нового `mapId` `loadFromStorage` робить `reseedWorld(crypto.randomUUID())` **до** `create()` — тобто в кожної нової карти свій випадковий сид (`getWorldSeed()`)                                                        |
| Позиція героя    | `world-map-store.ts` `placeHeroOnArrival`                                              | запамʼятована позиція для цього `mapId`, інакше вільний гекс біля `entryHexobjectKey`. Повернення з печери в `silesia` вже ставить героя туди, де він був                                                                                                                                                               |
| Викинути карту   | `world-map-store.ts` `clearStoredLocation`                                             | `removeSavedWorld(mapId)` + видалення з індексу + `forgetPosition`                                                                                                                                                                                                                                                      |
| Збереження       | `world-storage.ts` `scheduleWorldSave`                                                 | запис **відкладений на 750 мс**. `removeSavedWorld` **не скасовує** відкладений запис, `readSavedMap` його не бачить. Фікс є в `map-generator-v1@90d9618`                                                                                                                                                               |
| Ресурси          | `map/resource-hydration.ts` `findTilesMissingSpawners`                                 | спавнери дерев/каміння відновлюються **з `map.config`** (`IHexMapPlacement[]`). Без `config` ресурси не відростають                                                                                                                                                                                                     |
| Прохідність      | `hero-movement/movement-grid.ts` `isTraversableTile`                                   | прохідний = тайл є, **`isRevealed`**, обʼєкт не `SOLID`, не `CAMPING_ENTRANCE`. `findShortestPath` вимагає прохідну ціль                                                                                                                                                                                                |
| Рендер           | `apps/web/src/render/layers/tiles-layer.ts`                                            | малює всі тайли `map.tiles`; нерозкритий — хмара туману; фон — `hexBackgroundImagePath` або `/hex-assets/placement-hex.png`. Клітинки без тайла не малюються                                                                                                                                                            |
| Розміщення       | `apps/web/src/composables/use-hex-board-sizing.ts`                                     | `scale = 1`; `mapBounds` рахується з bbox **тайлів**                                                                                                                                                                                                                                                                    |
| Dev-панелі       | —                                                                                      | на гілці немає жодної                                                                                                                                                                                                                                                                                                   |
| Туман            | `map/fog-service.ts` `revealAroundHero`                                                | радіус 1                                                                                                                                                                                                                                                                                                                |
| Рамка дошки      | G0, `generators/world-map-v2/board-size.ts`                                            | `BOARD_COLUMNS = 18`, `BOARD_ROWS = 17`                                                                                                                                                                                                                                                                                 |
| Сид              | G0, `generators/world-map-v2/board-seed.ts`, `utils/random-seeded.ts`                  | `boardSeed`, `attemptSeed`, `GENERATION_VERSION`, seeded RNG з підпотоками                                                                                                                                                                                                                                              |

---

## Частина 3 — Модель

### 3.1 Види дошок

| Вид        | Локації                                | Звідки                                        | Коли будується                                                                       |
| ---------- | -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `STATIC`   | `camping`, `silesia`, майбутні світові | креслення всієї дошки, без випадковості       | один раз; стан (зібране, туман) зберігається; **змінилось креслення → перебудувати** |
| `DUNGEON`  | `cave`                                 | схема + ділянки + слоти з пресету             | **з нуля на кожен новий вхід**; reload посеред заходу — та сама дошка                |
| `SCENARIO` | (C3)                                   | та сама збірка, слоти заповнює сетап сценарію | з нуля на кожен новий запуск                                                         |

`camping` лишається на нинішньому `WorldGenerator` до C4 — він уже статичний і працює.

### 3.2 Статичне креслення

Один файл на дошку: `packages/engine/src/content/boards/static/<locationKey>.ts`.

```ts
export const SILESIA_BOARD = {
  id: 'silesia',
  background: '', // '' = нинішній фон (placement-hex.png)
  legend: {
    A: { hexobjectKey: 'tree', overrides: { regrowMs: 25000 } },
    R: { hexobjectKey: 'rock' },
    C: { hexobjectKey: 'camping-entrance' },
    V: { hexobjectKey: 'cave-entrance' },
    H: { hexobjectKey: 'health-bottle' },
  },
  //       0 1 2 3 4 5 6 7 8 9 ...
  rows: [
    '. . A . . . R . . ~ ...', // r00
    ' . . . . V . . . . ~ ...', // r01
    // ... 17 рядків по 18 клітинок
  ],
} satisfies StaticBoardDrawing;
```

- `.` ґрунт, `#` стіна (`STONE_WALL`), `~` порожнеча (клітинки не існує, не малюється).
- Будь-яка інша велика літера чи цифра — обʼєкт із `legend` (з `overrides`, якщо треба).
- **Непарні рядки пишуться з одним пробілом попереду** — текст виглядає як гексова сітка. Парсер пробіли ігнорує: `trim().split(/\s+/)`.
- Жодної випадковості: `?` і слоти в статичному кресленні заборонені лінтером.
- Правити можна руками або **редактором у грі** (C2b), який сам пише цей файл.

### 3.3 Генерована дошка: ділянки, схеми, пресет

**Ділянка (chunk)** — прямокутний шматок, намальований тими самими символами, з тегом біому:

```ts
{
  id: 'cave-hall-01',
  biome: 'CAVE',
  rows: [
    '# # # D # # #',
    ' # . . . T . #',
    '# . E . . . #',
    ' D . . P . . D',
    '# . T . . ? #',
    ' # . . . . . #',
    '# # # D # # #',
  ],
}
```

Додаткові символи ділянок: `?` — ґрунт або стіна за сидом; `T` — слот ресурсу; `P` — слот цікавого місця; `E` — слот ворога; `D` — можливі двері на краю; `X` — слот входу/порталу на краю. Незаповнений слот стає ґрунтом, невикористана `D` — стіною. Ділянка може мати свою `legend` для закріплених обʼєктів (букви, крім `T P E D X`).

**Схема (layout)** — зони на рамці 18×17, звʼязки, глибина:

```ts
{
  id: 'fork-01',
  zones: [
    { id: 'A', col: 5,  row: 10, width: 7, height: 7 },
    { id: 'B', col: 0,  row: 2,  width: 7, height: 7 },
    { id: 'C', col: 11, row: 2,  width: 7, height: 7 },
  ],
  links: [ { from: 'A', fromEdge: 'N', to: 'B', toEdge: 'S' },
           { from: 'A', fromEdge: 'N', to: 'C', toEdge: 'S' } ],
  entryZone: 'A',
  depth: { A: 0, B: 1, C: 1 },
}
```

**Пресет** — рецепт генерованої локації:

```ts
{
  id: 'cave',
  layouts: ['fork-01', 'basin-01'],
  biome: 'CAVE',
  background: '/hex-assets/board-hexes/stone-hex.png',
  entryObject: 'cave-exit',           // у X зони входу
  slots: {
    resource: { hexobjectKey: 'rock', min: 3, max: 6 },
    poi:      { hexobjectKeys: ['chest', 'fireplace', 'healing-spring'], min: 1, max: 2 },
    enemy:    { hexobjectKey: 'skeletor', min: 0, max: 1 },   // лише в зонах найбільшої depth
  },
  fallbackChunks: { /* layoutId → zoneId → chunkId */ },
}
```

### 3.4 Як збирається генерована дошка

1. **Сид** — `getWorldSeed()` цієї карти (свіжий для кожного нового `mapId`, див. Частину 2), далі підпотоки G0.
2. **Схема** — з пресету; якщо схем кілька, обирає сид.
3. **Ділянка для кожної зони** — біом пресету, **точний** розмір зони, `D` на всіх краях, які потрібні звʼязкам цієї зони. Обирає сид.
4. **Вертикальне дзеркало** (верх ↔ низ, міняє `N`/`S`) — лише для ділянок **непарної висоти**. Інші повороти й горизонтальне дзеркало заборонені: на odd-r вони змінюють парність рядків і ламають сусідство (цей клас помилки вже ловили в G2).
5. **`?`** → ґрунт або стіна за сидом.
6. **Двері:** для кожного звʼязку — по одній `D` на відповідних краях двох зон; клітинки між ними стають ґрунтом (лінія — `generators/world-map-v2/embedder/hex-line.ts`). Невикористані `D` → стіна.
7. **Стіни й порожнеча:** клітинка поза зонами або `#` **без прохідного сусіда** → порожнеча (не тайл); **з прохідним сусідом** → стіна `STONE_WALL`. Звідси неправильний силует без налаштувань.
8. **Слоти:** вхідний обʼєкт у `X` зони входу; ресурси, POI, вороги — за пресетом; вороги лише в зонах найбільшої `depth`.
9. **Перевірка досяжності власним BFS по клітинках дошки** (не `findShortestPath` — він вимагає `isRevealed`): прохідна клітинка = ґрунт без `SOLID`-обʼєкта. Кожен `SOLID`-обʼєкт, з яким треба взаємодіяти (вхід, портали, POI), і кожен підбирабельний обʼєкт мають мати прохідного сусіда, досяжного від прохідного сусіда вхідного обʼєкта.
10. Не пройшло → наступна спроба з `attemptSeed`, до 12; далі — `fallbackChunks` пресету.

**Зони починаються з парного рядка рамки** — інакше odd-r зсув ламає сусідство всередині ділянки.

### 3.5 Результат збирання

І статична, і генерована дошка перетворюються на звичайний `HexMapModel`:

- `width = BOARD_COLUMNS`, `height = BOARD_ROWS`;
- тайли **лише** для не-порожніх клітинок; фон — з креслення/пресету;
- обʼєкти — через наявний `HexObjectFactory.create(key, coordinates, overrides)`;
- **`config` = `IHexMapPlacement[]` з кожним розставленим обʼєктом** (разом з `overrides`) — інакше ресурси не відростають;
- `fogPolicy: 'FOG'`.

Плюс дескриптор для dev-панелі й збереження: вид дошки, id креслення/пресету, хеш креслення (для `STATIC`), для генерованих — сид, номер спроби, схема, ділянка кожної зони.

### 3.6 Чому це відповідає правилу фізичної гри

Статична дошка — надрукована карта. Ділянка — друкований тайл. Схема — аркуш сетапу. Слот — місце для жетона. Наглядач збирає дошку без жодного підрахунку.

---

## Частина 4 — Рішення

| #   | Рішення                                                                                                                                                                                                         | Чому                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| B1  | Генеровані дошки — зі схеми й ділянок; випадковість лише обирає ділянки, розвʼязує `?` і заповнює слоти                                                                                                         | чітка логіка; три провали емерджентного відчуття                |
| B2  | Три види: `STATIC`, `DUNGEON`, `SCENARIO`                                                                                                                                                                       | Oleh, 23.09.2026                                                |
| B3  | `STATIC` — креслення всієї рамки без випадковості                                                                                                                                                               | повний контроль                                                 |
| B4  | `DUNGEON` — нова дошка на кожен новий вхід: при виході з печери її збережена карта викидається (`clearStoredLocation`), наступний вхід отримує новий `mapId` і новий сид. Reload посеред заходу — та сама карта | Oleh; і це вже закладено в код (Частина 2)                      |
| B5  | Підземелля — наявна локація `cave`; `LocationKey` не розширюється                                                                                                                                               | мінімум змін                                                    |
| B6  | Цілі порталів не пишуться в кресленні: ціль задана типом обʼєкта (`enter.locationKey`)                                                                                                                          | так працює наявний код                                          |
| B7  | Контент — TS-модулі з даними, Zod-валідація при завантаженні, `packages/engine/src/content/boards/`                                                                                                             | правило №3 `CLAUDE.md`                                          |
| B8  | Трансформації ділянок — лише вертикальне дзеркало непарної висоти; зони з парного рядка                                                                                                                         | odd-r                                                           |
| B9  | Стіна — новий `STONE_WALL`: `SOLID`, не ресурс, без взаємодії; ніколи `ROCK`/`TREE`                                                                                                                             | ресурси герой прибирає й проходить крізь стіну                  |
| B10 | Дошка несе `map.config` з усіма обʼєктами                                                                                                                                                                       | спавнери ресурсів відновлюються з `config`                      |
| B11 | Збережена `STATIC`-карта памʼятає хеш креслення; хеш змінився → карта перебудовується                                                                                                                           | інакше після правки креслення гра показує стару збережену карту |
| B12 | Статичні дошки редагуються в грі (dev): клік → обʼєкт → «Зберегти» переписує файл креслення                                                                                                                     | Oleh: додати обʼєкт у потрібне місце має бути легко             |
| B13 | «Показати всю дошку» — лише рендер; `isRevealed` не змінюється                                                                                                                                                  | рух залежить від `isRevealed`                                   |
| B14 | Рух героя не змінюється; правило «печера запечатана 60 с після зачистки» (`respawnAfterClearedMs`) теж лишається як є                                                                                           | нова механіка руху — після дошок; чужі правила не чіпаємо       |
| B15 | Приймання — у грі, зразків немає                                                                                                                                                                                | Oleh, 23.09.2026                                                |
| B16 | `CONTENT_VERSION` не бампається; нові поля збереження — адитивні                                                                                                                                                | як у G0                                                         |

---

## Частина 5 — Що береться з уже зробленого

| Що                                                           | Звідки | Для чого              |
| ------------------------------------------------------------ | ------ | --------------------- |
| Seeded RNG, `boardSeed`, `attemptSeed`, `GENERATION_VERSION` | G0     | сид генерованих дошок |
| `BOARD_COLUMNS`, `BOARD_ROWS`                                | G0     | рамка                 |
| `hex-line.ts`                                                | G2     | двері між зонами      |
| Правило «стіна = непрохідна клітинка з прохідним сусідом»    | G2     | крок 7                |

**Не використовується:** граматики, селектор, `branch-outcome`, лінтер графа (G1); embedder і розкладка (G2); стенд зразків (G3). Не видаляти до C4.

---

## Частина 6 — Фази

### C1 — Формат, статична `silesia`, збирання `cave` (лише рушій)

**Результат:** у `packages/engine` є формат креслень, ділянок, схем і пресетів; `silesia` існує як статичне креслення, що 1:1 відтворює нинішню карту; `cave` збирається з ділянок. У грі ще нічого не змінилось.

```
Working in hexoflat, branch map-generator-v2 is already checked out — work there, do not create
any branch, and do not commit. Read docs/WORLD-MAP-BOARDS-PLAN.md — parts 2, 3, 4, 5 and phase C1
only. It replaces docs/WORLD-MAP-GENERATOR-V2-PLAN.md; from that document only the finished phase
G0 is reused. Part 2 lists how the current code works — if anything there no longer matches the
code, stop and report it instead of working around it.

Scope: packages/engine only. Do not touch apps/web, MapRegistry, or hero movement. Do not delete
the G1/G2/G3 code.

1. STONE_WALL hexobject: add HEXOBJECT_KEYS.STONE_WALL = 'stone-wall', extend TConstructionKeys
   and CONSTRUCTION_CONTENT in packages/engine/src/content/constructions.content.ts:
   groupType CONSTRUCTION, isInteractable false, collision SOLID, no actions, no enter,
   construction { integrity: 1000, isLocked: false }, placeholder spritePath
   '/hex-assets/hex-resources/rock-token-image.png'. It must not be a resource. Update anything
   that enumerates construction keys so the existing content tests still pass.

2. Content format under packages/engine/src/content/boards/, Zod schemas + inferred types, Zod
   validation on load:
   - StaticBoardDrawing (section 3.2): id, background (string, '' allowed), legend
     (single uppercase letter or digit -> { hexobjectKey, overrides? }), rows.
   - BoardChunk (section 3.3): id, biome, rows, optional legend (letters other than T P E D X).
   - BoardLayout: id, zones { id, col, row, width, height }, links { from, fromEdge, to, toEdge },
     entryZone, depth per zone.
   - GeneratedBoardPreset: id, layouts, biome, background, entryObject, slots
     { resource, poi, enemy } with counts, fallbackChunks.
   One file per static drawing: content/boards/static/<locationKey>.ts. Chunks under
   content/boards/chunks/<biome>/, layouts under content/boards/layouts/, presets under
   content/boards/presets/.

3. Row parser: rows are whitespace-separated single-character cells; odd rows are written with one
   leading space so the text looks like the odd-r pointy-top grid (odd rows shifted right);
   whitespace is ignored. Symbols per sections 3.2 and 3.3.

4. Library linter, run as a unit test over all content: rectangular rows; legal symbols; every
   legend letter used is defined and every hexobjectKey exists; static drawings are exactly
   BOARD_COLUMNS x BOARD_ROWS and contain no `?` and no slot symbols; chunk D and X only on edges;
   all passable cells of a chunk connected and every door reachable from every other door; layout
   zones inside the frame, non-overlapping, starting on an EVEN row; for every zone of every layout
   used by a preset, at least one chunk of the preset's biome with the exact size and the doors the
   zone's links need.

5. buildStaticBoard(drawing): HexMapModel per section 3.5 — width/height = BOARD_COLUMNS /
   BOARD_ROWS, tiles only for non-void cells, background from the drawing, `#` with a passable
   neighbour -> STONE_WALL and without one -> void, objects via HexObjectFactory.create(key,
   coordinates, overrides), map.config = IHexMapPlacement[] containing every placed object with its
   overrides (resource spawners are hydrated from map.config in map/resource-hydration.ts),
   fogPolicy 'FOG'. Return the map plus a descriptor { kind: 'STATIC', id, drawingHash } where
   drawingHash is a stable hash of the drawing content. No randomness, no seed.

6. assembleGeneratedBoard(seed, preset): section 3.4 steps 2-10, returning the same kind of
   HexMapModel plus a descriptor { kind: 'DUNGEON', presetId, seed, attempt, layoutId,
   chunkByZone }. Use G0's seeded RNG substreams; only vertical flip for odd-height chunks, no
   other transform; doors via generators/world-map-v2/embedder/hex-line.ts; reachability with its
   own BFS over the board cells, NOT findShortestPath (it requires isRevealed): a passable cell is
   ground without a SOLID object; every interactable SOLID object (entry, portals, POI) and every
   pickable object must have a passable neighbour reachable from a passable neighbour of the entry
   object. Retry with attemptSeed up to 12 times, then use the preset's fallbackChunks.

7. Starter content:
   - content/boards/static/silesia.ts reproducing TODAY's silesia 1:1: the output of
     HexMapProvider.getHomeLand() AFTER its safe-zone clearing (not the raw homelandMapConfig) —
     the same hexobjects with the same overrides on the same coordinates, background '' (so it
     renders exactly as now), all 17x15 cells ground, the rest of the 18x17 frame void.
   - layouts fork-01 and basin-01 (section 3.3 gives the shape idea; exact zones are yours, all
     zones start on even rows);
   - about 6 CAVE chunks sized for those zones;
   - preset `cave`: CAVE biome, background '/hex-assets/board-hexes/stone-hex.png',
     entryObject 'cave-exit', resource 'rock' 3-6, poi from chest / fireplace / healing-spring
     1-2, enemy 'skeletor' 0-1 in the deepest zones only.

Tests: buildStaticBoard(silesia) matches getHomeLand() — for every coordinate of the old map the
same hexobject key and overrides and both passable/not; extra frame cells are void; the static
build is identical on every call and its drawingHash is stable; assembleGeneratedBoard with the
same seed gives the same board and different seeds give different boards; 200 seeds all assemble
and pass reachability; every generated board has exactly one cave-exit; map.config contains every
placed object; the library linter passes; CONTENT_VERSION stays 1; engine build, lint and tests
are green.

At the end, append a row to the progress journal in docs/WORLD-MAP-BOARDS-PLAN.md.
```

### C2 — Дошки в грі

**Результат:** Oleh грає петлю кемп → `silesia` (зі статичного креслення) → `cave` (щоразу нова) → `silesia`. Є dev-панель: бачити всю дошку, перезбирати печеру.

```
Working in hexoflat, branch map-generator-v2 is already checked out — work there, do not create
any branch, and do not commit. Read docs/WORLD-MAP-BOARDS-PLAN.md — parts 2, 3, 4 and phase C2
only. C1 is done. Oleh reviews boards by playing them, so this phase must end with a playable
loop. If anything in part 2 no longer matches the code, stop and report it.

1. Sparse-map safety FIRST. C1 boards have tiles only for non-void cells, fewer than
   width x height. Write characterization tests for pathfinding, fog-service, free-hex-finder,
   world-storage save/load and the tiles render layer on such a map, then fix whatever fails.

2. Persistence fixes before anything uses them: port the read-your-writes fix from
   map-generator-v1 commit 90d9618 into apps/web/src/services/persistence/world-storage.ts —
   readSavedMap / readSavedWorldState read a still-pending debounced save first, and
   removeSavedWorld cancels any pending save for that mapId — with its test.

3. MapRegistry (packages/engine/src/registry/world-map-registry.ts): add
   boardKind: 'STATIC' | 'DUNGEON' to MapDefinition and change create to
   create(ctx: { seed: string }) returning { map, descriptor }. camping: STATIC, keeps the current
   HexMapProvider.getCamping() (descriptor with kind STATIC and no drawingHash). silesia: STATIC,
   buildStaticBoard(SILESIA_BOARD). cave: DUNGEON, assembleGeneratedBoard(seed, CAVE_PRESET).
   Keep respawnAfterClearedMs on cave and the existing "sealed for now" behaviour unchanged. Keep
   HexMapProvider.getHomeLand / getSkeletorsKingdom and their configs in the repo, unused.

4. world-map-store (apps/web/src/stores/world-map-store.ts):
   - loadLocationMap calls def.create({ seed: getWorldSeed() }) — loadFromStorage has already
     reseeded to a fresh UUID for a new mapId — and stores the descriptor in the world state
     (new optional field, additive).
   - STATIC rebuild rule: when a saved map exists for a STATIC location whose descriptor has a
     drawingHash, and the current drawing's hash differs, discard the saved location
     (clearStoredLocation) and build it fresh.
   - New dungeon on every new entry: in leaveCurrentLocation, when leaving a DUNGEON location for a
     different location, keep the existing respawn scheduling first, then do NOT save it and call
     clearStoredLocation(leavingKey, currentMapId). A reload inside the cave (bootstrapWorld with
     the saved mapId) must still give the same board.
   - Do not change placeHeroOnArrival: returning to silesia already uses the remembered position.

5. Fixed frame: in apps/web/src/composables/use-hex-board-sizing.ts compute mapBounds over the
   map's own frame (every coordinate 0..width-1 x 0..height-1), not over the bbox of existing
   tiles, so a board does not jump with its footprint. scale stays 1, no camera.

6. Dev-only board panel, mounted in hex-world-map.vue via defineAsyncComponent under
   import.meta.env.DEV, never in the production bundle:
   - shows location, board kind, seed, and for DUNGEON the layout id, chunk id per zone and
     attempt;
   - DUNGEON buttons: regenerate (discard the current cave map and rebuild it, hero at the
     entry), next seed, force layout;
   - "show whole board" toggle: RENDER ONLY — the tiles layer draws tiles as if revealed; it must
     not change tile.isRevealed, because movement (isTraversableTile) depends on it;
   - zone-outline toggle labelled with each zone's chunk id.

7. Do NOT change hero movement in any way (rules, move-planner, movement-grid, fog reveal radius,
   token animation). Portals stay the existing SOLID constructions with the ENTER action.

8. Run the whole e2e suite. silesia keeps the same objects on the same coordinates, but its frame
   is now 18x17 instead of 17x15; if e2e tests break because of that, fix them through the
   existing test hooks, not by changing the board.

Acceptance: camp -> silesia -> cave -> silesia is playable in the UI; silesia looks and plays as
before; every new cave entry gives a new board and a reload inside the cave keeps it; void cells
never render; on-screen hex size is identical with the hero panel open and closed; no dev panel
in the production build; size-limit, lint, typecheck, unit and e2e tests pass.

At the end, append a row to the progress journal in docs/WORLD-MAP-BOARDS-PLAN.md.
```

### C2b — Редактор статичних дошок у грі (лише dev)

**Результат:** щоб поставити обʼєкт у потрібне місце базової карти, Oleh у dev-режимі вмикає «Редагувати», клікає гекс, обирає обʼєкт, тисне «Зберегти». Файл креслення перезаписується, гра перебудовує дошку, `git diff` показує лише змінені рядки.

```
Working in hexoflat, branch map-generator-v2 is already checked out — work there, do not create
any branch, and do not commit. Read docs/WORLD-MAP-BOARDS-PLAN.md — sections 3.2 and 3.5 and
phase C2b only. C1 and C2 are done.

Goal: Oleh edits STATIC boards drawn with StaticBoardDrawing (silesia now) inside the running
game in dev mode instead of counting cells in the text file.

1. "Edit board" toggle in the dev board panel, only on locations whose descriptor is STATIC with a
   drawingHash. Edit mode turns on the render-only "show whole board" view and shows each hex's
   coordinates.
2. Click a hex -> palette: ground, wall, void, and every key in HEXOBJECT_KEYS with a name
   search. Placing keeps the object's default overrides; if an identical legend entry
   (hexobjectKey + overrides) already exists, reuse its letter, otherwise take the next free
   uppercase letter or digit. Changes show on the board immediately. Save and Cancel buttons.
3. Save goes through a dev-only Vite middleware in apps/web/vite.config.ts (configureServer, serve
   mode only): it receives the drawing, validates it with the C1 Zod schema and library linter,
   and rewrites packages/engine/src/content/boards/static/<id>.ts. An invalid drawing is not
   written; the editor shows the linter's reason. Neither the middleware nor the editor may reach
   the production bundle.
4. Canonical file format written by the serializer: the rows array with a `// rNN` row-number
   comment at the end of each row, a column-index comment above the array, odd rows with one
   leading space, legend sorted, unused legend letters removed. Serializing an unchanged drawing
   must produce a byte-identical file, so git diffs show only real edits.
5. After a save the drawing hash changes, so the C2 rebuild rule rebuilds the location on reload;
   make the editor trigger that reload.

Tests: parse -> serialize -> parse gives the same board; the serializer is idempotent on every
existing static drawing; the middleware rejects invalid drawings; nothing from the editor or the
middleware is in the production build. Do not change hero movement, do not touch generated
boards.

At the end, append a row to the progress journal in docs/WORLD-MAP-BOARDS-PLAN.md.
```

### Огляд у грі

Oleh грає. Правки після огляду — **здебільшого в даних**: статичні дошки — редактором (C2b), ділянки й схеми підземель — у файлах. Якщо огляд вимагає зміни логіки збирання — запис у журналі й короткий окремий чат.

### C3 — Сценарії

Обʼєкт сценарію — Zod-валідований версіонований контент: завдання; пресет (схеми, біом); сетап обʼєктів (що, скільки, у зонах якої глибини, які портали). Карта сценарію збирається з нуля на кожен запуск тією самою функцією `assembleGeneratedBoard` — сетап сценарію замінює правила слотів пресету. Лінтер: для кожного сценарію є схема й ділянки, куди вміщається весь сетап.

**Перед стартовим промптом треба вирішити:** звідки запускається сценарій (кемп, окремий екран, портал); що відбувається після виконання завдання; яка `LocationKey` у сценарної карти (зараз список локацій закритий). Промпт пишеться після огляду C2.

### C4 — E2E, прибирання, заморозка

- E2E за скілом `hexoflat-e2e`: вихід із кемпу — герой біля входу `silesia`; `silesia` однакова після reload; новий вхід у печеру — нова дошка, reload у печері — та сама; петля через портал повертає на запамʼятований гекс.
- `camping` — у статичне креслення.
- Видалити G1/G2/G3-код, стенд зразків, `HexProvider`-конфіги, які більше не використовуються.
- Оновити `CLAUDE.md`, дописати журнал.

Промпт пишеться після C3.

---

## Частина 7 — Чого не робимо

- Не чіпаємо рух героя.
- Не чіпаємо бій; вороги в слотах — наявний `SKELETOR` з наявною поведінкою.
- Не додаємо нового арту; `STONE_WALL` зі спрайтом-заглушкою.
- Не робимо поворотів і горизонтального дзеркала ділянок.
- Не розширюємо `LocationKey` до C3.
- Не бампаємо `CONTENT_VERSION`.
- Не адаптуємо під мобільні вюпорти.

---

## Частина 8 — Ризики

1. **Мала бібліотека ділянок — помітні повтори в печері.** Свідомо: спершу перевірка в грі. Ділянки — дешевий контент.
2. **Ділянки привʼязані до точних розмірів зон.** Тримати кілька стандартних розмірів зон.
3. **Розріджена карта** може зачепити більше коду, ніж видно. Тому C2 починається з характеризаційних тестів.
4. **Рамка `silesia` 17×15 → 18×17** може зрушити e2e, що рахують положення тайлів. C2 проганяє весь набір.
5. **Правило «змінилось креслення → перебудувати»** скидає збережений стан статичної локації (зібране, туман) і для гравців, коли креслення змінюється в релізі. Для розробки це саме те, що треба; для релізу — окреме рішення пізніше.
6. **Туман радіусом 1** робить будь-яку дошку в грі схожою на стежку. Для оцінки — «показати всю дошку».

---

## Частина 9 — Журнал прогресу

| Дата       | Фаза | Результат                                                                                                                                                                                                                             | Гілка              |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 23.09.2026 | —    | План створено замість `WORLD-MAP-GENERATOR-V2-PLAN.md`. Три види дошок: `STATIC` (креслення), `DUNGEON` (з ділянок, нова на кожен вхід), `SCENARIO` (C3). Факти про код звірені й записані в Частині 2; промпти C1, C2, C2b — під них | `map-generator-v2` |
