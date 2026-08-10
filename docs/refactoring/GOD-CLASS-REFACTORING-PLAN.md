# Hexoflat — антипатерн God Class: діагностика й план рефакторингу

Документ від 10 серпня 2026. Гілка, в якій це починалось: `hexoflat-complexity-reduce`.

Дві частини: **теорія** (що таке God Class і чому це дорого саме нам) і **виміряна діагностика конкретного коду hexoflat** з фазовим планом виправлення.

**Робоче правило (як і в [`GAMEPLAY-VERTICAL-SLICE-PLAN.md`](../GAMEPLAY-VERTICAL-SLICE-PLAN.md)): кожна фаза нижче — це окремий чат.** Не змішувати фази. Кожна має власний блок «старт чату». Правило проєкту «питати дозвіл перед `git commit`» лишається чинним на кожному кроці.

Прогрес фіксується прямо тут: завершена фаза отримує `[DONE — дата]` у заголовку.

---

## Частина 1 — Що таке God Class

### 1.1. Визначення

**God Class** (він же God Object, Blob) — клас/модуль, який знає й робить забагато: концентрує в собі стан і поведінку, що за логікою належать кільком різним сутностям. Решта класів деградує до анемічних структур даних, які God Class смикає ззовні.

Це антипатерн не тому, що файл великий. Великий файл — симптом. Проблема — **кількість незалежних причин для зміни**. Клас із 900 рядків, що робить одну річ, нормальний. Клас із 300 рядків, який змінюється й коли міняється формат збереження, і коли міняється правило руху, і коли додається новий тип ворога — уже God Class.

### 1.2. Які принципи він порушує

- **SRP (Single Responsibility)** — у формулюванні Роберта Мартіна: «клас має мати рівно одну причину для зміни». God Class має їх десяток.
- **OCP (Open/Closed)** — щоб додати поведінку, доводиться редагувати сам God Class, а не розширювати його.
- **DIP (Dependency Inversion)** — God Class тягне конкретні залежності (localStorage, router, таймери, інші стори) замість абстракцій.
- **Law of Demeter** — виклики виду `worldStore.map.tiles.find(...).hexobject.creature.hp` розкидані по всьому коду.
- **Високе coupling / низька cohesion** — методи всередині класу не мають між собою нічого спільного, окрім спільної адреси.

### 1.3. Як він виникає (це важливо — не «поганий програміст»)

God Class майже ніколи не пишуть навмисно. Він **накопичується**:

1. Стор/сервіс створюють як «місце, де живе стан фічі» — це правильно й дешево.
2. Наступна фіча потребує доступу до того самого стану → код кладуть _туди ж_, бо там уже є все потрібне.
3. Крок 2 повторюється 40 разів.

Ключовий механізм — **гравітація стану**. Модуль, який володіє центральним станом, притягує до себе будь-яку логіку, яка цей стан читає. Саме тому God Class майже завжди утворюється навколо «головного» об'єкта домену — у нас це мапа світу.

### 1.4. Симптоми, які можна виміряти

