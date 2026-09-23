# Переорієнтація гекс-сітки: flat-top → pointy-top

**Гілка:** `hex-pointy-top-orientation` (від `hero-token-concept-check`).
**Скоуп:** орієнтація гекса (рендер) + offset-система координат (odd-q → odd-r).
`packages/engine` (геометрія) + `apps/web` (силует, розмір тайла, дошка спорядження).
Без нових залежностей, без зміни командного пайплайну.

## Навіщо

Новий токен героя (`frank-hex.png`) намальований pointy-top (вершина вгорі/внизу).
Уся гра до цього — flat-top. Зводимо до однієї орієнтації — pointy-top.

**Важливо:** орієнтація — це виключно рендер. Ігрова логіка (пошук шляху, туман/видимість,
зони ворогів, суміжність, відстань) працює на абстрактній гекс-топології через axial/cube
і **не залежить** від того, pointy чи flat. Усі 178 engine-тестів пройшли без змін.

## Що змінилось

### Двигун — `packages/engine/src/utils/hex-utils.ts`

| Було (flat-top, odd-q)                                            | Стало (pointy-top, odd-r)                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `oddQToAxial` / `axialToOddQ`                                     | `offsetToAxial` / `axialToOffset` (odd-r формули)                      |
| `getOddQNeighbors`                                                | `getHexNeighbors` (перейменовано в усіх файлах, поведінка нова)        |
| `calcHexPixelPosition`: `x = w*0.75*col; y = h*(row + col%2*0.5)` | `x = w*(col + row%2*0.5); y = h*0.75*row`                              |
| `hexDistance`                                                     | без змін по суті — та сама cube-відстань поверх нового `offsetToAxial` |

`AXIAL_DIRS` не змінюються — 6 напрямків у axial однакові для будь-якої орієнтації.
Нове: `hex-utils.test.ts` — 15 тестів, пінить нову геометрію вручну звіреними значеннями.

### Веб

- `apps/web/src/assets/global.css`:
  - `--hex-clip-path` → `polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)`
  - `--hex-tile-height` — довга вісь (vertex-to-vertex) = стара flat-top `--hex-tile-width`
    (`4.4vw`), тобто розмір гекса на екрані незмінний; `--hex-tile-width` = `height * 0.866`.
- `apps/web/src/render/hex-geometry.ts` — `buildHexPolygon` → pointy-top вершини. Це єдина
  зміна рендера; шари (`tiles-layer`, `hero-layer`, …) не чіпали — вони викликають
  `calcHexPixelPosition` + маску й успадкували нову геометрію (природний `applyCoverFit` +
  hex-маска, як було).
- `apps/web/src/composables/use-hex-board-sizing.ts` — прибрано per-map scale-to-fit.
  `scale` фіксований `1:1` → кожна гекс-цела рендериться рівно у CSS-розмірі на **будь-якій**
  карті (гекс однаковий у camping і Silesia). Карта більша за pane — обрізається по центру;
  розмір карти (кількість рядів/колонок) підбирається так, щоб влізла.
- `apps/web/.../hero-equip-board.vue` — 7-гекс «квітка»: 6 слотів = 6 справжніх pointy-top
  сусідів центру, позиція через `calcHexPixelPosition` з реальним боксом гекса
  (`HEX_W = HEX_H * 0.866`), `clip-path: var(--hex-clip-path)`. Та сама математика, що й мапа.
- `hero-layer.ts` — `HERO_SPRITE_URL` → `/hero-asssets/frank-hex.png`.

### Контент

- `hex-map-provider.ts` / `map-tiles-schema-provider.ts` — Silesia (homeland) `27×11 → 17×15`,
  координати об'єктів у `homelandMapConfig` зсунуто, щоб влізли й мали порожній бортик.
  Усі об'єкти на місці.

## Статус

- [x] `pnpm lint` (0 errors), `pnpm typecheck`, `pnpm test` (engine 178 / web 204 / api 63)
- [x] `pnpm --filter @hexoflat/web build`
- [ ] **e2e** (`apps/playwright/e2e/world/*`) — прогнати проти цієї збірки

## Далі (окремі задачі)

1. **Перемалювати спрайти з гекс-рамкою.** `camping`, `cave-entrance`, `fireplace`,
   `map-token`, `wood-and-leaves`, `empty-hex-image`, `token-placement-image`, `fog-tile`,
   інструменти (`hand`/`axe`/`pickaxe`), спорядження (`shield`/`guard-sword`) — намальовані
   flat-top, під pointy-маскою ріжуться по лівій/правій вершині. Треба pointy-top-native
   (рамка pointy, вміст вертикальний). Спрайти НЕ повертали програмно — 90° клало б вміст
   набік. Кругові/восьмикутні/ромбові медальйони (еліксири, вороги, `rock`, `tree`) —
   орієнтації не мають, не чіпати.
2. **Axial у двигуні.** `docs/EXPLORATION-SLICE-WORKFLOW.md` §3 фіксує odd-q-vs-axial як
   конфлікт. Зараз engine усередині вже працює через axial, але представлення — offset
   (odd-r). Правильна ціль: engine говорить **чистим axial**, offset лишається тільки на
   межі рендера. Тоді двигун не залежить від орієнтації силуету взагалі. Окремий рефактор
   (окремий чат, characterization-тести спершу).
3. **Camping-карта.** Її `campingMapConfig` авторили під flat-top вигляд — під odd-r
   лівий/правий бортик зигзагує на пів-цели (нормально для offset-сітки, але якщо треба
   рівний край — переавторити координати).
4. **Збережені ігри.** `CONTENT_VERSION` не піднімали (координати ті самі
   `{columnIndex, rowIndex}`, десеріалізація не ламається). Але топологія сусідства на старій
   збереженій карті зміниться. Для дев-збережень прийнятно; чиста міграція = bump
   `CONTENT_VERSION` (вайпне всі збереження) окремим рішенням.
