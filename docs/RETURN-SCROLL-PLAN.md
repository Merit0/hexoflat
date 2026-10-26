# Hexoflat — Сувій повернення: портал у кемп і назад

**Статус:** погоджено 25.10.2026. **Гілка:** `implement-hero-teleport` (вже створена від `game-dev-vite@82dd822`; жодна фаза не створює гілок). Одна фаза — один чат Claude Code. Комітів Claude Code не робить.
**Спирається на:** економіку Волі (`knowledge/`), систему інструментів у руці (`hero-tool-store`, `interactions-resolver`, `action-starters-registry`), портали `ENTER` (`constructions.content.ts`), переходи між локаціями (`world-map-store.ts` `goToLocation` / `leaveCurrentLocation`), рендер (скіл `hexoflat-render`).

---

## 1. Що бачить гравець

1. Герой знайшов **Сувій повернення** (одноразовий) — лежить в інвентарі.
2. Бере сувій у руку (як сокиру чи меч) і наводить на **сусідній вільний гекс** → дія «Відкрити портал · 5 Волі».
3. Платить 5 Волі, сувій зникає, на гексі **виростає портал**: зверху кам'яна рамка-ворота, під нею повільно крутиться магічний вихор.
4. Герой наводить на портал рукою → «Увійти». Його токен плавно заїжджає на портал, **зменшується й закручується всередину** вихору.
5. Відкривається кемп. Біля **магічного кола** в кемпі стоїть другий портал, герой **виходить** із нього на сусідній гекс.
6. У кемпі Воля безкоштовна: читає Книгу, поповнює Волю, лагодить, перекладає речі.
7. Повертається:
   - **через портал кемпу** → з'являється біля свого порталу там, звідки пішов. Обидва портали **згасають** (вихор стискається й зникає);
   - **через звичайні ворота кемпу** (або будь-який інший перехід) → обидва портали зникають; дорога назад — пішки.
8. **З печери (генерованої дошки) портал веде лише в один бік:** у кемпі другого порталу немає, печера зникає, як при звичайному виході. Підказка на дії попереджає: «Портал в один бік — печера зникне».

---

## 2. Рішення

| #   | Рішення                                                                                                                                                                                       | Чому                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| R1  | Відкриває **Сувій повернення** — одноразовий предмет (`return-scroll`), витрачається при відкритті                                                                                            | Oleh: портал — цінне рішення, а не кнопка                   |
| R2  | Відкриття коштує **5 Волі** (з контенту, `willCost: 5`); вхід у портал з обох боків — 0                                                                                                       | Oleh                                                        |
| R3  | Відкривається лише на **сусідньому** гексі: земля (рельєф `ground`), без об'єкта, не вихід `>`, не в кемпі, не в бою, без іншого активного порталу героя                                      | один гекс поруч — як усі дії рукою; кемп і так безкоштовний |
| R4  | Пара порталів існує, доки герой не зробить **будь-який інший перехід між локаціями** (ворота кемпу, портал печери, вихід атласу, смерть). Повернення через портал кемпу **теж закриває пару** | Oleh: одна поїздка туди й назад за 5 Волі                   |
| R5  | З **DUNGEON-дошки** портал односторонній: у кемпі пари немає, печера викидається за звичайним правилом (B4); таймер запечатування `respawnAfterClearedMs` працює як при звичайному виході     | Oleh                                                        |
| R6  | Портал кемпу завжди з'являється в **одному місці** — гекс «магічне коло» з контенту кемпу (`CAMP_PORTAL_SPOT`); герой — на вільному сусідньому                                                | передбачувано; фізично — намальоване коло на дошці кемпу    |
| R7  | Стан пари — у герої: `portal: { originLocationKey, originMapId, originHex, campHex } \| null`; зберігається разом із героєм; об'єкти `return-portal` — на дошках як звичайні тайли            | одна правда на героя; переживає reload                      |
| R8  | Ціль порталу **не задана типом об'єкта** (виняток із B6): `enter: { type: 'PORTAL' }`, ціль береться з `hero.portal`                                                                          | інакше портал не знає, куди вести назад                     |
| R9  | Усе через команди engine: `OPEN_PORTAL`, `ENTER_PORTAL`, закриття — подія при переході                                                                                                        | правило №1 `CLAUDE.md`                                      |
| R10 | Кооп: портал належить герою, який його відкрив; інші бачать його, але «Увійти» для них недоступне з причиною «Чужий портал»                                                                   | без складної спільної логіки на старті                      |
| R11 | `willCost` у схемі контенту: максимум піднімається з 3 до **5**                                                                                                                               | ціна порталу; оновити згадку в `CLAUDE.md`                  |

