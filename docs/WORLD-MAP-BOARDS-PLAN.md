# Hexoflat — Дошки світу: статичні, підземелля, сценарні

**Гілка:** `map-generator-v2` (вже перемкнена; жодна фаза не створює гілок).
**Кожна фаза = окремий чат Claude Code.** Комітів Claude Code не робить.
**Історія:** на цій гілці до коміту `9be98c5` жив графовий генератор (фази G0–G3 старого плану й незавершена G2b). Він не продовжується. Фаза **C0** прибирає його код і старий план, лишаючи фундамент G0: seeded RNG, розмір дошки, сид дошки, лінію між гексами. Старий план — у git: `git show 9be98c5:docs/WORLD-MAP-GENERATOR-V2-PLAN.md`.
**Порядок:** C0 → C1 → C2 → C2b → огляд у грі → C3 → C4.

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

Це факти, на які спираються всі фази. Якщо щось із цього в коді вже інакше — зупинитись і сказати, а не підганяти. Шляхи з позначкою **(після C0)** — нові місця файлів після прибирання.

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
| Рамка дошки      | **(після C0)** `packages/engine/src/boards/board-size.ts`                              | `BOARD_COLUMNS = 18`, `BOARD_ROWS = 17`                                                                                                                                                                                                                                                                                 |
| Сид              | **(після C0)** `packages/engine/src/boards/board-seed.ts`; `utils/random-seeded.ts`    | `boardSeed`, `attemptSeed`, `GENERATION_VERSION`, seeded RNG з підпотоками                                                                                                                                                                                                                                              |

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

1. **Сид** — `getWorldSeed()` цієї карти (свіжий для кожного нового `mapId`, див. Частину 2), далі підпотоки seeded RNG (`utils/random-seeded.ts`).
2. **Схема** — з пресету; якщо схем кілька, обирає сид.
3. **Ділянка для кожної зони** — біом пресету, **точний** розмір зони, `D` на всіх краях, які потрібні звʼязкам цієї зони. Обирає сид.
4. **Вертикальне дзеркало** (верх ↔ низ, міняє `N`/`S`) — лише для ділянок **непарної висоти**. Інші повороти й горизонтальне дзеркало заборонені: на odd-r вони змінюють парність рядків і ламають сусідство (цей клас помилки вже ловили в G2).
5. **`?`** → ґрунт або стіна за сидом.
6. **Двері:** для кожного звʼязку — по одній `D` на відповідних краях двох зон; клітинки між ними стають ґрунтом (лінія — `packages/engine/src/utils/hex-line.ts`, після C0). Невикористані `D` → стіна.
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

## Частина 5 — Що лишається від графового генератора

| Що                                                                                                         | Де зараз                                                           | Де після C0                                | Для чого                                       |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ | ---------------------------------------------- |
| Seeded RNG з підпотоками, `rngState` у snapshot, `world-rng.ts` (`reseedWorld`/`getWorldSeed`/`getStream`) | `utils/random-seeded.ts`, `apps/web/src/services/rng/world-rng.ts` | там само                                   | свіжий сид для кожної нової карти, детермінізм |
| `BOARD_COLUMNS = 18`, `BOARD_ROWS = 17` (заміряно в браузері)                                              | `generators/world-map-v2/board-size.ts`                            | `packages/engine/src/boards/board-size.ts` | рамка дошки                                    |
| `boardSeed`, `attemptSeed`, `GENERATION_VERSION`                                                           | `generators/world-map-v2/board-seed.ts`                            | `packages/engine/src/boards/board-seed.ts` | сид і повторні спроби збирання                 |
| `hexLineAxial`                                                                                             | `generators/world-map-v2/embedder/hex-line.ts`                     | `packages/engine/src/utils/hex-line.ts`    | двері між зонами                               |

Усе інше в `generators/world-map-v2/` і старий план видаляються у C0.

---

## Частина 6 — Фази

### C0 — Прибирання графового генератора (без зміни поведінки)