| Симптом                  | Як міряти                                                      | Червона межа (наша)            |
| ------------------------ | -------------------------------------------------------------- | ------------------------------ |
| Розмір                   | рядків у файлі                                                 | > 400                          |
| Кількість обов'язків     | скільки різних «причин для зміни»                              | > 3                            |
| Fan-out                  | скільки різних модулів імпортує                                | > 10                           |
| Fan-in                   | скільки модулів залежить від нього                             | > 8 при великому fan-out       |
| LCOM (брак зв'язності)   | чи є групи методів, які не торкаються спільних полів           | наявність ≥ 2 незв'язаних груп |
| Циклічні залежності      | A імпортує B, B імпортує A                                     | будь-який цикл                 |
| Змішані рівні абстракції | доменні правила поруч із `localStorage`/`setInterval`/`router` | будь-яке змішування            |
| Тестова біль             | треба мокати 5+ речей, щоб перевірити одне правило             | так                            |

### 1.5. Чому для hexoflat це дорожче, ніж для звичайного застосунку

Три причини, специфічні для цього проєкту:

1. **Архітектурне правило #1** (`CLAUDE.md`): усі зміни стану — через валідовані команди й доменні події. God Class у сторі — це фізичне місце, де це правило порушується, бо там стан мутують напряму.
2. **Мультиплеєр і replay.** Логіка, що сидить у Pinia-сторі, недоступна серверу. Кожен рядок доменних правил у `apps/web/src/stores/` — це рядок, який доведеться писати вдруге для `apps/api`, або який назавжди зафіксує гру як single-player.
3. **Детермінізм.** `Math.random()` і `Date.now()` всередині стора (у нас є і те, і те) ламають replay і синхронізацію — а вони заявлені як вимога.

Тобто в нашому випадку боротьба з God Class — це не гігієна коду, а **передумова для мультиплеєра**.

---

## Частина 2 — Діагностика hexoflat (виміряно 10.08.2026, перевірено `wc -l` того ж дня)

### 2.1. Загальна картина

```
886  apps/web/src/stores/world-map-store.ts                            ← God Class #1
727  apps/web/src/stores/combat-store.ts                               ← God Class #2
688  apps/web/src/a-game-scenes/map-scene/components/hex-world-map.vue ← God Component
589  apps/web/src/stores/hero-inventory-store.ts                       ← God Class #3
```

Для контексту: увесь `packages/engine/src` має найбільший файл на 341 рядок. **Проблема сконцентрована виключно в `apps/web/src/stores/` і в одному компоненті** — engine залишився чистим. Це добра новина: гниття локалізоване.

### 2.2. `world-map-store.ts` — 886 рядків, 32 actions

Обов'язки, які вдалось нарахувати (кожен — окрема причина для зміни):

1. **DI-контейнер** — `buildEngineContext()` збирає 6 сторів у контекст для engine.
2. **Render-оптимізація** — `dirtyTileIds`, `markTileDirty`, `consumeDirtyTileIds`, лічильник `dirtyTick`.
3. **Persistence** — 11 звернень до `localStorage`, префікси ключів, дебаунс 750 мс, `Map` pending-збережень, хендлер `beforeunload`. Поруч уже існує окремий `apps/web/src/stores/world-persistence.ts` (індекс мап локацій + розклад респавну, свої ключі `hexoflat:world:*`) — це вже початок того шару, який має вийти з G2, а не паралельний до нього код.
4. **Розклад респавну локацій** — `scheduleLocationRespawn`, `syncLocationRespawn`, `getLocationRespawnRemainingMs`.
5. **Навігація** — `goToLocation`, `openLocation` + прямі виклики `router.push`.
6. **Життєвий цикл мапи** — `loadFromStorage`/`saveToStorage`, перевірка `CONTENT_VERSION`, гідрація.
7. **Ігровий цикл** — `setInterval` на 250 мс, `startWorldLoop`/`stopWorldLoop`.
8. **Туман війни** — `initFog`, `revealAroundHero`, `revealTile`, `revealEntryTile`.
9. **Рух героя** — `moveHeroTo` (100+ рядків: правила, pathfinding, анімація, побічні ефекти).
10. **Розміщення героя** — `placeHeroAtEntry`, `placeHeroAtCampfire`, `respawnHeroAtCamping`.
11. **Гідрація ресурсів** — `hydrateResourcesFromConfig`.
12. **Глобальний ресет** — `clearAllWorlds`.

Fan-out: імпортує 6 інших сторів + `router` + `localStorage` + engine. Fan-in: 16 файлів.

Помітно, що коментарі-роздільники у файлі (`// ===== NAVIGATION =====`, `// ===== MAP LIFECYCLE =====`, `// ===== RESOURCES =====`) — це **вже наявна карта майбутнього розпилу**. Автор інтуїтивно позначив шви; лишилось їх розрізати.

### 2.3. `combat-store.ts` — 727 рядків, 25 actions

- **19 викликів `useWorldMapStore()`** і **16 викликів `worldStore.saveToStorage()`** усередині одного стора.
- **Циклічна залежність:** `world-map-store` імпортує `combat-store`, `combat-store` імпортує `world-map-store`. (G0 виміряв, що це не єдиний цикл у `apps/web/src` — їх три; повний перелік у розділі G0. Цей — єдиний, що адресує G2.)

Це діагностично найважливіше місце в проєкті. За коментарями у файлі видно, що combat уже **колись відпилювали** від world-map-store. Але відпиляли **по файлах, а не по залежностях**: стан переїхав, а зв'язки лишились. Результат — не два модулі, а один God Class, розтягнутий на два файли, плюс цикл. Класична пастка: `combat-store` не може зберегти власний стан без `world-map-store`, бо той володіє форматом збереження.

Обов'язки: persistence-міст (`hydrate`/`toSnapshot`), запити правил, туман бою, потік ходів, маркери, **AI ворога** (`ensureEnemyTurnResolution` — ~170 рядків: вибір цілі, рух, атака, підрахунок шкоди, відступ, `await` на 5 секунд, i18n, логування), **атака героя** (`performHeroCombatAttack` — ~90 рядків, включно зі спавном могили й підрахунком вбитих).

Детермінізм уже зламано: `Math.random()` у виборі цілі атаки, відступу й авто-щита ворога; `Date.now()` у таймері ходу.

### 2.4. `hex-world-map.vue` — 688 рядків (577 у `<script setup>`)

**Тут є окрема, дуже конкретна знахідка.** У `apps/web/src/composables/` лежать три файли, які **не імпортує ніхто**:

| Файл                      | Рядків | Імпортерів |
| ------------------------- | ------ | ---------- |
| `use-move-preview.ts`     | 129    | **0**      |
| `use-hex-board-sizing.ts` | 132    | **0**      |
| `use-hex-board-input.ts`  | 118    | **0**      |

Логіка з них досі живе **вклеєною в `hex-world-map.vue`** — там же `movePreview`, `mapBounds`/`updateScale`/`readDomTileSize`, `onWheel`/`equipToolFromHand`/`resolvePreferredToolHover`.

Тобто екстракцію вже зробили, але **не під'єднали**. Зараз у репозиторії дві копії правил превʼю руху, які можуть розійтися й ніхто цього не помітить. Це найдешевша й найризикованіша водночас знахідка: −379 рядків дублювання за одну фазу.

### 2.5. `hero-inventory-store.ts` — 589 рядків, 30 actions

Три незв'язані групи полів — підручниковий високий LCOM:

- **модель гріда й предметів** — `grid`, `items`, `rotationsById`;
- **правила ваги/стаків** — `carriedWeightKg`, `mergeStacks`, `putToInventory`;
- **UI-стан drag & drop** — 10 полів `drag*`, які до домену не мають стосунку взагалі й у стані сторінки не повинні зберігатись.

Плюс власна persistence (`localStorage`), плюс `crypto.randomUUID()` і `Math.random()` (обертання токенів) — знову недетермінізм у сторі.

### 2.6. Наскрізна проблема: persistence розмазана

`localStorage` викликається напряму з **8 різних модулів** `apps/web/src` (`main.ts`, `world-persistence.ts`, `hero-store.ts`, `world-map-store.ts`, `ui-settings-store.ts`, `user-store.ts`, `hero-inventory-store.ts`, `i18n/locale.ts`). Немає єдиного шару збереження — кожен стор має власний формат, власний ключ і власну перевірку версії. Це і є причина циклу з 2.3.

`world-persistence.ts` тут окремий випадок: він уже маленький і сфокусований (тільки індекс мап локацій + розклад респавну), на відміну від решти. Це не God Class, а зародок правильного шару — G2 має його поглинути/розширити, а не створювати новий модуль поруч.

---

## Частина 3 — Як правильно рефакторити (і як неправильно)

### 3.1. Головне правило: різати по залежностях, а не по рядках

Урок із 2.3 — його треба винести на початок, бо він уже раз коштував проєкту цикл.

Розпил вдалий тоді, коли **новий модуль можна протестувати, не піднімаючи старий**. Якщо після розпилу `B` викликає `A.save()` 16 разів — розпилу не сталося, сталося перейменування.

Практичний критерій перед кожним кроком: _«чи зможу я написати unit-тест на новий модуль, підсунувши йому лише прості дані?»_ Якщо ні — шов вибрано неправильно.

### 3.2. Порядок операцій (Мартін Фаулер, `Refactoring`, розділ про Large Class)

Правильна послідовність — не «розпиляти файл», а:

1. **Знайти шви** — згрупувати поля за тим, які методи їх читають. Групи полів = майбутні модулі.
2. **Extract Class / Extract Function** — витягти групу разом із її методами.
3. **Move Method** — перенести методи туди, де живуть дані, з якими вони працюють.
4. **Hide Delegate / Facade** — старий клас лишається фасадом, який делегує, щоб не ламати 16 місць виклику.
5. **Inline Facade** — коли всі виклики переведені, фасад прибирається.

Кроки 4–5 критичні: вони роблять рефакторинг **інкрементальним**. Ніколи не переписувати God Class «начисто» за один захід — при 16 fan-in це гарантований регрес без можливості локалізувати причину.

### 3.3. Патерни, які лягають саме на нашу архітектуру

- **Command / Domain Event** — у нас уже є (`applyCommand`, 5 команд: `START_HEX_ACTION`, `FINISH_PENDING_ACTIONS`, `WORLD_TICK`, `ADD_RESOURCE_SPAWNER`, `MOVE_HERO`). Основний інструмент: логіка, що переїжджає в engine як команда, автоматично стає доступною серверу й replay.
- **Repository / Port** — persistence ховається за інтерфейсом; engine його не знає, `apps/web` реалізує через `localStorage`, `apps/api` — через Postgres. Це те, чого зараз бракує (2.6).
- **Pure function extraction** — найдешевший і найбезпечніший крок: підрахунок шкоди, вибір цілі AI, перевірка досяжності стають чистими функціями в engine. Не потребує жодних дизайнерських рішень, тільки перенесення.
- **Facade Store** — Pinia-стор лишається тонким: реактивний стан + делегування. Правила в ньому не живуть. Цільовий орієнтир — стор ≤ 150 рядків.
- **Composables для UI-стану** — drag & drop, hover, масштаб, розміри не належать домену й не належать стору.
- **Strangler Fig** — новий шлях будується поруч зі старим, виклики переводяться поступово, старий код видаляється в кінці. Обов'язково для `moveHeroTo` й `ensureEnemyTurnResolution`.

### 3.4. Антипатерни самого рефакторингу — чого не робити

- ❌ **Розпил за розміром** («хай буде по 200 рядків») — дає модулі без сенсу й нові цикли.
- ❌ **Utils/helpers-звалище** — God Class не зникає, а перевтілюється у `utils.ts` без стану.
- ❌ **Big-bang rewrite** — при fan-in 16 неможливо локалізувати регрес.
- ❌ **Рефакторинг без тестів попереду** — на `world-map-store.ts` є 243 рядки тестів, на `combat-store.ts` 269. Це замало як страхувальна сітка; характеризаційні тести на поточну поведінку пишуться **до** переносу, а не після.
- ❌ **Змішувати рефакторинг зі зміною поведінки в одному коміті** — тоді неможливо сказати, що саме зламалось.
- ❌ **Тягнути combat у engine «заодно»** — див. 4.5, це заблоковано дизайнерським рішенням, а не браком часу.

---

## Частина 4 — Фази (кожна = окремий чат)

Порядок не довільний: спершу дешеве й безризикове, потім розрив циклу (він блокує все інше), потім великі розпили.

### Фаза G0 — Виміряти й зафіксувати межу `[DONE — 10.08.2026]`

**Мета.** Не дати проблемі рости, поки її виправляють. Жодних змін поведінки.

**Що робити.**

- Додати в `eslint.config.js` для `APP_SRC_FILES` і `ENGINE_SRC_FILES`: `max-lines` (skipBlankLines, skipComments), `max-lines-per-function`, `complexity`, `max-depth`. Пороги виставити **на поточному максимумі**, щоб лінт був зелений одразу — це «храповик», а не покарання.
- Додати `import/no-cycle` (або `eslint-plugin-import-x`) як `warn` — цикл `world-map-store` ↔ `combat-store` має бути видимим у CI, а не в голові.
- Записати baseline-цифри в цей файл (таблиця «було/стало»).

**Критерій приймання.** `pnpm lint` зелений; будь-який новий файл, більший за поріг, падає в CI.

#### Baseline, зафіксований у `eslint.config.js` (виміряно 10.08.2026)

Пороги виставлені **точно на поточному максимумі** — нуль запасу, тож будь-яке зростання падає одразу. Значення рахуються з `skipBlankLines: true, skipComments: true`, тому вони менші за фізичні `wc -l`.

| Правило                  | `apps/web/src` | де саме зараз максимум        | `packages/engine/src` | де саме зараз максимум                        |
| ------------------------ | -------------- | ----------------------------- | --------------------- | --------------------------------------------- |
| `max-lines`              | **703**        | `stores/world-map-store.ts`   | **371**               | `commands/apply-command.test.ts`              |
| `max-lines-per-function` | **188**        | `stores/combat-store.test.ts` | **116**               | `commands/apply-command.ts`                   |
| `complexity`             | **39**         | `hex-world-map.vue:178`       | **43**                | `map/models/hex-map-model.ts:228`             |
| `max-depth`              | **4**          | `i18n/locale-keys.ts:39`      | **4**                 | `game-resolvers/interactions-resolver.ts:142` |

Перевірено, що храповик реально кусається: файл на 710 рядків і функція на 203 рядки дають `error`, а не проходять мовчки.

#### Знахідка G0: циклів не один, а три

Розділ 2.3 і таблиця в Частині 5 стверджували «1 цикл». Після того, як `import-x/no-cycle` **справді запрацював**, видно **три різні цикли** в `apps/web/src`:

1. `combat-store` ↔ `world-map-store` — той, що задокументований (ціль G2).
2. `world-map-store` ↔ `user-store` — `user-store.ts:13` імпортує `world-map-store`, і назад.
3. `router/index.ts` ↔ `user-store` — `router` імпортує `useUserStore`, `user-store.ts:11` імпортує `router` (плюс `hex-world-map.vue` втягнутий у цей же цикл через `@/router`).

Цикли 2 і 3 **не входять у скоуп G2** (він адресує лише перший) — їх треба закривати окремо, найімовірніше разом із G3, де `location-navigator.ts` і так забирає `router` зі стора. Доти вони лишаються видимими попередженнями, а не прихованим боргом.

#### Пастка, на яку варто не наступити повторно

`import-x/no-cycle` **мовчки не працює**, якщо не задані **обидва** налаштування: `import-x/resolver-next` (резолвити `@/*` і workspace-пакети) і `import-x/parsers` (парсити знайдені `.ts`). Без `parsers` резолвер працює, `no-unresolved` коректно ловить биті імпорти — але список імпортів кожної залежності приходить порожнім, і правило рапортує **нуль проблем на репозиторії, де цикли точно є**. Тобто відсутність попереджень тут не доводить відсутності циклів. Обидва налаштування залишені з коментарем прямо в `eslint.config.js`.

**Старт чату:**

```
Working in hexoflat. Read docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md — Part 1, 2 and
section 4, Phase G0 only. Do Phase G0 and nothing else: add size/complexity ESLint rules
pinned to the current baseline plus an import-cycle warning, and record the baseline numbers
in the doc. No production code changes. Create a dedicated branch first. Ask before commit.
```

---

### Фаза G1 — Під'єднати три «мертві» composables `[DONE — 10.08.2026]`

**Мета.** Прибрати дублювання з 2.4. Найдешевша фаза з найбільшим негайним ефектом.

**Що робити.**

- Звірити `use-move-preview.ts` / `use-hex-board-sizing.ts` / `use-hex-board-input.ts` з їхніми вклеєними двійниками в `hex-world-map.vue` — **зафіксувати кожну знайдену розбіжність у чаті перед тим, як щось міняти** (композабл може бути застарілою або, навпаки, свіжішою версією).
- Замінити inline-код у `hex-world-map.vue` на виклики композаблів.
- Якщо якийсь композабл виявиться зайвим/застарілим — видалити його, а не «залишити про всяк випадок».

**Критерій приймання.** `hex-world-map.vue` < 400 рядків; жоден файл у `composables/` не має нуля імпортерів; e2e зелені; поведінка превʼю руху, масштабу й wheel-перемикання рук не змінилась (перевірити вручну + Playwright).

#### Результат G1

`hex-world-map.vue`: **688 → 394 рядки**. Усі три композабли підключені, inline-двійники видалені, жоден файл у `composables/` більше не має нуля імпортерів.

**Поведінкових розбіжностей між композаблами й inline-кодом не знайдено** — логіка збігалась дослівно. Відрізнялись лише три структурні речі, жодна з яких не змінює поведінку: композабли самі реєструють/знімають свої слухачі (`wheel`, `resize`) замість спільного `onMounted` компонента; `bleed = 2` став константою `BLEED`; `use-move-preview` повертає ключі без префікса (`segments` замість `movePreviewSegments`), і його форма **точно** збігається з `UseHexBoardOptions['movePreview']`, тож адаптер не знадобився — передається одним об'єктом.

**Що саме покрили тести, а що ні** (це важливіше за «e2e зелені»):

- **Sizing — покрито.** `getTileFraction()` кидає помилку при нульовому розмірі дошки, а всі кліки по тайлах влучають. Якби `probeRef` із композабла не зв'язався з `ref="probeRef"` у шаблоні, `domTileW/H` лишились би нулем і це впало б одразу. Це був головний ризик фази.
- **Wheel-перемикання рук — покрито.** `HexBoardComponent.armHandTool()` робить саме `page.mouse.wheel(0, 100)`, і `gather-resource.spec.ts` на ньому тримається.
- **Превʼю руху — НЕ покрито e2e.** Ні в `e2e/**`, ні в `window.__HEXOFLAT_TEST__` немає жодного звернення до стану превʼю: це чистий Pixi-шар. Перевірено окремо скриншотом (тимчасовий спек, видалений після перевірки) — маркер досяжного сусіднього гекса рендериться, мапа відмасштабована й відцентрована.
- **Точне значення `scale` — не покрито й лишається непокритим.** Клік-математика e2e навмисно масштаб-агностична (рахує частку від живого `boundingBox()` канваса), тож зламаний зум не впав би в тестах — помітили б лише нульовий розмір. Візуально перевірено, автотесту на це немає.

20/20 e2e зелені. Окремо: перший прогін впав 16/20 з `POST /auth/register → HTTP 500` — це був зупинений контейнер Postgres, не регрес; після `docker compose -f docker-compose.dev.yml up -d` усе зелене.

**Старт чату:**

```
Working in hexoflat. Read docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md — sections 2.4, 3.1,
3.4 and Phase G1. Do Phase G1 only: apps/web/src/composables/use-move-preview.ts,
use-hex-board-sizing.ts and use-hex-board-input.ts have zero importers while duplicates of
their logic still live inline in hex-world-map.vue. First diff each composable against its
inline twin and report every behavioural difference you find before changing anything. Then
wire them in and delete the inline copies. No behaviour changes. Dedicated branch. Ask before commit.
```

---

### Фаза G2 — Винести persistence у власний шар `[DONE — 10.08.2026]`

> **Назву й ціль фази довелось виправити по факту.** Спочатку фаза називалась «розірвати цикл». Перед початком робіт залежності перевірили поіменно — і виявилось, що діагноз у 2.3 неповний: persistence **не є** причиною циклу, а лише одним із чотирьох зчеплень. Деталі — у блоці «Чому цикл лишився» нижче.

**Мета.** Прибрати 16 викликів `worldStore.saveToStorage()` з `combat-store`. Це блокер для G3 і G4 — доки цикл є, обидва стори не розпилюються незалежно.

**Що робити.**

- Створити `apps/web/src/services/persistence/` з єдиним шаром збереження: власником ключів, `CONTENT_VERSION`-перевірки, дебаунсу й `beforeunload`-флашу (зараз усе це в `world-map-store.ts`).
- **Почати зі звірки з `apps/web/src/stores/world-persistence.ts`** — цей файл уже робить малий шматок того самого (індекс мап локацій, розклад респавну, свої `hexoflat:world:*`-ключі). Його логіка переїжджає в новий шар або новий шар будується як розширення цього файлу — але не як третій, паралельний persistence-модуль.
- Обидва стори звертаються до цього шару, а не один до одного. `combat-store` більше не імпортує `world-map-store` заради збереження.
- Формат на диску **не міняти** — це чистий рефакторинг; міграція формату була б окремою задачею з окремими ризиками.
- Розглянути, чи не замінити 16 явних викликів збереження на один `subscribe`-хук Pinia (стор змінився → шар збереження сам планує запис). Це прибирає обов'язок «не забути зберегти» з кожного action.

**Критерій приймання.** `import/no-cycle` не має попереджень; `grep useWorldMapStore apps/web/src/stores/combat-store.ts` дає суттєво менше за 19 (ідеально — 0 заради persistence, лишаються тільки читання мапи); наявні store-тести зелені.

**Старт чату:**

```
Working in hexoflat. Read docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md — sections 2.2, 2.3,
2.6, 3.1, 3.2 and Phase G2. Do Phase G2 only: extract the localStorage persistence layer out
of world-map-store.ts into its own service so combat-store.ts no longer has to call
worldStore.saveToStorage() (16 call sites today) and the import cycle between the two stores
is gone. apps/web/src/stores/world-persistence.ts already does a small piece of this (location
map index + respawn schedule) — reconcile with it first, don't build a third parallel
persistence module. Keep the on-disk format byte-identical. No behaviour changes. Write
characterization tests for save/load before moving anything. Dedicated branch. Ask before commit.
```

#### Результат G2

Створено `apps/web/src/services/persistence/world-storage.ts` (133 рядки) — єдиний власник усіх ключів світу, `CONTENT_VERSION`-гейту, дебаунсу 750 мс і `beforeunload`-флашу. Модуль **не імпортує жодного стора**: дані приходять і повертаються як прості значення, тому він тестується сам по собі й не може стати новим ребром у циклі. Старий `apps/web/src/stores/world-persistence.ts` поглинуто й видалено (не продубльовано).

- `world-map-store.ts`: 886 → **862**; жодного `localStorage` не лишилось.
- `combat-store.ts`: 727 → **711**; **16 викликів `saveToStorage()` → 0**, `useWorldMapStore` 19 → **13** (лишились тільки читання мапи + `revealAroundHero`/`respawnHeroAtCamping`).
- Модулів із прямим `localStorage`: 8 → **7** (усі решта — не світові: hero, ui-settings, user, inventory, i18n, main).
- Формат на диску не змінився: ключі, конверти й текст warn-повідомлень збережені дослівно.

**Замість 16 ручних збережень — одна підписка.** `world-map-store` тепер робить `useCombatStore().$subscribe(...)` (`enableCombatAutosave()`, вмикається в `bootstrapWorld()`). Це прибирає цілий клас багів «додав combat-екшен, забув зберегти». Гідрація захищена: `withoutCombatAutosave()` глушить підписку на час `loadFromStorage`, інакше читання блоба одразу планувало б запис того, що ще вантажиться.

**Тести.** 14 характеризаційних тестів написані **до** переносу (`world-map-persistence.test.ts`) і фіксують не структуру викликів, а сам контракт на диску: точні ключі, конверт, вікно дебаунсу, ізоляцію по `mapId`, знімок стану на момент виклику. Усі 14 пройшли й до, і після переносу. Тест на автозбереження окремо перевірено мутацією (тимчасово знешкодив підписку — тест впав, як і має), щоб він не проходив вхолосту. Разом: web 146 → **160** unit-тестів, e2e 20/20.

#### Чому цикл лишився (і куди його перенесено)

Розділ 2.3 стверджував, що причина циклу — persistence. Це **неправильний діагноз**, перевірений поіменно перед початком робіт. Цикл тримається на чотирьох незалежних зчепленнях, і persistence — лише одне:

**`world-map-store` → `combat-store`:** `buildEngineContext()` проводить combat-порти в engine (`combatActive`, `performHeroCombatAttack`, `placeCombatDefendMarker`); `moveHeroTo` веде облік `combatStepsLeft` і смикає `clearCombatAttackTrace`/`syncEnemyAutoDefend`; `endCombat()` у двох місцях.

**`combat-store` → `world-map-store`:** читання `map`/`getTileAt`/`heroCoordinates`/`isHeroMoving`; `revealAroundHero()`; `respawnHeroAtCamping()`.

Тобто **навіть ідеальне винесення persistence не могло прибрати жоден із двох імпортів** — критерій «`import/no-cycle` без попереджень» був недосяжний у межах цієї фази. Прибрати цикл можна лише разом із `moveHeroTo` та engine-портами (пункт 7 фази **G3**) і оркестрацією бою (**G4**). Доти три цикли лишаються видимими попередженнями — це свідомо, а не забуто.

Урок той самий, що в 3.1: перед розпилом треба дивитись на граф залежностей, а не на здогад про причину.

---

### Фаза G3 — Розпиляти `world-map-store.ts` `[DONE — 10.08.2026]`

**Мета.** 914 рядків / 32 actions → тонкий фасад + іменовані модулі.

**Що робити.** Різати по вже наявних коментарях-роздільниках (2.2), у такому порядку — від найменш зв'язаного до найбільш:

1. `render/tile-dirty-tracker.ts` — dirty-tiles (не має стосунку до домену взагалі).
2. `services/world/respawn-schedule.ts` — розклад респавну.
3. `services/world/location-navigator.ts` — навігація + `router` (шар `apps/web`, у engine не переїжджає).
4. `services/world/world-loop.ts` — `setInterval`-цикл.
5. `packages/engine/src/map/fog-service.ts` — туман війни (чиста функція від мапи й координат → перелік розкритих тайлів; **переїжджає в engine**).
6. `packages/engine/src/hero-movement/spawn-placement.ts` — вибір тайла входу/багаття (чиста функція; `Math.random()` замінити на переданий seed/RNG-порт заради replay).
7. `moveHeroTo` — останнім і через Strangler Fig: правила → engine-команда, анімація → `apps/web`.

Після кожного пункту — окремий комміт, окремий прогін тестів. `world-map-store.ts` лишається фасадом і худне поступово.

**Критерій приймання.** `world-map-store.ts` ≤ 200 рядків; у ньому не лишилось `localStorage`, `setInterval`, `router`, `Math.random()`; кожен витягнутий engine-модуль має unit-тести без Pinia; e2e зелені.

#### Результат G3

`world-map-store.ts`: **886 → 718 рядків** (за весь ланцюжок G2+G3: 886 → 718). Витягнуто вісім модулів, кожен із unit-тестами без Pinia:

| Шов | Модуль                                                 | Рядків | Тестів |
| --- | ------------------------------------------------------ | ------ | ------ |
| 1   | `apps/web/src/render/tile-dirty-tracker.ts`            | 50     | 6      |
| 2   | `apps/web/src/services/world/respawn-schedule.ts`      | 57     | 10     |
| 3   | `apps/web/src/services/world/location-navigator.ts`    | 32     | —      |
| 4   | `apps/web/src/services/world/world-loop.ts`            | 38     | 6      |
| 5   | `packages/engine/src/map/fog-service.ts`               | 98     | 14     |
| 6   | `packages/engine/src/hero-movement/spawn-placement.ts` | 89     | 10     |
| 7   | `packages/engine/src/hero-movement/move-planner.ts`    | 55     | 10     |
| +   | `packages/engine/src/map/resource-hydration.ts`        | 42     | 5      |

Плюс `apps/web/src/services/random-source.ts` — єдиний RNG-порт застосунку.

**Чисті цілі досягнуто повністю:** у сторі не лишилось ані `localStorage`, ані `setInterval`, ані імпорту `router`, ані `Math.random()` (спавн тепер отримує `browserRandom` як залежність, тож правило лишається детермінованим і придатним для replay). Тестів: engine 72 → **111**, web 146 → **182**. E2E 20/20.

**Побічний ефект — прибрано реальне дублювання.** Логіка «знайти вільний тайл поруч із X» існувала у **трьох** копіях (вхід, багаття, фолбек після завантаження), кожна з яких могла розійтися з іншими. Тепер це одна функція в engine.

#### Чому 718, а не ≤ 200

Ціль «≤ 200» недосяжна без порушення антипатерну з 3.4 («розпил за розміром»). План перелічив 7 швів, але не врахував ще ~180 рядків життєвого циклу мапи — `loadFromStorage` (70), `goToLocation` (42), `openLocation` (38), `respawnHeroAtCamping` — які **не є** окремим обов'язком: це послідовності переходів стану, що читають і пишуть саме той стан, яким володіє стор (`map`, `heroCoordinates`, `currentMapId`). Витягнути їх у «сервіс», якому передається стор, означало б створити модуль без власного стану, який неможливо протестувати без стора — тобто провалити практичний критерій із 3.1 і отримати `utils`-звалище.

Реалістична ціль для цього стора — **~400–450 рядків**, і вона досяжна лише після G4: щойно оркестрація бою переїде з `world-map-store`/`combat-store`, `buildEngineContext` і `moveHeroTo` перестануть тягнути combat, і разом із цим нарешті розвалиться цикл. Тобто залишок G3 і G4 — це одна робота, а не дві.

**Старт чату:**

```
Working in hexoflat. Read docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md — sections 2.2, 3.1,
3.2, 3.3, 3.4 and Phase G3. Phase G2 must be done first (check the doc for [DONE]). Do Phase
G3 only: split world-map-store.ts along the seams listed there, one extraction per commit, in
the listed order, leaving the store as a thin facade. Pure rules go to packages/engine with
unit tests; browser/router/timer concerns stay in apps/web. Write characterization tests
before each extraction. No behaviour changes. Dedicated branch. Ask before every commit.
```

---

### Фаза G4 — `combat-store.ts`: витягти чисту логіку (СТРУКТУРНО, без міграції в pipeline)

**⚠️ Межа цієї фази задана дизайном, не інженерією.** Згідно з `CLAUDE.md`, combat свідомо не переводиться на command/event-конвеєр engine, поки не усталився дизайн бою. Ця фаза **не порушує це рішення** й не має його порушити.

**Куди саме в engine, перш ніж почати:** `packages/engine/src/utils/combat/` уже існує (там зараз лише `health-format.ts`), а нижче пропонується новий **top-level** `packages/engine/src/combat/`. Це узгоджено з тим, що `map/` і `hero-movement/` в engine теж top-level, а не під `utils/` — але означає, що `health-format.ts` варто перенести туди ж заради консистентності, а не лишати комбат розділеним на дві директорії. Вирішити це першим кроком фази, а не в процесі.

Що **можна** зараз (чисте перенесення, нуль дизайнерських рішень):

- `packages/engine/src/combat/damage-calculator.ts` — підрахунок шкоди з урахуванням блоку (зараз розмазано між `performHeroCombatAttack` і `ensureEnemyTurnResolution`, з дубльованою формулою в обох).
- `packages/engine/src/combat/enemy-ai.ts` — вибір цілі й відступу як **чиста функція** `(мапа, позиція, бюджет кроків, rng) → рішення`. Виконання рішення (рух, `await`, збереження) лишається в сторі.
- `packages/engine/src/combat/combat-rules.ts` — предикати `canAttack` / `canPlaceDefendMarker` / `hasLivingEnemies`.
- `packages/engine/src/combat/health-format.ts` — перенесено з `utils/combat/` заради тієї ж консистентності.
- `apps/web/src/services/combat/enemy-turn-runner.ts` — оркестрація ходу ворога з анімаціями (те, що лишилось від 170-рядкового методу).
- **RNG-порт замість `Math.random()`** — навіть без міграції в pipeline це прибирає недетермінізм і робить AI тестованим.

Що **не** робити: не заводити нові combat-команди в `applyCommand`, не змінювати `CombatSnapshot`, не чіпати правила балансу.

**Критерій приймання.** `combat-store.ts` ≤ 250 рядків; жодного `Math.random()` у ньому; формула шкоди існує в рівно одному місці; AI ворога має детерміновані unit-тести з фіксованим seed; поведінка в грі не змінилась.

**Старт чату:**

```
Working in hexoflat. Read docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md — sections 2.3, 3.3,
3.4 and Phase G4, and the combat note in CLAUDE.md. Phase G2 must be done first. Do Phase G4
only, and respect its hard boundary: extract pure combat logic (damage calculation, enemy AI
decision-making, rule predicates) into packages/engine as pure functions with an injected RNG
port, and keep orchestration in apps/web. packages/engine/src/utils/combat/ already exists
(health-format.ts) — decide up front whether combat becomes a top-level packages/engine/src/combat/
dir (moving health-format.ts there too) or everything stays under utils/combat/, and apply that
consistently rather than splitting combat logic across both. Do NOT migrate combat onto the
engine command/event pipeline and do NOT add combat commands to applyCommand — that is
deliberately deferred until the combat design is settled. No behaviour changes. Dedicated
branch. Ask before commit.
```

---

### Фаза G5 — Розпиляти `hero-inventory-store.ts`

**Мета.** Розділити три незв'язані групи з 2.5.

**Що робити.**

- `packages/engine/src/inventory/` — правила стаків/ваги/місткості як чисті функції (частина вже є в `utils/inventory/traits-resolver.ts` — доповнити, а не створювати паралельний модуль).
- `apps/web/src/composables/use-inventory-drag.ts` — уже існує й **уже використовується**; перенести туди решту 10 полів `drag*` зі стора. Drag-стан не має бути в Pinia взагалі.
- Persistence — через шар із G2.
- `Math.random()` для обертання токенів — це суто візуальне, домену не стосується; винести в рендер-шар.

**Критерій приймання.** `hero-inventory-store.ts` ≤ 200 рядків; жодного `drag*`-поля в state; правила стаків мають unit-тести без Pinia.

**Старт чату:**

```
Working in hexoflat. Read docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md — sections 2.5, 3.1,
3.3 and Phase G5. Phase G2 must be done first. Do Phase G5 only: move stacking/weight/capacity
rules into packages/engine (extending the existing utils/inventory/traits-resolver.ts, not
duplicating it), move the 10 drag* state fields out of the store into the existing
use-inventory-drag.ts composable, and route persistence through the G2 layer. No behaviour
changes. Dedicated branch. Ask before commit.
```

---

### Фаза G6 — Затягнути храповик

**Мета.** Зафіксувати результат, щоб він не відкотився.

**Що робити.**

- Знизити пороги `max-lines`/`complexity` з G0 до нових фактичних значень.
- `import/no-cycle` перевести з `warn` на `error`.
- Додати `no-restricted-syntax` для `apps/web/src/stores/**`: заборонити прямий `localStorage` (є шар із G2) і `Math.random()` (є RNG-порт) — за зразком уже наявного правила для `apps/playwright/e2e/**`, яке в цьому репозиторії довело, що такі бар'єри працюють.
- Оновити таблицю «було/стало» в цьому файлі й додати абзац у `CLAUDE.md`.

**Критерій приймання.** Порушення архітектурних меж падає в CI, а не виявляється на код-рев'ю.

**Старт чату:**

```
Working in hexoflat. Read docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md — Phase G6. Phases
G0–G5 must be done. Do Phase G6 only: ratchet the ESLint thresholds down to the new actual
values, turn import/no-cycle into an error, add no-restricted-syntax rules banning direct
localStorage and Math.random() inside apps/web/src/stores/**, and update the before/after
table in the doc plus a short note in CLAUDE.md. Dedicated branch. Ask before commit.
```

---

## Частина 5 — Цільові цифри

| Файл                                          | Було (10.08.2026, `wc -l`)                       | Ціль                |
| --------------------------------------------- | ------------------------------------------------ | ------------------- |
| `world-map-store.ts`                          | 886 рядків, 32 actions                           | ≤ 200, фасад        |
| `combat-store.ts`                             | 727 рядків, 25 actions, 19× `useWorldMapStore()` | ≤ 250, 0 циклів     |
| `hex-world-map.vue`                           | 688 рядків (577 script)                          | ≤ 400 — ✅ 394 (G1) |
| `hero-inventory-store.ts`                     | 589 рядків, 30 actions                           | ≤ 200               |
| Циклів у `apps/web/src`                       | 3 (виміряно в G0, не 1)                          | 0                   |
| Модулів із прямим `localStorage` (без тестів) | 8                                                | 1                   |
| `Math.random()` у сторах                      | 7 місць у 4 сторах                               | 0 в ігрових сторах  |
| Composables без імпортерів                    | 3 (379 рядків)                                   | 0 — ✅ 0 (G1)       |

Уточнення щодо `Math.random()`: 3 виклики в `combat-store.ts` (вибір цілі, відступ, авто-щит), 2 в `hero-inventory-store.ts` (вибір вільного слота, обертання токена), 1 у `world-map-store.ts` (вибір тайла спавну), 1 у `game-events-store.ts` (генерація id події). Критичні для детермінізму — перші чотири (вони впливають на ігровий стан). Обертання токена й id події — косметика й можуть лишитись, але поза сторами.

---

## Що це дає, окрім чистоти

Кожна фаза, яка переносить правило з `apps/web/src/stores/` у `packages/engine`, — це правило, яке після переносу автоматично:

- доступне серверу для авторитетної валідації в co-op;
- потрапляє в replay і snapshot;
- тестується без Pinia, без jsdom, без браузера;
- перестає бути причиною розсинхрону між клієнтами.

Тобто це не «прибирання перед гостями», а фактична підготовка до drop-in/drop-out мультиплеєра, який заявлений архітектурним правилом #4.