**Фізична гра:** сувій — карта, 5 жетонів Волі в банк; портал — два жетони-диски: один кладеш на гекс, другий — на коло в кемпі. Повернувся або пройшов іншими воротами — обидва жетони знімаєш.

---

## 3. Вигляд і анімація

**Гекс порталу — два шари** (у `render/`, окремий шар над тайлом, під героєм):

| Шар     | Що                                                                    | Поведінка                                                                                                                      |
| ------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| нижній  | **вихор** — диск зі спіраллю (`portal-runes-vortex.png`)              | безперервне обертання, ~1 оберт за 8 с, легка пульсація прозорості 0.85↔1 за 2 с; масштаб 1.0 (краї диска ховає кільце зверху) |
| верхній | **руни** — кільце з рунами, порожній центр (`portal-runes-frame.png`) | статичне; рішення Oleh 25.10.2026: руни над вихором                                                                            |

**Анімації** (тривалості — у контенті/константах, не в коді логіки):

| Подія         | Що відбувається                                                                                       | Тривалість |
| ------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| відкриття     | вихор і рамка ростуть із 0 до 1, вихор розкручується швидше й сповільнюється                          | 500 мс     |
| вхід героя    | токен героя їде в центр порталу, масштаб 1→0.15, поворот 360°, прозорість →0; потім перемикання дошки | 650 мс     |
| вихід у кемпі | портал уже стоїть; токен героя з'являється з центру порталу (0.15→1) і стає на сусідній гекс          | 500 мс     |
| згасання пари | вихор стискається до 0 і зникає, рамка тьмяніє й зникає                                               | 350 мс     |

Анімації — лише показ; рішення й стан змінює engine до/після них. Під час анімації вводу немає.

**Арт** (поки немає — заглушки: рамка — сірий кільцевий спрайт, вихор — радіальний градієнт зі спіраллю PixiJS-графікою). Промпти — §6.

---

## 4. Контент

| Ключ               | Група                                   | Поля                                                                                                                      |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `return-scroll`    | `LOOT` (стек до 50) + тримається в руці | `title: 'Return Scroll'`, `subtitle: 'Opens a portal home'`, дія `OPEN_PORTAL` з `willCost: 5`, теги `['portal', 'rare']` |
| `return-portal`    | `CONSTRUCTION`, `SOLID`                 | дія `ENTER` (рука, `willCost: 0`), `enter: { type: 'PORTAL' }`, `alwaysVisible: true`, теги `['portal']`                  |
| `CAMP_PORTAL_SPOT` | контент кемпу                           | координата магічного кола в `camping` (вільний гекс біля вогнища)                                                         |

**Звідки сувої:** 1 сувій лежить у кемпі на старті (для першого знайомства), далі — скриня в печері з шансом (таблиця здобичі скрині). Числа — контент.

---

## 5. Фази

| Фаза               | Що                                                                                                                                                                                                                                                                                | Межі                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **T1 — Engine**    | контент `return-scroll`, `return-portal`; `willCost` ≤ 5; стан `hero.portal`; команди `OPEN_PORTAL`, `ENTER_PORTAL`; правило закриття при будь-якому іншому переході; DUNGEON — односторонній; події `PORTAL_OPENED / PORTAL_ENTERED / PORTAL_CLOSED`; тести на всі правила R3–R5 | лише `packages/engine` |
| **T2 — Гра**       | сувій у руку; дія на сусідньому гексі з причинами відмови; `ENTER` порталу → кемп, `CAMP_PORTAL_SPOT`; повернення; закриття в `goToLocation`; збереження й reload; сувій у кемпі й у таблиці скрині                                                                               | `apps/web` + дані      |
| **T3 — Вигляд**    | шар порталу (вихор знизу, руни зверху), анімації відкриття / входу / виходу / згасання                                                                                                                                                                                            | `apps/web/src/render`  |
| **T4 — E2E і арт** | e2e за скілом `hexoflat-e2e`; підстановка PNG з §6                                                                                                                                                                                                                                | —                      |

