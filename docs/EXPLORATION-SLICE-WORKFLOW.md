# Hexoflat — Exploration Vertical Slice: воркфлов виконання

**Статус:** активний план виконання. Замінює `docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md`.
**Дата:** 14.08.2026
**Дизайн-канон:** `docs/design/exploration-v0.1/00-exploration-vertical-slice-final-v0.1.md`

---

## 0. Що це і чим воно не є

Дизайн уже написаний і заморожений. У `docs/design/exploration-v0.1/` лежать 15 файлів по 8 темах (~18 300 рядків), включно з Final-слайсом, який містить власний «Section 41 — Exact Incremental Implementation Order» на 61 крок.

**Цей файл не переписує дизайн.** Він робить три речі, яких у дизайн-документах немає й не може бути:

1. **Перекладає 61 абстрактний крок на реальний репозиторій** — конкретні пакети, файли, межі `packages/engine` ↔ `apps/web`, ESLint-ратчет, e2e-хук, формат збережень.
2. **Фіксує розходження між документом і кодом** — їх сім, і три з них зупинили б роботу на першій же годині, якби їх виявили в процесі.
3. **Розбиває роботу на фази-чати за конвенцією репозиторію** (`.claude/skills/hexoflat-phase`) і вставляє три грабельні зрізи, щоб Stop Gate працював за призначенням, а не спрацював один раз у самому кінці.

Дизайн-документи лишаються джерелом правди щодо **що** і **чому**. Цей файл — джерело правди щодо **в якому порядку, в яких файлах і коли грати**.

---

## 1. Джерела

| Файл                                                                       | Роль                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docs/design/exploration-v0.1/00-exploration-vertical-slice-final-v0.1.md` | **Канон слайсу.** Фікстура, контракти, команди, події, тести, гейти плейтесту                    |
| `docs/design/exploration-v0.1/01-mechanic-development-stop-gate.md`        | Правило зупинки розширення дизайну. Керує §4 і §6 цього файлу                                    |
| `10-frontier-exploration-and-resource-ecology-candidate.md`                | Кандидат: фронтир, ecology, сходинки Scout                                                       |
| `11-region-grammar-generator-*`                                            | Кандидат + спека: процедурна генерація регіонів. **Поза слайсом**, підключається після Stop Gate |
| `12-resource-ecology-and-discovery-rewards-*`                              | Кандидат + спека: ресурси. Слайс бере вузький зріз                                               |
| `13-world-pulse-and-living-world-director-*`                               | Кандидат + спека: World Pulse. Слайс бере один сигнал і один патруль                             |
| `14-landmarks-traces-and-mystery-weave-*`                                  | Кандидат + спека: знання. Слайс бере одну загадку                                                |
| `15-known-world-travel-and-expedition-planning-*`                          | Кандидат + спека: відомі маршрути. Слайс бере STRIDE + VEIL                                      |
| `16-expedition-risk-return-and-camp-consequence-*`                         | Кандидат + спека: повернення й наслідки в кемпі                                                  |

> Дубль `Hexoflat_Frontier_..._v0.1 (1).md` побайтово ідентичний оригіналу — не скопійований.

---

## 2. Ухвалені рішення (14.08.2026)

| #   | Питання                                                          | Рішення                                                                                                                   | Наслідок                            |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| D1  | Фікстура задана в axial pointy-top, репо — odd-q offset flat-top | **Адаптер.** Фікстура зберігається в odd-q, канонічних для проєкту                                                        | §3.1, фаза E1                       |
| D2  | Доля `docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md`                      | **Замінено цим файлом.** Живі частини (A0 seeded RNG, спліт-скрін, контент-таксономія) втягнуті у фази E0/E1              | Старий файл позначається SUPERSEDED |
| D3  | 61 крок до першого плейтесту                                     | **Три грабельні зрізи** PLAY-1 / PLAY-2 / PLAY-3                                                                          | §4                                  |
| D4  | Кооп у слайсі                                                    | **Слайс = соло.** Фіча-флаг вимкнений у мультиплеєрних сесіях; команди все одно проєктуються actor-scoped та ідемпотентні | §3.6, фаза E0                       |

---

## 3. Розходження між дизайном і репозиторієм

Дизайн-документ у §4 стверджує, що переліковані примітиви «вже працюють». Здебільшого це правда — але не буквально. Нижче те, що реально розходиться. Кожен пункт має рішення; без них Claude Code упреться в них по одному й почне імпровізувати.

### 3.1 Система координат — розв'язано

Документ: axial pointy-top `{q, r}`, сусіди `E(+1,0) NE(+1,-1) NW(0,-1) W(-1,0) SW(-1,+1) SE(0,+1)`.
Репозиторій: odd-q offset flat-top `{columnIndex, rowIndex}`, `packages/engine/src/utils/hex-utils.ts`.

**Гарна новина:** `AXIAL_DIRS` у репо — рівно ті самі шість напрямків. Топологія збігається один-в-один; різниця лише в тому, що репо рендерить flat-top, а документ описує pointy-top. Тобто **сусідство зберігається точно**, змінюються лише візуальні назви румбів (поворот на 30°).

Базова сітка генерується від `(0,0)` і не тримає від'ємних координат (`world-generator.ts:buildBaseGrid`), тому фікстура зсувається в axial-просторі на `dq = +2, dr = 0` — цей зсув жорсткий і перевірений на збереження сусідства.

**Канонічна фікстура в odd-q** (це та таблиця, яку треба закодувати; axial-колонка лишена для звірки з документом):

| ID                          | Документ (q,r) | **Репо (col,row)** | Регіон    | Терен       | Прохідність          | Початкове відкриття   |
| --------------------------- | -------------- | ------------------ | --------- | ----------- | -------------------- | --------------------- |
| `camp_world_anchor`         | (0,0)          | **(2,1)**          | CAMP_RING | GROUND/CAMP | OPEN                 | UNDERSTOOD            |
| `world_exit_spawn`          | (1,0)          | **(3,1)**          | CAMP_RING | GROUND      | OPEN                 | DISCOVERED            |
| `old_marked_ridge`          | (1,-1)         | **(3,0)**          | CAMP_RING | STONE_MASS  | BLOCKED              | DISCOVERED            |
| `camp_nw`                   | (0,-1)         | **(2,0)**          | CAMP_RING | GROUND      | OPEN                 | DISCOVERED            |
| `camp_w`                    | (-1,0)         | **(1,0)**          | CAMP_RING | GROUND      | OPEN                 | DISCOVERED            |
| `camp_sw`                   | (-1,1)         | **(1,1)**          | CAMP_RING | GROUND      | OPEN                 | DISCOVERED            |
| `camp_se`                   | (0,1)          | **(2,2)**          | CAMP_RING | GROUND      | OPEN                 | DISCOVERED            |
| `camp_e_south`              | (1,1)          | **(3,2)**          | CAMP_RING | GROUND      | OPEN                 | OBSERVED              |
| `ridge_junction`            | (2,0)          | **(4,2)**          | REGION_A  | GROUND      | OPEN                 | OBSERVED після виходу |
| `north_approach_1`          | (2,-1)         | **(4,1)**          | REGION_A  | GROUND      | OPEN                 | UNKNOWN               |
| `ruin_shelter`              | (3,-1)         | **(5,1)**          | REGION_A  | RUIN        | OPEN                 | UNKNOWN               |
| `medicinal_habitat`         | (3,-2)         | **(5,0)**          | REGION_A  | VEGETATION  | OPEN                 | UNKNOWN               |
| `north_approach_2`          | (4,-1)         | **(6,2)**          | REGION_A  | GROUND      | OPEN                 | UNKNOWN               |
| `stone_crust_shortcut`      | (3,0)          | **(5,2)**          | REGION_A  | STONE_CRUST | DESTRUCTIBLE/BLOCKED | OBSERVED з junction   |
| `route_merge`               | (4,0)          | **(6,3)**          | REGION_A  | GROUND      | OPEN                 | UNKNOWN               |
| `frontier_gate_a_b`         | (5,0)          | **(7,3)**          | REGION_A  | GROUND      | OPEN                 | UNKNOWN               |
| `patrol_investigation_lane` | (3,1)          | **(5,3)**          | REGION_A  | GROUND      | OPEN                 | UNKNOWN               |
| `patrol_p3`                 | (4,1)          | **(6,4)**          | REGION_A  | GROUND      | OPEN                 | UNKNOWN               |
| `patrol_p0`                 | (4,2)          | **(6,5)**          | REGION_A  | GROUND      | OPEN                 | UNKNOWN               |
| `patrol_p1`                 | (5,2)          | **(7,5)**          | REGION_A  | GROUND      | OPEN                 | UNKNOWN               |
| `patrol_p2`                 | (5,1)          | **(7,4)**          | REGION_A  | GROUND      | OPEN                 | UNKNOWN               |
| `spire_approach`            | (6,0)          | **(8,4)**          | REGION_B  | GROUND      | OPEN                 | UNKNOWN               |
| `trace_marked_seam`         | (6,-1)         | **(8,3)**          | REGION_B  | RUIN        | OPEN                 | UNKNOWN               |
| `trace_broken_pickaxe`      | (7,-1)         | **(9,3)**          | REGION_B  | RUIN        | OPEN                 | UNKNOWN               |
| `broken_spire`              | (7,0)          | **(9,4)**          | REGION_B  | RUIN        | BLOCKED (структура)  | UNKNOWN               |
| `trace_rope_anchor`         | (8,-1)         | **(10,4)**         | REGION_B  | RUIN        | OPEN                 | UNKNOWN               |
| `frontier_exit`             | (8,0)          | **(10,5)**         | REGION_B  | GROUND      | OPEN                 | OBSERVED після Spire  |

Мінімальна технічна сітка: **11 × 6**. Рекомендовано генерувати ширшу (наприклад 14 × 9) — надлишок ніколи не рендериться, бо лишається `UNKNOWN`, зате дає простір для «органічної» межі без упирання в край масиву.

Формула зсуву для тесту-звірки:

```ts
// axial (документ) → odd-q (репо)
const DQ = 2,
  DR = 0;