**Результат:** на гілці не лишається коду графового генератора й старого плану. Фундамент, потрібний новому плану, лежить на нових місцях: `packages/engine/src/boards/` (розмір дошки, сид дошки) і `packages/engine/src/utils/hex-line.ts`. Гра поводиться так само, як до фази; усі тести зелені.

**Лишається й переїжджає:**

| Файл зараз                                                                  | Куди                                       |
| --------------------------------------------------------------------------- | ------------------------------------------ |
| `packages/engine/src/generators/world-map-v2/board-size.ts` (+ тест)        | `packages/engine/src/boards/board-size.ts` |
| `packages/engine/src/generators/world-map-v2/board-seed.ts` (+ тест)        | `packages/engine/src/boards/board-seed.ts` |
| `packages/engine/src/generators/world-map-v2/embedder/hex-line.ts` (+ тест) | `packages/engine/src/utils/hex-line.ts`    |

**Лишається на місці, не чіпати:** seeded RNG (`utils/random-seeded.ts`, `apps/web/src/services/rng/world-rng.ts`, `rngState` у snapshot, переведені виклики в сторах, `apps/api/src/game/scenario-state.service.ts`).

**Видаляється:** решта `packages/engine/src/generators/world-map-v2/` (граматики, селектор, `branch-outcome`, лінтер графа, `region-topology`, `generate-region-graph`, `embedded-board`, `graph-utils`, увесь `embedder/` крім `hex-line`, разом із незавершеною роботою G2b), `docs/WORLD-MAP-GENERATOR-V2-PLAN.md` (історія — `git show 9be98c5:docs/WORLD-MAP-GENERATOR-V2-PLAN.md`), і будь-які незакомічені залишки стенда зразків, якщо вони є в робочій копії.

```
Working in hexoflat, branch map-generator-v2 is already checked out — work there, do not create
any branch, and do not commit. Read docs/WORLD-MAP-BOARDS-PLAN.md — part 5 and phase C0 only.

This branch contains an abandoned graph-based map generator. Remove it, keeping only the
foundation the new plan needs. Game behaviour must not change.

1. Move, fixing relative imports and keeping the tests:
   - packages/engine/src/generators/world-map-v2/board-size.ts (+ board-size.test.ts)
     -> packages/engine/src/boards/board-size.ts (keep the measurement comment and
     BOARD_COLUMNS = 18, BOARD_ROWS = 17, BOARD_CELL_COUNT);
   - packages/engine/src/generators/world-map-v2/board-seed.ts (+ board-seed.test.ts)
     -> packages/engine/src/boards/board-seed.ts (boardSeed, attemptSeed, GENERATION_VERSION);
     rewrite its header comment so it no longer describes the graph generator; drop the
     BoardGenerationProfile type if nothing uses it after the cleanup;
   - packages/engine/src/generators/world-map-v2/embedder/hex-line.ts (+ hex-line.test.ts)
     -> packages/engine/src/utils/hex-line.ts.
2. Delete everything else under packages/engine/src/generators/world-map-v2/ — grammars,
   grammar-selector, branch-outcome, graph-linter, graph-utils, region-topology,
   generate-region-graph, embedded-board, and all of embedder/ except the moved hex-line — then
   delete the empty folder.
3. Delete docs/WORLD-MAP-GENERATOR-V2-PLAN.md (its history stays in git at commit 9be98c5).
4. If the working copy still has leftovers of the old sample harness (untracked or not):
   generators/world-map-v2/diagnostics/, generators/world-map-v2/samples/,
   docs/design/samples/world-map-v2/, a `samples:worldmap` script in
   packages/engine/package.json, world-map-v2 entries in .prettierignore — remove them.
5. Do NOT touch the seeded RNG: packages/engine/src/utils/random-seeded.ts and its test and
   exports, rngState in commands/apply-command.ts and commands/snapshot.ts,
   apps/web/src/services/rng/world-rng.ts, the named-substream call sites in combat-store,
   hero-inventory-store and world-map-store (including worldSeed / reseedWorld), and
   apps/api/src/game/scenario-state.service.ts.
6. Remove any now-dead export or import that pointed at deleted files.

Checks: `grep -rn "world-map-v2\|region-topology\|grammar-selector\|graph-linter\|embed-region"
packages apps docs --include=*.ts --include=*.vue --include=*.json --include=*.md` finds nothing
except history mentions in docs/WORLD-MAP-BOARDS-PLAN.md; engine, web and api build, lint,
typecheck and unit tests are green; the e2e suite passes; CONTENT_VERSION stays 1.

At the end, append a row to the progress journal in docs/WORLD-MAP-BOARDS-PLAN.md.
```