### T1 — промпт

```text
Phase T1 of docs/RETURN-SCROLL-PLAN.md (hexoflat). Branch: implement-hero-teleport (already checked out; do not create branches). Do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine.
Read first: docs/RETURN-SCROLL-PLAN.md §1, §2, §4; packages/engine/src/content/constructions.content.ts (ENTER portals), content-schema.ts (willCost, enter), knowledge/ (spendWill, WILL_REJECTED), commands/apply-command.ts (CROSS_EXIT as the pattern for a location-changing command).

1. Content: HEXOBJECT_KEYS RETURN_SCROLL ('return-scroll'), RETURN_PORTAL ('return-portal'); content entries per §4. content-schema: willCost max 3 → 5; enter schema gains { type: 'PORTAL' }. Update the willCost sentence in CLAUDE.md (0..3 → 0..5) and add one sentence there pointing to docs/RETURN-SCROLL-PLAN.md (phases T1–T4).
2. Hero state: portal: { originLocationKey, originMapId, originHex, campHex } | null, Zod-validated, serialized with the hero (additive; old saves = null).
3. OPEN_PORTAL { heroId, target }: validates R3 (adjacent, ground terrain, no object, not an exit hex, location != camping, not in combat, hero.portal === null, hero has a return-scroll); spends willCost from content atomically (insufficient → WILL_REJECTED, nothing changes); consumes one scroll; places return-portal on target; sets hero.portal (campHex = CAMP_PORTAL_SPOT, or null when the origin board is DUNGEON — one-way). Every rejection has its own reason code.
4. ENTER_PORTAL { heroId }: adjacent to a return-portal owned by the hero; from origin → destination camping (arrival beside campHex if set); from camping → destination origin (arrival beside originHex) and closes the pair. Emits PORTAL_ENTERED with destination; PORTAL_CLOSED { reason } when closing.
5. A pure rule closePortalOnTransition(hero, transition): any location change that is not ENTER_PORTAL of this pair closes it (reason: OTHER_GATE / DEATH). Removing the portal objects from both maps is part of the event payload (the web layer applies it to stored maps).
6. Tests (one per rule, id in the name): R3 each refusal, R2 cost and zero-cost entry, R4 return closes, R4 other gate closes, R5 dungeon one-way, R10 other hero cannot enter, persistence round-trip.
Acceptance: engine build/lint/typecheck/test green; no web changes.
At the end append a row to a journal section at the bottom of docs/RETURN-SCROLL-PLAN.md and stop.
```

### T2 — промпт

```text
Phase T2 of docs/RETURN-SCROLL-PLAN.md (hexoflat). Branch: implement-hero-teleport. Do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-web-state, hexoflat-engine.
Read first: plan §1–§4 and the T1 journal row (its decisions are binding); packages/engine/src/portal/ (apply-portal.ts, portal-rules.ts), content/boards/camp-portal-spot.ts, abstraction/abstract-action.ts (IInventoryPort); apps/web/src/stores/hero-tool-store.ts, composables/use-hex-board-input.ts (hand slot), game-resolvers/interactions-resolver.ts, registry/action-starters-registry.ts (ENTER), stores/world-map-store.ts (goToLocation, leaveCurrentLocation, respawnHeroAtCamping), services/world/hero-placement.ts, stores/hero-inventory-store.ts.

Contract from T1 (do not change the engine API unless something is impossible — then stop and report):
- web fills state.location { locationKey, mapId, boardKind } for every command it sends;
- web passes inventory.countItem / inventory.takeFromInventory (hero-inventory-store) — without them the engine answers NO_SCROLL;
- the scroll price is actions.USE.willCost of return-scroll (5); entering a portal costs 0;
- on arrival in camping the web places the camp return-portal on CAMP_PORTAL_SPOT (8:8) itself; if 8:8 is occupied (a dropped item, another hero), use the nearest free ground hex to it and store that hex as campHex;
- PORTAL_CLOSED { reason, remove[] }: the web removes those objects from the current map AND from stored maps (mapId-indexed saves).

1. The scroll can be taken into the active hand from the inventory (extend THeroToolKey / hand slot minimally; it stays a stackable loot item in the inventory).
2. With the scroll in hand, hovering an adjacent hex resolves "Open portal · 5 Will" when OPEN_PORTAL would succeed; otherwise the hint shows the engine's refusal reason in words. On a DUNGEON board the label adds "one-way — the cave will be lost".
3. return-portal ENTER (hand) → ENTER_PORTAL → the existing goToLocation flow. Arrival in camping: camp portal on 8:8, hero on a free neighbour. Return: hero beside the origin portal, both portals removed (PORTAL_CLOSED).
4. Every other transition already emits PORTAL_CLOSED for CROSS_EXIT and WORLD ENTER — wire the web side to apply it; respawnHeroAtCamping calls closePortalOnTransition with DEATH and applies the result.
5. Content: one return-scroll placed in the camping drawing on a free hex (keep 8:8 free); the chest loot table gets return-scroll with a chance (content value).
6. Reload keeps hero.portal, both portal objects and positions; a dungeon origin never leaves a camp portal.
Acceptance: unit tests for the web wiring; manual check in the browser of the full loop (silesia → camp → back; silesia → camp → homeland gate; cave → camp one-way); workspace build/lint/typecheck/test green incl. existing e2e.
At the end append a journal row and stop.
```