const col = q + DQ;
const row = r + DR + (col - (col & 1)) / 2;
```

**Обов'язковий тест фікстури:** прогнати таблицю документа через цю формулу й перевірити, що для кожної пари сусідів у axial-просторі `getOddQNeighbors` дає ту саму пару в odd-q. Це страхує від тихого зсуву парності колонок при будь-якому майбутньому редагуванні фікстури.

### 3.2 `isRevealed: boolean` → чотиристанове відкриття

`HexTileModel` має булевий `isRevealed`; на ньому зав'язані `fog-service.ts`, `move-planner.isEnterableTile`, рендерер, збереження. Дизайн вимагає `UNKNOWN | OBSERVED | DISCOVERED | UNDERSTOOD`.

**Рішення:** у фазі E1 додати `discovery: DiscoveryState` як нове поле, а `isRevealed` лишити **похідним геттером** (`discovery !== 'UNKNOWN'`) на весь час слайсу. Так рендерер, pathfinding, e2e і збереження не ламаються одним махом, а мігрують по одному в тих фазах, де це справді потрібно. Прибирати `isRevealed` — окреме прибирання після Stop Gate, не всередині слайсу.

Формат збереження: зміна адитивна (старі payload-и без `discovery` читаються як `UNKNOWN`/`DISCOVERED` за `isRevealed`), тому `CONTENT_VERSION` **не** бампається — за тією ж логікою, що вже ухвалена для `rngState` у A0. Обидва шляхи покрити тестом.

### 3.3 Команд у рушії — п'ять, документ вимагає сімнадцять

Зараз у `packages/engine/src/commands/`: `START_HEX_ACTION`, `FINISH_PENDING_ACTIONS`, `WORLD_TICK`, `ADD_RESOURCE_SPAWNER`, `MOVE_HERO`. Немає `commandId`, немає `expectedStateVersion`, немає ідемпотентності — а документ будує на ній усі гарантії (не повторити World Pulse, не видати ресурс двічі).

**Рішення:** інфраструктура ідемпотентності — це фаза E0, до будь-якого геймплею. Інакше кожна наступна фаза додає команду з нуля й ці гарантії ніколи не з'являться.

`applyCommand` уже зараз близький до ліміту `complexity` в ESLint-ратчеті. Сімнадцять команд у одному `switch` його гарантовано пробʼють. **Рішення:** у E0 перевести диспетчеризацію на реєстр `Record<type, handler>` з характеризаційними тестами до рефакторингу (правило зі скіла `hexoflat-phase`).

### 3.4 Бій живе поза рушієм — і слайс у нього впирається

`combat-store.ts` в `apps/web` — свідомо зафіксований виняток із правила №1 (`CLAUDE.md`). Дизайн вимагає STEP 29 «detection → combat transition» і STEP 30 «post-combat exploration resume».

**Рішення для слайсу:** виявлення завершує Burst жорстко. Рушій емітить `ThreatDetectedHero`; `apps/web` ловить подію в адаптері й запускає наявний `combat-store`. Після бою Will = `DISPERSED`, Burst не відновлюється. Це найпростіше правило, яке нічого не винаходить про бій і нічого не обіцяє наперед.

**Заборонено:** імпортувати `combat-store` у `packages/engine` в будь-якій формі. Адаптер односторонній: рушій → подія → веб.

### 3.5 Наявна сходинкова прогресія Scout конфліктує з фікстурою

`scout-progression.ts` дає 10 рангів і виводить `moveSteps` із загальної кількості кроків героя. Фікстура фіксує `routeLimit = 5`.

**Рішення:** під фіча-флагом слайсу профіль `STARTER_SLICE_SCOUT` **перекриває** сходинку. Інакше герой рангує вгору посеред плейтесту й телеметрія маршрутів стає незрівнянною між сесіями. Сходинку не видаляти — вона повертається після Stop Gate, і вже як «майстерність маршруту», а не «більше гексів» (кандидат §9 у `10-frontier-...`).

### 3.6 Кооп

Документи писані під одного героя; в репо вже є WebSocket-синк руху й збору. Слайс — соло (D4), але команди все одно проєктуються з `actorId` і `commandId`, щоб кооп пришивався пізніше без переписування. Фіча-флаг слайсу вимкнений у мультиплеєрній сесії — це перевіряється тестом, а не домовленістю.

### 3.7 Пошук тайла — `O(n)` на кожен виклик

`map.tiles.find(...)` розкидано по рушію. Слайс додає World Pulse, перцепцію патруля й перевалідацію маршруту — усе це багаторазові пошуки за координатою на крок. На сітці 14×9 це неважливо, на реальній мапі — квадратично.

**Рішення:** у E0 додати в `HexMapModel` індекс `Map<string, HexTileModel>` за `coordinateKey`, з характеризаційними тестами до зміни. Дешево зараз, дорого потім.

---

## 4. Три грабельні зрізи

Stop Gate вимагає: «якщо петля вже тестована — зупинись і грай». Але 61 крок до першого запуску означає, що перший плейтест відбудеться після того, як усе побудовано — тобто рівно тоді, коли вбити механіку найдорожче.

Тому робота розрізана на три точки, де в гру **реально грають**, і кожна перевіряє свою гіпотезу власними гейтами з §47 Final-документа.

### PLAY-1 — «Маршрут і терен» (після E0–E3)

**Гіпотеза:** цікаво комітити маршрут і фізично міняти терен, ще до того, як світ уміє відповідати.

**Гейти:** A (Route Interest), C (Terrain Agency).

**Що вже грається:** вихід із кемпу, органічна межа, Burst із 5 кроками, один Act, Waypoint, переривання руху на відкритті, розбити Stone Crust киркою, постійний Broken Passage, який назавжди міняє pathfinding.

**Якщо провалюється:** не будувати World Pulse поверх. Спершу Kill → Simplify на самому Burst. Найімовірніший діагноз — Act занадто рідкісний або routeLimit не той.

### PLAY-2 — «Світ відповідає» (після E4–E5)

**Гіпотеза:** Gather Will як добровільна плата за наступний Burst створює напругу, а відповідь світу читається як причинна, а не як покарання.

**Гейти:** B (Will/Pulse Tension), D (World Response Legibility), E (Resource Relevance).

**Що додається:** медичний габітат, Hand → Take, шум від розбитого каменю, патруль, який на нього причинно реагує, бюджет відповідей, прев'ю наміру спостереженого патруля.

**Якщо провалюється:** найімовірніша причина — гравець не пов'язує свою дію з відповіддю. Це проблема Rule Trace і прев'ю, а не кількості механік. Не додавати другий тип сигналу.

### PLAY-3 — «Знання і повернення» (після E6–E8)

**Гіпотеза:** знання, здобуте зі слідів, змінює сенс уже баченого місця — і повернення власним маршрутом відчувається як заслужене, а не як зворотна дорога.

**Гейти:** F (Landmark Curiosity), G (Knowledge Progression), H (Return Mastery), I (Frayed Route Fairness).

**Що додається:** Broken Spire, три сліди, Insight «ослаблений шов», реконтекстуалізація старого хребта біля кемпу, Trail Imprint, STRIDE/VEIL, Frayed Route, повернення й Homecoming Beat.

### Фінальний Stop Gate (після E9)

Гейти J (Low UI Friction), K (No Feature Dependency) + повний прогін профілів A–F із §46. Тільки після цього — промоція кандидатів у канон (§50) і розмова про Region Grammar Generator.

---

## 5. Фази

Кожна фаза — **окремий чат**, окрема гілка, за конвенцією `.claude/skills/hexoflat-phase`. Не змішувати фази в одній розмові.

Загальні правила для всіх фаз:

- Правила гри живуть у `packages/engine`. У `apps/web` — тільки презентація, ввід і адаптери. Сумнів — скіл `hexoflat-web-state`.
- Кожна нова команда: Zod-схема, `commandId`, `expectedStateVersion`, ідемпотентність, доменні події.
- Прев'ю викликає **ту саму** функцію правил, що й виконання (інваріант I6). Це не побажання: дублювання логіки прев'ю — найдорожчий баг у цьому дизайні.
- Стан для e2e виставляється через `window.__HEXOFLAT_TEST__` (`apps/web/src/e2e/`), не через `data-testid` на кожен новий елемент. Скіл `hexoflat-e2e`.
- Ніяких числових абстракцій ризику/небезпеки в UI (інваріант I15). Кількість кроків — можна, це буквальний лік.
- Комітів не робити.

---

### E0 — Фундамент: детермінізм, ідемпотентність, реєстр команд [DONE — 17.08.2026]

**Гілка:** `exploration/e0-command-foundation`
**Передумови:** немає. Це перша фаза.
**Кроки документа:** STEP 1, 3 + втягнута Фаза A0 зі старого плану.

**Обсяг:**

1. Seeded RNG (стара Фаза A0 повністю — вона так і не зроблена, а весь слайс на ній стоїть): генератор на `utils/hash/sha256.ts`, `rngState` у `HexEngineState`, протягнути через `applyCommand`, перевести 7 наявних `defaultRandom`. `CONTENT_VERSION` не бампати.
2. `commandId` + `expectedStateVersion` + `actorId` у базі команди; журнал застосованих `commandId` у стані; повторна команда повертає попередній результат і **не** повторює жодного побічного ефекту.
3. Диспетчеризацію `applyCommand` перевести зі `switch` на реєстр `Record<type, handler>` — характеризаційні тести **до** рефакторингу.
4. Індекс тайлів `Map<coordinateKey, HexTileModel>` у `HexMapModel` (§3.7).
5. Фіча-флаг `FEATURE_EXPLORATION_SLICE`, вимкнений у мультиплеєрній сесії (§3.6).

**Приймання:** два прогони з однаковим seed дають однакову послідовність рішень AI; дубльований `commandId` не змінює стан удруге (тест на кожній наявній команді); старе збереження без `rngState` вантажиться; `CONTENT_VERSION` = 1; ESLint-ратчет не погіршився.

**Зроблено 17.08.2026** (гілка `exploration/e0-command-foundation`, `lint` / `typecheck` / `build` / unit-тести зелені, жодного порога не піднято):

- `utils/seeded-random.ts` — генератор на `sha256(seed#cursor)`; `rngState` (seed + курсор) у `HexEngineState`, прокинутий у хендлери четвертим аргументом. `commands/determinism.test.ts` доводить приймання: два прогони з одним seed дають ту саму послідовність рішень `combat/ai-controller.ts`, і snapshot **продовжує** послідовність, а не переграє її.
- Envelope `commandId` / `actorId` (обовʼязкові) + `expectedStateVersion` (опційний) на всіх пʼяти схемах; журнал `appliedCommands` у стані (кап 256, `applied-command-log.ts`). Дубль `commandId` повертає події першого прогону, не бампає `stateVersion`, не смикає порти вдруге і не крутить RNG — тест на кожній наявній команді. Розбіжність `expectedStateVersion` → подія `COMMAND_REJECTED`, не виняток. Gateway перезаписує `actorId` автентифікованим користувачем, а не довіряє дроту.
- `switch` → реєстр `Record<type, handler>` (`commands/handlers/`, один файл на команду). Характеризаційні тести (`apply-command.characterization.test.ts`) написані **до** рефакторингу і не змінювались ним. Вичерпність тримає mapped type замість `assertNever`.
- `HexMapModel.getTileAt()` — лінивий індекс `coordinateKey -> tile` з інвалідацією; переведені `apply-command`, `free-hex-finder`, `world-generator`, `move-planner`, `world-map-store.getTileAt` і два оверлеї. Характеризаційні тести лінійного пошуку — до зміни; окремий тест реактивності Pinia — бо звуження залежностей у `computed` жоден тест рушія не побачить.
- `FEATURE_EXPLORATION_SLICE` — резолвер у рушії (`features/feature-flags.ts`) з жорстким інваріантом «мультиплеєр → завжди off», тонка обгортка в `apps/web` (`VITE_FEATURE_EXPLORATION_SLICE`) і в `apps/api` (кімната сценарію = мультиплеєр за побудовою). Перевірено тестами з обох боків.
- `CONTENT_VERSION` лишився `1`. `rngState`/`stateVersion`/`appliedCommands` у payload — опційні; payload без них проходить checksum і вантажиться зі свіжим seed від власної checksum. Обидва шляхи покриті тестами.

**Свідомо не зроблено:** три виклики `defaultRandom` у `combat-store.ts` (стара Фаза A0 їх перелічувала) — інструкція фази прямо забороняє чіпати бій, а `combat-store` не тримає `HexEngineState`, тож джерело для нього означало б проєктувати, як стан бою заходить у стан рушія, тобто саме ту відкладену міграцію. Так само не переведені `map.tiles.find(...)` у `combat/ai-controller.ts` і `combat/combat-rules.ts`. Окремо лишився `Math.random()` у `HexMapModel.generateTiles()` (вибір фонової картинки) — він недосяжний із продакшн-шляху, `HexMapBuilder` живе тільки в тестах.

**Старт чату:**

```
Working in hexoflat. Read docs/EXPLORATION-SLICE-WORKFLOW.md — section 3 and phase E0 only.
Do E0 and nothing else: (1) the seeded RNG work previously scoped as Phase A0 in the now-
superseded docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md, (2) commandId/expectedStateVersion/actorId
plus an applied-command log so any duplicate commandId is a no-op returning the prior result,
(3) convert the applyCommand switch to a handler registry — write characterization tests
BEFORE the refactor, (4) add a coordinateKey->tile index to HexMapModel, (5) add the
FEATURE_EXPLORATION_SLICE flag, off in multiplayer sessions. Do not change any game rule,
balance, or content. Do not touch combat. CONTENT_VERSION stays 1 — both snapshot paths need
tests. Dedicated branch. Do not commit.
```

---

### E1 — Фікстура, чотиристанове відкриття, органічна межа [DONE — 17.08.2026]

**Гілка:** `exploration/e1-fixture-discovery`
**Передумови:** E0.
**Кроки документа:** STEP 2, 4–8.

**Обсяг:**

1. Фікстура `BROKEN_SPIRE_APPROACH_V1` у odd-q за таблицею §3.1, з тестом звірки axial↔odd-q і збереженням сусідства.
2. `discovery: DiscoveryState` на тайлі, `isRevealed` — похідний геттер (§3.2).
3. Рендерер: `UNKNOWN` не малюється взагалі. Гравець не бачить прямокутної межі дошки — інваріант I13.
4. Вхід у світ: герой на `(3,1)`, кемп `(2,1)` = UNDERSTOOD, кільце сусідів DISCOVERED, `ridge_junction (4,2)` = OBSERVED.
5. Оновлення відкриття по кроку: увійшов → DISCOVERED, згенеровані сусіди → OBSERVED, без витоку вмісту.
6. Далеке спостереження Broken Spire: силует і румб, без координати.

**Приймання:** VS-01 із §43; лінтер фікстури (§42) зелений; тест «жодного відрендереного UNKNOWN-гекса»; тест приватності — вміст UNKNOWN-гекса недосяжний із клієнтського стану (I3).

**Зроблено 17.08.2026** (гілка `exploration/e1-fixture-discovery`; `lint` / `typecheck` / `build` зелені, 317 unit-тестів рушія + 239 apps/web + 66 apps/api, 25/25 e2e; жодного порога ратчета не піднято):

- `content/fixtures/` — `BROKEN_SPIRE_APPROACH_V1` у odd-q за таблицею §3.1 (27 гексів, сітка 14×9), Zod-схема поряд, терен і прохідність як **окремі осі** (`FixtureTerrain` / `Traversal`; `DESTRUCTIBLE` у E1 = `BLOCKED`). Тест звірки проганяє axial-таблицю документа через `col = q + 2` і перевіряє **всі 27×27 упорядкованих пар** — і що сусідні лишились сусідами, і що несусідні не стали сусідами; без другої половини тихий зсув парності, який _винаходить_ сусідство, пройшов би непоміченим.
- `map/discovery-state.ts` + `discovery` на `HexTileModel`; `isRevealed` — похідний шим. **Жодне з 46 наявних місць не мігровано.** Одне свідоме уточнення проти букви брифа: сеттер `isRevealed = true` не понижує `UNDERSTOOD` до `DISCOVERED` (булевий виклик не має способу сказати «гравець тепер знає менше», і випадково сказати це ламало б I10). `false` скидає до `UNKNOWN` як і було.
- Формат збереження адитивний, `CONTENT_VERSION` = **1**. Обидва шляхи покриті: pre-E1 payload (без `discovery`) сходиться за checksum і читається `true → DISCOVERED` / `false → UNKNOWN`; round-trip зберігає всі чотири стани, включно з фікстурою цілком.
- Рендер: `UNKNOWN` **фільтрується в `use-hex-board-sizing.ts`**, тож не потрапляє ні в межі дошки, ні в шар тайлів — одна й та сама `visibleTiles` годує обидва, тому вони не можуть розійтись. `OBSERVED` — приглушений силует без спрайта об'єкта. `computeMapBounds` винесено в чисту функцію й покрито тестом з обох боків прапорця: **фільтр вимкнений за замовчуванням**, бо наявні FOG-мапи стартують повністю `UNKNOWN` і безумовна фільтрація стиснула б дошку до кількох гексів навколо героя.
- Крокове відкриття — `map/discovery-rules.ts`, викликається з `MOVE_HERO` під `state.features.explorationSlice`. `revealAroundHero` не змінено (є тест, що вона й далі рівняє всі сім гексів). `OBSERVED` віддає **категорію** (`GROWTH` / `OBSTACLE` / …), не `hexobjectKey` — тест перевіряє, що ключа немає в payload події. Ідемпотентність E0 тримається: дубль `commandId` не розширює фронтир удруге.
- `EngineFeatureSet` у стані **не серіалізується**; `deserializeState` приймає його аргументом, щоб старий сейв не міг увімкнути правило сесії, яка його не просила.
- Блок 6: `distantObservation` на фікстурі + `LandmarkPromise { silhouetteKey, bearing }`. У типі **немає** полів координати й відстані — тому «Broken Spire — 11 гексів» не можна відрендерити навіть помилково. Гекс `(9,4)` лишається `UNKNOWN` (є тест).
- e2e-хук: `getTileDiscovery` / `getRenderedTileCount` + шар Feature/Component і три специ. Нових `data-testid` на тайли не додано.

**Свідомо не зроблено:** фікстура **не підключена** до `MapRegistry` — у E1 немає ігрового шляху, яким у неї заходять, тож `buildFixtureMap` покрито тестами, а не грою; підключення разом із рухом — E2. Терен/прохідність **не покладені на `HexTileModel`**: у E1 їх ніхто не читає в рантаймі, а правило #3 тримає контент окремо від стану — рантаймовий дім їм знадобиться в E3, коли Stone Crust почне змінюватись під час гри. Лінтер фікстури реалізує 9 з 20 hard errors §42; решта перелічена в `DEFERRED_HARD_ERRORS` із фазою, яка робить їх вирішуваними (тест перевіряє, що цей перелік не порожній) — лінтер, який мовчки перевіряє половину і рапортує зелене, гірший за той, що каже, чого не перевірив.

**Старт чату:**

```
Working in hexoflat. Read docs/EXPLORATION-SLICE-WORKFLOW.md — sections 3.1, 3.2 and phase E1
only, plus sections 6-9 of docs/design/exploration-v0.1/00-exploration-vertical-slice-final-
v0.1.md. E0 is done. Build the deterministic fixture in the repo's odd-q coordinates using the
table in workflow section 3.1 (NOT the axial table in the design doc), add the four-state
discovery model with isRevealed kept as a derived getter, stop rendering UNKNOWN hexes, and
implement camp world-entry state. Include the axial<->odd-q adjacency-preservation test and
the fixture linter. No Will, no Burst, no tools, no pulse. Dedicated branch. Do not commit.
```

---

### E2 — Path of Will: Burst, ліміт маршруту, Waypoint, переривання

**Гілка:** `exploration/e2-will-burst`
**Передумови:** E1.
**Кроки документа:** STEP 9–14.

**Обсяг:** стан-машина Will (`GATHERED/COMMITTED/DISPERSED/GATHERING`, без числового пулу); `MovementBurstState` навколо наявного руху; `routeLimit = 5`; схема «Shift → Act → залишок Shift» з одним Act; один Waypoint у солвері; переривання на значущому відкритті з вибором Continue / Stop / Act.

**Обсяг тестової оснастки — робиться тут, не в E9:** перевірка паритету прев'ю й виконання (I6) як переносний тест-хелпер. Далі кожна фаза, що додає прев'ю, зобов'язана додати кейс у цей хелпер.

**Приймання:** VS-04, VS-05, VS-23; невикористані кроки не згорають після Act; неправильний перехід Will відхиляється з семантичною причиною, а не булевим `false`.

**Старт чату:**

```
Working in hexoflat. Read docs/EXPLORATION-SLICE-WORKFLOW.md — phase E2 only, plus section 10-
12 of the final design doc. E0-E1 are done. Implement the Will state machine, MovementBurstState
wrapping the existing movement, routeLimit enforcement, Shift->Act->Shift within one Burst, a
single optional Waypoint in the route solver, and the significant-reveal movement interrupt.
Also build the reusable preview/execution parity test helper (invariant I6) here — later phases
will add cases to it. Preview must call the same rule functions as execution; do not write a
second implementation for the preview. No terrain manipulation, no pulse, no resources.
Dedicated branch. Do not commit.
```

---

### E3 — Маніпуляція тереном: Stone Crust → Broken Passage

**Гілка:** `exploration/e3-terrain-manipulation`
**Передумови:** E2.
**Кроки документа:** STEP 15–18.

**Обсяг:** семантичний стан терену Stone Crust на `(5,2)`, для pathfinding — заблокований; кірка + перекриття токена → вербу `Break Through` через **наявну** граматику взаємодії (не новий `Interact`-меню); постійна трансформація в Broken Passage з інвалідацією кешу шляхів і бампом версії світу; побічний продукт Stone Fragment як рутинний підбір.

**Приймання:** VS-02, VS-03; інваріант I4 (постійність топології переживає save/load); тест, що недоступна верба пояснює **конкретну** причину, а не «Invalid action».

> **Після E3 — PLAY-1.** Зіграти зріз, зняти гейти A і C. Не переходити до E4, доки зріз не зіграний і результат не записаний у §8.

**Старт чату:**

```
Working in hexoflat. Read docs/EXPLORATION-SLICE-WORKFLOW.md — phase E3 only, plus sections 14-
15 of the final design doc. E0-E2 are done. Add the Stone Crust terrain state, wire Pickaxe
overlap to Break Through through the EXISTING hero-tool interaction grammar (do not add a
generic Interact menu), implement the permanent Broken Passage transformation with path cache
invalidation, and the Stone Fragment by-product. Unavailable verbs must state a concrete
in-world reason. After this phase the slice gets played, so make sure the fixture is actually
walkable end to end from camp to the passage. No noise, no patrol, no pulse yet.
Dedicated branch. Do not commit.
```

---

### E4 — Ресурсний габітат

**Гілка:** `exploration/e4-resource-habitat`
**Передумови:** E3 + результат PLAY-1.
**Кроки документа:** STEP 19–22.

**Обсяг:** джерело Medicinal Plant на `(5,0)`; Hand → Take через наявну систему взаємодії; мінімальний стек ресурсів в інвентарі; оновлення знання про ресурс (`UNKNOWN → SEEN → IDENTIFIED → HABITAT_KNOWN`). Жодного оверлея-трекера ресурсів.

**Окремо перевірити:** наявний `respawn-schedule.ts` / `world-loop.ts` — це рівно та «торгова машина», яку дизайн забороняє (§6 у `12-resource-ecology-...`). Під флагом слайсу респаун для фікстурних джерел вимкнути, інакше інваріант I9 (no local resource farm) провалиться на вже наявному коді.

**Приймання:** VS-06; I9; знання про ресурс монотонне (I10).

**Старт чату:**

```
Working in hexoflat. Read docs/EXPLORATION-SLICE-WORKFLOW.md — phase E4 only, plus section 16
of the final design doc. E0-E3 are done and PLAY-1 has been played. Add the Medicinal Plant
source, Hand->Take via the existing interaction system, a minimal resource stack, and resource
knowledge states. Check apps/web/src/services/world/respawn-schedule.ts and world-loop.ts
against invariant I9 — under the slice flag, fixture sources must not respawn on a timer. No
resource tracker overlay. Dedicated branch. Do not commit.
```

---

### E5 — World Pulse і патруль

**Гілка:** `exploration/e5-world-pulse`
**Передумови:** E4.
**Кроки документа:** STEP 23–30.

**Обсяг:** `WorldPulseRecord` + `GatherWillCommand`; сигнал Noise від розбитого каменю; патруль із фіксованим маршрутом `(6,5) → (7,5) → (7,4) → (6,4)`; перцепція й режим розслідування; бюджет відповідей; прев'ю наміру **тільки** спостереженого патруля; адаптер виявлення → наявний бій (§3.4); Burst не відновлюється після бою.

**Приймання:** VS-07 – VS-10, VS-21, VS-22; I7 (причинна цілісність), I8 (бюджет), I11; тест приватності — намір прихованого патруля недосяжний із клієнтського стану.

> **Після E5 — PLAY-2.** Гейти B, D, E.

**Старт чату:**

```
Working in hexoflat. Read docs/EXPLORATION-SLICE-WORKFLOW.md — phase E5 and section 3.4 only,
plus sections 20-23 of the final design doc. E0-E4 are done. Add WorldPulseRecord, the
GatherWill command, the Noise signal produced by the existing stone break, one Patrol actor on
the fixture route, threat perception and investigation, the response budget, and intent preview
for OBSERVED patrols only. Detection emits ThreatDetectedHero from the engine; apps/web adapts
that into the existing combat-store — the engine must never import combat-store. After combat,
Will is DISPERSED and the Burst does not resume. Hidden patrol state must not be reachable from
client state (invariant I3). Dedicated branch. Do not commit.
```

---

### E6 — Ландмарк, сліди, знання, реконтекстуалізація

**Гілка:** `exploration/e6-landmark-knowledge`
**Передумови:** E5 + результат PLAY-2.
**Кроки документа:** STEP 31–37.

**Обсяг:** Broken Spire як сутність-ландмарк; три сліди `(8,3)`, `(9,3)`, `(10,4)`; Hand → Inspect; правило знання `WEAKENED_SEAM_MARK` (два первинні сліди відмикають Insight); контекстне підтвердження Insight без вікторини; скан реконтекстуалізації → Memory Spark на `old_marked_ridge (3,0)`; легальність `Break Seam` після Insight.

**Приймання:** VS-11 – VS-14; I10, I11.

**Старт чату:**

```
Working in hexoflat. Read docs/EXPLORATION-SLICE-WORKFLOW.md — phase E6 only, plus sections 17-
19 of the final design doc. E0-E5 done, PLAY-2 played. Add the Broken Spire landmark, three
Trace entities, Hand->Inspect, the WEAKENED_SEAM_MARK knowledge rule unlocked by the two
primary traces, contextual insight confirmation (no multiple-choice quiz), the
recontextualization scan that puts a Memory Spark on old_marked_ridge, and Break Seam legality
gated on the insight. Knowledge must be monotonic and must not reveal hidden rewards.
Dedicated branch. Do not commit.
```

---

### E7 — Trail Imprint і відомий маршрут

**Гілка:** `exploration/e7-known-travel`
**Передумови:** E6.
**Кроки документа:** STEP 38–49, **без STEP 46** (див. §6.1).

**Обсяг:** канонічна подія `HeroTraversedPath`; детерміновані сегменти сліду; переходи `TRAVERSED → KNOWN → RELIABLE`; якорі подорожі (кемп, укриття, джерело, ландмарк, фронтир); ворота (кам'яний прохід, перетин загрози, реконтекстуалізація); граф відомої подорожі **тільки** з відомої закоміченої топології; STRIDE; VEIL; фізичне прискорене проходження нитки маршруту без телепорту; перевалідація під час руху; зупинка на Frayed Route.

**Приймання:** VS-15 – VS-19; I12 (відома подорож ніколи не пропускає нерозвʼязане рішення); Trail Imprint слухає подію виконаного шляху, а не візуальний компонент сліду.

**Старт чату:**

```
Working in hexoflat. Read docs/EXPLORATION-SLICE-WORKFLOW.md — phase E7 and section 6.1 only,
plus sections 24-26 of the final design doc. E0-E6 done. Implement Trail Imprint, route
knowledge transitions, travel anchors and gates, the known-travel graph, STRIDE and VEIL,
accelerated physical route-thread traversal (no teleport), in-travel revalidation and the
Frayed Route stop. SURVEY is deliberately out of scope for this slice — do not implement it.
Trail Imprint listens to executed-path domain events, never to the visual trail component.
Dedicated branch. Do not commit.
```

---

### E8 — Повернення, прибуття в кемп, Homecoming Beat

**Гілка:** `exploration/e8-expedition-return`
**Передумови:** E7.
**Кроки документа:** STEP 50–54, **без STEP 55** (див. §6.1).

**Обсяг:** `ExpeditionSessionState`; селектори контексту Continue/Return **без числової шкали ризику**; `BeginReturnCommand` поверх відомої подорожі; прибуття в кемп; компактний Homecoming Beat.

**Приймання:** VS-24; I15 (жодної числової абстракції ризику в UI); Homecoming Beat не є адміністративною стіною — показує тільки наслідки, що змінилися.

> **Після E8 — PLAY-3.** Гейти F, G, H, I.

**Старт чату:**

```
Working in hexoflat. Read docs/EXPLORATION-SLICE-WORKFLOW.md — phase E8 and section 6.1 only,
plus sections 27-29 of the final design doc. E0-E7 done. Add ExpeditionSessionState, the
Continue/Return context selectors (spatial and semantic — no numeric risk meter anywhere),
BeginReturnCommand built on known travel, camp arrival, and a compact Homecoming Beat. The
Critical Payload A/B test (STEP 55) is deliberately out of scope. Dedicated branch. Do not
commit.
```

---

### E9 — Rule Trace, детермінізм, лінтер, боти, телеметрія

**Гілка:** `exploration/e9-hardening`
**Передумови:** E8 + результат PLAY-3.
**Кроки документа:** STEP 56–61.

**Обсяг:** семантичний Rule Trace для всіх ланцюгів із §33; тести детермінізму save/load; лінтер фікстури; автоматизовані профілі дослідників; телеметрія плейтесту; ревʼю Stop Gate.

**Зсув відносно документа:** профілі **E (Naive Clicker)** і **F (Fog Cleaner)** реалізувати як движкових ботів **одразу після PLAY-1**, а не тут. Це найдешевший наявний детектор того, що дослідження перетворилось на клікання — а ця відповідь потрібна до, а не після побудови ще пʼяти підсистем.

**Приймання:** VS-20; всі інваріанти I1–I15; §52 Definition of Done відпрацьовано пункт за пунктом; **`DEFERRED_HARD_ERRORS` порожній** — усі 20 hard errors §42 реалізовані (див. §9).

---

## 6. Пропозиції змін до дизайну

Кожна пропозиція прогнана через Marginal Decision Test документа: «якщо це прибрати, чи втрачає слайс необхідний і зараз неперевірюваний тип рішення гравця?»

### 6.1 Прибрати зі слайсу — тест «ні»

**SURVEY (STEP 46).** У фікстурі один звʼязний граф маршрутів із трьома якорями. Три режими подорожі на такій топології не можуть дати матеріально різних маршрутів — STRIDE і VEIL уже вичерпують наявний вибір «швидко» проти «в обхід загрози». SURVEY тестує «подорож уздовж межі знаного», а межа тут одна й вона теж уже в STRIDE. Прибрати зі слайсу, повернути разом із Region Grammar, коли зʼявиться друга область.

**Critical Payload A/B (STEP 55).** Документ сам маркує його опційним і «тільки після стабільного базового слайсу». Винести за межі слайсу явно — інакше воно потрапить у той самий чат і розмиє відповідь PLAY-3.

**Бюджет доменних подій.** §32 вимагає ~40 подій. Частина з них — не факти стану, а UI-нотифікації (`RoutePreviewed`, `MemorySparkCreated`, `ThreatIntentChanged`). Пропозиція: подія емітиться тільки якщо вона (а) змінює стан, або (б) потрібна Rule Trace / реплею. Решта виводиться на клієнті зі стану. Інакше ідемпотентність і реплей доводиться гарантувати для сорока речей замість двадцяти.

### 6.2 Змінити — тест «так», ціна одна фікстурна правка

**Реконтекстуалізація має відкривати вихід із кемпу, а не «кишеню».**

STEP 37 каже, що після Insight `Break Seam` відкриває «local hidden passage/pocket». «Кишеня» — це схованка з лутом, тобто разова нагорода. Але `old_marked_ridge` стоїть на `(3,0)` — впритул до кемпу й до точки виходу `(3,1)`.

Пропозиція: `Break Seam` на старому хребті створює **другий постійний вихід із кемпу**. Тоді ланцюг замикається сам на себе так, як обіцяє §2 п.15: знання, здобуте на іншому кінці карти, назавжди змінює те, як гравець щоранку виходить із дому. Це рівно та сама `TerrainTransformationService`, що вже написана в E3 — нових механік нуль, а нагорода стає структурною замість інвентарної.

**Тест:** так. Без цього слайс не перевіряє, чи «знання → постійна нова можливість» відчувається як володіння світом, а перевіряє лише «знання → лут».

**Шум має коштувати гравцеві саме тому, що коротший шлях — його власний.**

Це вже майже закладено: `patrol_investigation_lane (5,3)` — сусід `stone_crust_shortcut (5,2)`. Тобто прохід, який гравець сам пробив, лежить рівно на смузі, куди патруль іде розслідувати шум від цього ж пробивання. Пропозиція — не міняти фікстуру, а **зробити цей звʼязок вимірюваним**: телеметрія PLAY-2 має окремо фіксувати, чи гравець помітив, що його власний прохід став вразливим місцем зворотного шляху, і чи VEIL узагалі має сенс без цього усвідомлення. Якщо не помітив — це діагноз для прев'ю, і саме він визначає, що робити далі, а не додавання другого патруля.

### 6.3 Додати — одна пропозиція, тест «так»

**Тиша як позиційний ресурс: Gather Will біля укриття тихіший.**

Зараз Gather Will — чиста плата: гравець просить наступний Burst, світ відповідає. Рішення в цьому одне — _коли_. Рішення _де_ немає взагалі, хоча вся решта дизайну про простір.

`ruin_shelter (5,1)` у фікстурі має роль «Shelter Anchor candidate» і в слайсі не робить нічого, крім того, що є якорем подорожі в E7.

Пропозиція: Gather Will, виконаний на гексі-укритті, зменшує бюджет відповідей World Pulse на одиницю.

- **Нових сутностей:** нуль. Укриття вже у фікстурі, бюджет уже в `WorldPulseService`.
- **Нових правил:** одне.
- **Що зʼявляється:** рішення «де закінчити Burst», якого зараз немає. Географія починає впливати на темп, а не лише на шлях. Укриття перестає бути декорацією. Зʼявляється третя стратегія на додачу до «швидко напролом» і «обережно в обхід» — «планувати зупинки».
- **Фізична відтворюваність за столом:** тривіальна — токен укриття лежить на гексі, при Gather Will на ньому береш на один жетон відповіді менше.

**Тест:** так. Прибери — і слайс не перевіряє, чи темп-механіка взаємодіє з простором, а це прямо в обіцянці досвіду («світ відповідає» + «маршрут як рішення»).

**Ризик:** може зробити гру в укриття домінантною стратегією. Тому пропозиція — вводити це **не** в E5, а як єдину зміну між PLAY-2 і PLAY-3, щоб її ефект вимірювався окремо від решти Pulse. Якщо PLAY-2 і так дав напругу за гейтом B — не вводити взагалі (Kill → Simplify → Tune → Expand).

### 6.4 Не робити зараз

Region Grammar Generator (`11-*`) — повноцінна підсистема з граматиками G01–G12, лінтером і памʼяттю досвіду. У слайсі топологія фіксована **свідомо** (§6.1 документа: щоб телеметрія була порівнюваною). Генератор має споживати ті самі контракти, але вмикається після Stop Gate. Це найбільший шматок готового дизайну, який правильно **не** запускати.

---

## 7. Чого не робимо до кінця слайсу

Список §1.2 документа діє повністю. Понад нього, специфічно для цього репозиторію:

- не мігрувати бій у рушій (окремий трек, свідома пауза в `CLAUDE.md`);
- не вмикати слайс у кооп-сесіях;
- не чіпати фази 11–12 міграції (деплой, S3, обсервабіліті — теж свідома пауза);
- не видаляти `isRevealed` і не видаляти сходинку Scout — обидва повертаються після Stop Gate;
- не бампати `CONTENT_VERSION` заради адитивних змін збереження.

---

## 8. Журнал прогресу

Кожна фаза дописує сюди один рядок після завершення чату. Плейтестові зрізи дописують результат по гейтах.

| Дата       | Фаза / зріз | Результат                                                                                                                                                                                                                                                                                                                                  | Гілка                               |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 14.08.2026 | —           | Воркфлов створено, дизайн-документи внесені в `docs/design/exploration-v0.1/`                                                                                                                                                                                                                                                              | `docs/exploration-slice-workflow`   |
| 17.08.2026 | E0          | Seeded RNG у стані, envelope команд + журнал ідемпотентності, реєстр хендлерів, індекс тайлів, фіча-флаг. `CONTENT_VERSION` = 1, ратчет не зрушено. Бій не чіпано (3 `defaultRandom` лишились)                                                                                                                                             | `exploration/e0-command-foundation` |
| 17.08.2026 | E1          | Фікстура `BROKEN_SPIRE_APPROACH_V1` в odd-q (27 гексів, 14×9), чотиристанове `discovery` з шимом `isRevealed`, органічна межа в межах дошки й рендері, крокове відкриття в `MOVE_HERO` під прапорцем, силует Шпиля без координати. `CONTENT_VERSION` = 1, ратчет не зрушено, 25/25 e2e. Фікстура ще не підключена до `MapRegistry` — це E2 | `exploration/e1-fixture-discovery`  |

---

## 9. Ратчет лінтера фікстури

E1 реалізував 9 із 20 hard errors §42; решта 11 перелічені в `DEFERRED_HARD_ERRORS` (`packages/engine/src/content/fixtures/fixture-linter.ts`), кожен із фазою, яка робить його вирішуваним.

**Правило:** список тільки скорочується. Фаза, названа в рядку, зобовʼязана реалізувати своє правило й видалити рядок — це частина її приймання, не окреме прибирання.

| Фаза | Правила §42, які вона закриває            |
| ---- | ----------------------------------------- |
| E2   | 20 (паритет прохідності прев'ю/виконання) |
| E3   | 12 (частково — руйнування терену)         |
| E4   | 9 (частково — ресурс)                     |
| E5   | 6, 19, 9 (Will)                           |
| E6   | 10, 11, 12 (Insight-гейт), 13             |
| E7   | 14, 15, 16                                |
| E9   | перевіряє, що список порожній             |

Наявний тест (`fixture-linter.test.ts`) стверджує `length > 0` — це підлога, яка проходитиме вічно. У фазі, що закриває останнє правило, замінити на `toEqual({})`; до того кожна фаза перевіряє, що її власні номери зі списку зникли.