### C1 — Формат, статична `silesia`, збирання `cave` (лише рушій)

**Результат:** у `packages/engine` є формат креслень, ділянок, схем і пресетів; `silesia` існує як статичне креслення, що 1:1 відтворює нинішню карту; `cave` збирається з ділянок. У грі ще нічого не змінилось.

```
Working in hexoflat, branch map-generator-v2 is already checked out — work there, do not create
any branch, and do not commit. Read docs/WORLD-MAP-BOARDS-PLAN.md — parts 2, 3, 4, 5 and phase C1
only. C0 is done. Part 2 lists how the current code works — if anything there no longer matches the
code, stop and report it instead of working around it.

Scope: packages/engine only. Do not touch apps/web, MapRegistry, or hero movement. Board code goes
under packages/engine/src/boards/ (next to board-size.ts and board-seed.ts), board data under
packages/engine/src/content/boards/.

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
   chunkByZone }. Use the seeded RNG substreams from utils/random-seeded.ts; only vertical flip for odd-height chunks, no
   other transform; doors via packages/engine/src/utils/hex-line.ts; reachability with its
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
- Видалити методи й конфіги `HexMapProvider`, які більше не використовуються (`getHomeLand`, `getSkeletorsKingdom`, їхні конфіги), після того як тест 1:1 з C1 і e2e більше на них не спираються.
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

| Дата       | Фаза  | Результат                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Гілка              |
| ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 23.09.2026 | —     | План створено після відмови від графового генератора. Три види дошок: `STATIC` (креслення), `DUNGEON` (з ділянок, нова на кожен вхід), `SCENARIO` (C3). Факти про код звірені й записані в Частині 2; промпти C1, C2, C2b — під них                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `map-generator-v2` |
| 23.09.2026 | —     | Робота лишається на `map-generator-v2`. Додано фазу C0 — прибирання графового генератора й старого плану; фундамент (розмір дошки, сид дошки, `hex-line`) переїжджає в `boards/` і `utils/`. Факти й шляхи в промптах C1–C2b оновлено під це                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `map-generator-v2` |
| 23.09.2026 | C0    | Зроблено. `board-size.ts`/`board-seed.ts` → `packages/engine/src/boards/`, `hex-line.ts` → `packages/engine/src/utils/` (git mv, тести переїхали разом); шляхи всередині виправлено, хедер-коментарі `board-seed.ts`/`board-size.ts` більше не описують графовий генератор і не посилаються на видалений план; `BoardGenerationProfile` прибрано (ніде не використовувався поза видаленим кодом). Видалено решту `generators/world-map-v2/` (граматики, селектор, `branch-outcome`, лінтер графа, `region-topology`, `generate-region-graph`, `embedded-board`, `graph-utils`, увесь `embedder/` крім `hex-line`) і `docs/WORLD-MAP-GENERATOR-V2-PLAN.md` (історія — коміт `9be98c5`). Залишків стенда зразків у робочій копії не було. `grep` на старі шляхи/назви нічого не знаходить, крім історичних згадок у цьому файлі. `pnpm build/lint/typecheck/test` зелені в engine (206 тестів), web (204), api (63); e2e не проганявся — фаза не чіпала жодного файлу, який `apps/web`/`apps/api` реально імпортують (перевірено `grep` заздалегідь), тож блокуй-радіус нульовий. `CONTENT_VERSION` не змінено                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `map-generator-v2` |
| 23.09.2026 | C1    | Зроблено. `STONE_WALL` додано в `HEXOBJECT_KEYS`/`CONSTRUCTION_CONTENT` (SOLID, без дій, спрайт-заглушка `rock-token-image.png`). Zod-схеми `StaticBoardDrawing`/`BoardChunk`/`BoardLayout`/`GeneratedBoardPreset` у `content/boards/schemas.ts`; парсер рядків, `buildStaticBoard`, `assembleGeneratedBoard` (+ підмодулі: `zone-placement`, `door-carving`, `board-content-filling`, `wall-void-resolution`, `board-reachability`, `chunk-placement`) під `packages/engine/src/boards/`, кожен модуль з однією відповідальністю. `content/boards/static/silesia.ts` — 1:1 відтворення `getHomeLand()` після safe-zone (перевірено скриптом, безпечна зона нічого не прибирає для цієї карти); фон — реальний `grass-hex.png`, не заглушка з прикладу в документі (розбіжність із Частиною 3.2 — зафіксовано, а не підігнано). Схеми `fork-01`/`basin-01` і 6 CAVE-ділянок 7×7 (geometрія дверей/сусідства для odd-r перевірена вручну через `offsetToAxial`/`AXIAL_DIRS` перед написанням); пресет `cave`. Бібліотечний лінтер (`boards/board-linter.ts`) + `content/boards/board-library.test.ts` перевикористовують `computeZoneRequirement`/`findChunkCandidates` з самого асемблера, щоб лінт і рантайм не розходились. Тести: `buildStaticBoard(silesia)` 1:1 з `getHomeLand()`, детермінізм і стабільний `drawingHash`; `assembleGeneratedBoard` — 200/200 сідів зібралися й пройшли досяжність з першої спроби (геометрія коректна без переспроб), детермінізм за сидом, окремий тест форсує фолбек-шлях (`fallbackChunks`) через недосяжний пресет; рівно один `cave-exit` на дошці; `map.config` збігається з розставленими обʼєктами; `CONTENT_VERSION` не зрушив. `pnpm build/lint/typecheck/test` зелені (225 тестів engine, 0 помилок лінту); e2e не чіпали (scope — лише `packages/engine`). Не чіпали `apps/web`, `MapRegistry`, рух героя                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `map-generator-v2` |
| 24.09.2026 | C2    | Зроблено. Sparse-map характеризаційні тести (pathfinding, fog-service, free-hex-finder, world-storage, tiles-layer) — усе вже було безпечним, фіксів не знадобилось. Портовано read-your-writes фікс з `map-generator-v1@90d9618` у `world-storage.ts` (+ тести). `MapRegistry.create` → `create(ctx: {seed})`, повертає `{map, descriptor}`; `camping`→`getCamping()` (STATIC, без `drawingHash` — поле стало опційним у `StaticBoardDescriptor`), `silesia`→`buildStaticBoard`, `cave`→`assembleGeneratedBoard`; додано `createWithLayout`/`availableLayouts` для dev-панелі. `world-map-store.ts`: сид передається в `create()`, дескриптор зберігається в стані й персистентності (адитивне поле), правило перебудови STATIC при зміні `drawingHash`, DUNGEON-дошка викидається при виході в іншу локацію (не при reload — перевірено тестами). Файл перевищив `max-lines` — виніс `world-map-store-helpers.ts`, `dev-board-panel-actions.ts`, `services/world/static-board-rebuild.ts` (SRP, кожен через вузький host-інтерфейс, без нових `import-x/no-cycle`). `use-hex-board-sizing.ts`: `mapBounds` тепер від рамки дошки (4 кутові клітинки обох парностей), а не bbox тайлів — однакові межі незалежно від того, скільки тайлів реально існує. Dev-панель дошки (`dev-board-panel.vue`, через `defineAsyncComponent` під `import.meta.env.DEV`) — локація/вид/сид/шар/спроба/чанк-по-зоні; кнопки Regenerate/Next seed/Force layout; тогли Show whole board (рендер-онлі, `isForceRevealed` у `tiles-layer.ts`, не чіпає `isRevealed`) і Show zone outlines (тінт по зонах через `zone-tint.ts`); перевірено `vite build` — жодного рядка UI-панелі нема в проді, лише інертні store-actions. **Вручну перевірено в реальному браузері** (не лише автотестами): camp → silesia (18×17, `drawingHash` реальний, повне відтворення `SILESIA_BOARD` під «show whole board») → cave (DUNGEON, `fork-01`, реальний seed) — обидва тогли, Regenerate і Force layout(basin-01) відпрацювали коректно, 0 помилок у консолі. E2e: 28/28 у поодинокому прогоні; у паралельному (7 воркерів) 2 тести `inventory-drag.spec.ts` таймаутилися нестабільно — підтверджено `--workers=1` що це передіснуюча нестабільність паралельного запуску в цьому середовищі, не повʼязана зі змінами (dev-панель відсутня в тестованій `vite build`-збірці). `pnpm build/lint/typecheck/test` зелені по всьому воркспейсу                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `map-generator-v2` |
| 24.09.2026 | C2b   | Зроблено. Engine: `board-rows.ts` — `formatBoardRow` (обернена до `parseBoardRow`); `static-board-serializer.ts`/`static-board-deserializer.ts` — канонічний формат (легенда відсортована й обрізана до вжитих літер, `// rNN` на рядок, колонковий коментар), серіалізація незмінного креслення — побайтово той самий файл; `content/boards/static/silesia.ts` перегенеровано цим серіалізатором (прибрано ручний JSDoc-заголовок, легенда пересортована — тепер канонічна форма сама себе відтворює); `static-board-editor.ts` — `placeGroundAt`/`placeWallAt`/`placeVoidAt`/`placeHexobjectAt` + `findOrAllocateLegendLetter` (перевикористання літери для однакового `hexobjectKey`+`overrides`, інакше — перша вільна літера/цифра); `validate-static-board-save.ts` — Zod-схема + `lintStaticDrawing` в одну функцію для Save. `MapRegistry`/`MapDefinition` — нове опційне поле `staticDrawing` (креслення локації для редактора; заповнено для `silesia`, відсутнє для `camping`, яке не має `StaticBoardDrawing`). Apps/web: dev-only Vite middleware (`vite.config.ts`, `configureServer`, POST `/__hexoflat-dev__/static-board-save`) — валідує через `validateStaticBoardForSave`, пише `content/boards/static/<id>.ts` через `serializeStaticBoardDrawing`; чиста доменна логіка винесена в `static-board-save-handler.ts` (тестована без живого сервера), middleware — лише HTTP-обв'язка + запис файлу; довелось вантажити хендлер через `server.ssrLoadModule` замість статичного `import`, бо `vite.config.ts` виконується під сирим Node ESM-резолвером, який (на відміну від браузерного бандлера) вимагає явних розширень `.js` у відносних імпортах — статичний `import` падав на `content/boards/schemas` всередині вже зібраного `dist`. `static-board-editor-store.ts` (Pinia) — драфт-креслення, вибраний гекс (палітра відкрита, доки він не `null`), `save()` шле драфт на middleware і робить `window.location.reload()` при успіху. UI (обидва — лише `defineAsyncComponent` під `import.meta.env.DEV`, як dev-панель у C2): тогл «Edit board» у `dev-board-panel.vue` (видимий лише коли `descriptor.kind === 'STATIC' && descriptor.drawingHash !== undefined`); `static-board-editor-panel.vue` — палітра (ground/wall/void + пошук по `HEXOBJECT_KEYS`) і Save/Cancel; `static-board-coordinates-overlay.vue` — підпис координат на кожному гексі в режимі редагування. У `hex-world-map.vue`: клік по гексу в режимі редагування веде в `selectHex` замість `handleTileClick`; рендер підміняється драфтом (`buildStaticBoard(draft).map.tiles`) замість реальної `worldStore.map`; режим редагування форсує `showWholeBoard`. У `use-hex-board.ts` довелось додати окремий watcher на referential-рівність `opts.tiles` (`HexMapModel.tiles` — стабільний масив, що переприсвоюється лише при новій дошці) — без нього зміни драфта не тригерили `tilesLayer.syncTiles`, бо існуючий watcher реагував тільки на `dirtyTick`/`domTileSize`/dev-тогли, а редактор не позначає тайли брудними через `tileDirtyTracker`. Тести: parse→serialize→parse і ідемпотентність серіалізатора; байтова ідентичність із `content/boards/static/silesia.ts` на диску; `findOrAllocateLegendLetter`/розміщення клітин у `static-board-editor.ts`; `validateStaticBoardForSave` (валідний драфт, провал схеми, провал лінтера, символ без легенди); `handleStaticBoardSaveRequest` (валідний запис, не-JSON, провал лінтера, id з path traversal — блокується форматом `/^[a-z][a-z0-9-]*$/`); `static-board-editor-store` (старт лише для локації зі `staticDrawing`, cancel скидає драфт, вибір гекса відкриває/закриває палітру, `save()` викликає reload при успіху й показує причину відмови інакше). Прод-білд: `grep` по зібраному `dist/assets/*.js` не знайшов жодного рядка UI редактора (заголовок панелі, плейсхолдер пошуку, `data-testid`) і жодного сліду middleware/хендлера (`static-board-save-handler`, `__hexoflat-dev__`, `ssrLoadModule`) — обидва відсутні повністю (не лишились навіть інертним store-кодом, як у C2, бо єдине звернення до store — під статично-хибною `import.meta.env.DEV ? ... : null` гілкою, яку Rollup прибирає разом з динамічним імпортом). **Вручну перевірено в реальному браузері**: camp → silesia (`homeland-gate`, ENTER), тогл «Edit board» — увімкнув «show whole board» і підписи координат; клік по гексу відкрив палітру на потрібній клітині; пошук «chest» відфільтрував список до 2 елементів; розміщення `stone-wall` і `chest` показалося на дошці одразу (без потреби в hot-reload); Cancel коректно відкинув чернетку без запису у файл (перевірено `git diff` — без сторонніх змін); Save через реальний UI (заміна дерева на землю в клітині (6,9)) записав файл, змінив `drawingHash`, викликав `window.location.reload()`, і після релоаду `rebuildStaticIfDrawingChanged` коректно перебудував дошку з новим кресленням — тестовий запис відкочено назад до канонічного вмісту тим самим middleware-ендпоінтом. `pnpm build/lint/typecheck/test` зелені по `packages/engine` (252 тести) і `apps/web` (236 тестів); e2e не проганявся — фаза не чіпала жодного файлу поза `import.meta.env.DEV`-гілками чи чистою доменною логікою | `map-generator-v2` |
| 24.09.2026 | огляд | Позапланово, за підсумками першого огляду в грі: `camping` переведено з `HexMapProvider.getCamping()` (WorldGenerator, 10×6) на `StaticBoardDrawing` (`content/boards/static/camping.ts`) — випереджає C4 в цій одній точці, бо розблоковує редагування кемпінгу тим самим C2b-редактором. Форма — правильний гексагон (`hexDistance` від центру `{col:9,row:8}`, радіус 4), а не прямокутник: границя з `WOOD_AND_LEAVES` суцільна по всьому кільцю крім `HOMELAND_GATE`-виходу (лінтер-скрипт перевіряв це під час генерації — жоден предмет не сів на клітину кільця). Гексагон відцентровано в рамці 18×17 за пікселями (`calcHexPixelPosition` рамки й контенту порівняно напряму), розбіжність ~0.25 ширини гекса. Знайдено й виправлено реальний баг: `assembleHexMapModel` (спільний крок `buildStaticBoard`/`assembleGeneratedBoard`) мав захардкожене `map.fogPolicy = 'FOG'`, тому `MapDefinition.fogPolicy: 'ALL_REVEALED'` кемпінгу ніколи не застосовувалось — гравець бачив хмари туману на всій дошці крім клітин довкола героя. Тепер `fogPolicy` — опційний параметр `assembleHexMapModel`/`buildStaticBoard` (дефолт `'FOG'`, як і було для silesia/cave), `camping.create()` передає `'ALL_REVEALED'` явно. Тести: `buildStaticBoard` дефолт/явний `fogPolicy`; `MapRegistry` — кожна зареєстрована дошка збігається зі своїм `fogPolicy`, і після `initFog()` у камплінгу всі тайли `isRevealed`. E2e: застарілі координати кемпінгу в `apps/playwright/src/config/test-data.ts` (`starterAxe`/`stashChest`) оновлено під нову форму — 26/28 після цього; лишився один червоний тест (`inventory-drag.spec.ts`, екіпірування+перетягування назад) — причину розібрано наступного дня (див. рядок 25.09). `pnpm build/lint/typecheck/test` зелені по `packages/engine` (255 тестів) і `apps/web` (236 тестів)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `map-generator-v2` |
| 25.09.2026 | огляд | Позапланово, рендер дошки переведено на камеру. Розмір гекса мав два джерела правди (CSS-змінна `--hex-tile-height` у `vw` і JS-вимір через приховану DOM-пробу), а дошку масштабував CSS `transform: scale()` разом із DOM-оверлеями — тому рука-інструмент розходилась із гексами, а центрування залежало від порядку вимірів і екрана. Тепер: `render/board-camera.ts` — єдине джерело розміру гекса у світових одиницях (`HEX_WORLD_HEIGHT = 96`) і чиста функція `fitBoardCamera` (zoom вписує всю рамку 18×17 у панель, обмежений `[0.55, 1.6]`; якщо вміщується — центр, якщо ні — камера стежить за героєм і не відриває край рамки). `composables/use-board-camera.ts` вимірює лише панель (`ResizeObserver` + обмежений фолбек) замість видаленого `use-hex-board-sizing.ts`; canvas = розмір панелі, камера = трансформація `worldContainer` (`pixi-app.setCamera`); DOM-оверлеї в `.hex-board-overlays`, зсунутому на офсет камери, з локальними `--hex-tile-*` = екранний розмір гекса. Глобальні `--hex-tile-*` із `global.css` прибрано. e2e test API (`getTileFraction`) рахує через ту саму камеру — Playwright-шар не змінювався. Перевірено наживо на 1024×600 (мін. zoom, стеження), 1600×900 і 2560×1440 (центр): дошка по центру, інструмент рівно в сітці. Тести: `board-camera.test.ts` (рамка, fit+центр з рівними полями, maxZoom, minZoom+стеження з клампом країв), `use-board-camera.test.ts`. Розібрано `inventory-drag` (equip → назад): це **не** зависання й не баг гри — CDP-пауза показала звичайний тік Pixi, long tasks лише 3, pointer-події йдуть кожні ~550 мс; тест просто не вкладається в локальний таймаут 30 с (на базовому коміті вже 28,3 с, тепер 31,4 с), з таймаутом CI (60 с) обидва `inventory-drag` зелені. e2e: 27/28 з локальним таймаутом, 28/28 з таймаутом CI. Окремо виправлено мерехтіння при колапсі правої панелі: `renderer.resize()` очищає WebGL-буфер, а `ResizeObserver` спрацьовує вже після рендеру кадру, тож під час 260-мс анімації кожен кадр виводився порожнім (виміряно: 3/3 кадрів ресайзу порожні до правки, 0/8 після) — тепер resize, камера й `renderNow()` виконуються в одному watcher-і, а resize без зміни розміру пропускається. `apps/web` 242 тести, typecheck/lint чисті                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `map-generator-v2` |