### T3 — промпт

```text
Phase T3 of docs/RETURN-SCROLL-PLAN.md (hexoflat). Branch: implement-hero-teleport. Do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-render.
Read first: plan §3, journal; apps/web/src/render (layers, dirty-tile flush, board camera).

1. A portal layer: for every tile with return-portal draw two sprites — vortex (below, scale 1.0, rotating continuously ~1 turn / 8 s, alpha pulse 0.85–1 / 2 s) and runes frame (above, static). Art is ready in hex-constructs/hero-portal/: portal-runes-vortex.png and portal-runes-frame.png (512x512 RGBA); sprite URLs are constants.
2. Animations per §3 table (open 500 ms, hero enter 650 ms, hero exit 500 ms, pair fade 350 ms); durations in one constants file; input is locked while they play; engine state changes are not delayed by visuals except the board switch waits for the enter animation.
3. Animation ticker only runs while a portal is on screen.
Acceptance: render unit tests (layer draws both sprites, ticker stops without portals); manual check in browser; workspace green.
At the end append a journal row and stop.
```

### T4 — промпт

```text
Phase T4 of docs/RETURN-SCROLL-PLAN.md (hexoflat). Branch: implement-hero-teleport. Do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-e2e.
1. E2E (Feature classes only, no locators in specs): pick up the camp scroll → go to silesia → open portal (Will −5, scroll gone) → enter → in camping beside the circle → return through the portal → beside the origin portal, both portals gone. Second spec: open portal, return to camping through it, leave through the homeland gate → no portal anywhere. Third: from the cave → camping, no camp portal.
2. Hex-portal art is already in place (portal-runes-frame.png, portal-runes-vortex.png). Scroll art: hex-loot/return-scroll-token-image.png (still placeholder map-token-image.png).
At the end append a journal row and stop.
```

---

## 6. Промпти для арту

Стиль — як наявні токени гри: мальовані, м'яке світло, чіткий контур, вид строго зверху, прозорий фон, квадрат 512×512, об'єкт вписаний у шестикутник із невеликим полем. Жодного тексту.

**Рамка-ворота (верхній шар):**

```
Game asset for a top-down hex board game, transparent background PNG, 512x512, strictly top-down view.
A circular portal gate frame made of weathered grey stone blocks with a few glowing teal rune carvings, like a stone ring set into the ground. The CENTER IS EMPTY and fully transparent (a clean round hole, about 60% of the diameter). Hand-painted cartoon fantasy style matching chunky board-game tokens: bold dark outline, soft top-left light, subtle texture. Fits inside a pointy-top hexagon with a small margin. No text, no background, no shadow outside the ring.
```

**Вихор (нижній шар, крутиться в коді):**

```
Game asset for a top-down hex board game, transparent background PNG, 512x512, strictly top-down view.
A round magical vortex disc: a swirling spiral of deep violet and teal energy with bright cyan streaks, darker toward the center like a funnel, a few tiny sparkles. Rotationally balanced so it looks good when spun around its center. Soft edges fading to transparent at the rim. Hand-painted cartoon fantasy style, no outline, no text, no frame, no background.
```

**Сувій повернення (токен предмета):**

```
Game item token for a top-down hex board game, transparent background PNG, 512x512.
A rolled parchment scroll tied with a violet ribbon, a small glowing teal portal-rune seal on it, slightly tilted. Hand-painted cartoon fantasy style matching chunky board-game potion and chest tokens: bold dark outline, warm parchment colors, soft top-left light. Fits inside a pointy-top hexagon. No text, no background.
```

**(Необов'язково) Магічне коло в кемпі** — декор під місцем порталу:

```
Top-down hex board game floor decal, transparent background PNG, 512x512.
A faint circle of small flat stones with dim teal runes carved in the ground between them, empty center, worn and subtle so a portal can stand on top. Hand-painted cartoon fantasy style, no text, no background.
```

---

## 7. Журнал

| Дата       | Фаза            | Результат                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25.10.2026 | —               | План створено                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 25.10.2026 | T1 [DONE]       | Engine: `return-scroll` / `return-portal` у контенті (`willCost` ≤ 5, `enter: { type: 'PORTAL' }`), `hero.portal` (Zod `portalLinkSchema`, additive — старі збереження = немає порталу), команди `OPEN_PORTAL` / `ENTER_PORTAL` (`portal/apply-portal.ts`, правила в `portal/portal-rules.ts`), подія `PORTAL_CLOSED { reason, remove[] }` при `CROSS_EXIT` та `ENTER` воріт `WORLD`, чиста `closePortalOnTransition` (є `DEATH` для web), `CAMP_PORTAL_SPOT = 8:8` (`content/boards/camp-portal-spot.ts`). Рішення для T2: (1) engine бере поточну локацію зі `state.location { locationKey, mapId, boardKind }` — web має її заповнювати; (2) сувій перевіряється/знімається через **опційні** `inventory.countItem` / `inventory.takeFromInventory` у `IInventoryPort` (без них — `NO_SCROLL`); (3) ціна 5 Волі читається з `actions.USE.willCost` скрол-контенту (нового `EHexActionType` не додавали, щоб не ламати реєстри); (4) спрайти — заглушки (`map-token-image.png`, `camping-door-hex.png`); (5) web має сам поставити camp-портал на `CAMP_PORTAL_SPOT` при прибутті та застосувати `remove[]` до збережених мап; (6) `willCost` max 3→5 — тест `will-economy` оновлено (невалідне тепер 6). CONTENT_VERSION не змінювали. Engine build/lint/typecheck/test зелені (525 тестів), `apps/web` typecheck зелений; web не змінювали. Не закомічено.                                                                                                                                                                                      |
| 25.10.2026 | T2 [DONE]       | Web: `usePortal` (`composables/use-portal.ts`) — `previewOpen` / `openPortal` / `enterPortal`; сувій береться в руку з інвентаря як зброя/щит (`THeroToolKey` += `return-scroll`, кнопка USE на токені в руці, колесо миші); `tool-hex-tile.vue` показує «Відкрити портал · −5 Волі», причину відмови словами (`portal-refusal-hint`) і «в один бік» для DUNGEON (`portal-one-way-hint`); `return-portal` ENTER → `ENTER_PORTAL` → `goToLocation`; у кемпі портал на `CAMP_PORTAL_SPOT` або на найближчому вільному гексі (`campHex` оновлюється), герой поруч; повернення знімає обидва портали. `hero.portal` живе в `hero-store` (зберігається в `heroProgress`). Закриття пари: `hero-store.applyPortalClosures` (ENTER воріт `WORLD` через `startHexAction`, `CROSS_EXIT`) і `closePortalOnDeath` (з `respawnHeroAtCamping`); видалення об'єктів у поточній мапі й у збережених (`updateSavedMap`). Камп-малюнок: 1 сувій на 7:7 (8:8 вільний). `countItem` / `takeFromInventory` у `hero-inventory-store`. **Скрині: таблиці здобичі в коді немає** (відкриття скрині нічого не видає) — пункт 5 про скриню НЕ зроблено, потрібне рішення. Тести: `use-portal.test.ts` (повний цикл, зайнятий камп-гекс, смерть, CROSS_EXIT, DUNGEON в один бік), `portal-service.test.ts`, `hero-inventory-store.test.ts`, `world-storage.test.ts`. Workspace lint/typecheck/build/test зелені, e2e 47/47. Ручної перевірки в браузері не робив (правило «без ручного UI-тестування»); UI-гілки `tool-hex-tile.vue` не покриті жодним тестом. Не закомічено. |
| 25.10.2026 | арт             | Oleh додав `hero-portal/portal-runes-frame.png` і `portal-runes-vortex.png` (справжні PNG 512×512 RGBA, 173 і 232 КБ, прозорі кути, центри ≈ 255). Перевірено. Порядок шарів (Oleh): вихор знизу, руни зверху.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 25.10.2026 | T3 [DONE]       | Render: `render/layers/portal-layer.ts` (на кожен `return-portal` вихор знизу — обертання 8 с, пульсація 0.85–1 за 2 с, масштаб 1.0 — і руни зверху; відкриття 500 мс, згасання 350 мс; на новій дошці портали з'являються без анімації; Ticker працює лише поки є портал), `render/tween.ts`, `render/portal-fx.ts` (міст use-portal ↔ шар: `playPortalEnter/Exit`, `portalFxBusy` блокує рух героя і повторне відкриття/вхід), `render/portal-fx-config.ts` (усі тривалості й URL). `hero-layer`: тіло героя в окремому контейнері, `playPortalEnter` (650 мс: їде в центр, 1→0.15, оберт 360°, зникає, лишається прихованим) і `playPortalExit` (500 мс). `use-portal.enterPortal`: анімація входу → перемикання дошки → вихід. `tiles-layer` не малює спрайт `return-portal` (малює шар порталу). Спрайт `return-portal` у контенті = `portal-runes-frame.png`. Тести: portal-layer, hero-layer, tween, portal-fx. Workspace lint/typecheck/build/test зелені, e2e 47/47. Візуально в браузері не перевіряв (правило «без ручного UI-тестування»). Не закомічено.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 25.10.2026 | T4 [DONE]       | E2E (`e2e/world/return-portal.spec.ts`, `VerifyReturnPortalFeature`): (1) сувій із кемпу → silesia → відкриття порталу (Воля −5, сувій зник, портал на дошці) → вхід → кемп поруч із порталом на колі → повернення → герой поруч із початковим порталом, обох порталів нема (перевірено й після переходу в кемп); (2) відкрити, зайти в кемп, вийти воротами кемпу → порталів нема ніде; (3) печера: підказка «в один бік», вхід у портал → кемп без порталу. Тест-API розширено: `getCurrentLocationKey`, `findTilesWithKey`, `getInventoryItemAmount`, `previewPortalOpening` (питає застосунок, правила не дублюються). Арт підставлено ще в T3 (`portal-runes-frame.png`, `portal-runes-vortex.png`). Також `enterPortal` тепер зупиняє інструмент при вході (як ENTER воріт). Workspace lint/typecheck/build/test зелені, e2e 50/50. Арт сувою підставлено: `hex-loot/teleport-scroll-token.png`. Не закомічено.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 25.10.2026 | правки UI       | Сувій: єдина дія `USE`, портал: єдина дія `OPEN` (контент `return-portal` — `OPEN` замість `ENTER`). З інструмента прибрано всі підписи вартості Волі та підказки-чипи; відмови йдуть повідомленням (банер): нестача Волі — при натисканні, «в один бік» — після відкриття з печери. Сувій при вільному гексі показує `USE`, інакше лише `-`. Сувій безлімітний (видається на старті, не витрачається). Виправлено помилку `loadFromStorage` (світовий тік зберігав карту зі старим дескриптором/позицією попередньої локації → кемп перебудовувався й портал зникав). Тести не запускались за проханням; e2e оновлено під відсутність чипів.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 26.10.2026 | правки за рев'ю | `return-portal`: дія знову `ENTER` (напис «Open»). Сувій одноразовий: безліміт прибрано, сувій із кемпу прибрано; новий інвентар отримує 50 сувоїв один раз (debug), решта — згодом дроп/магазин/скриня. Аварійне повернення в кемп (20 питань Книги Волі) видалено з рушія, UI, перекладів і e2e: у кемп тепер лише через сувій (і смерть). Збережена «return»-сесія при читанні скидається. Прибрано невикористані імпорти. Скрині: таблиці здобичі досі нема.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
