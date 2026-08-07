# Hexoflat — план старту gameplay-фіч (vertical slice)

Цей документ фіксує підсумок брейншторм-сесії (5–6 серпня 2026) між Oleh і Claude: узгоджені дизайнерські рішення й порядок, з якого починається розробка контенту та тактичних механік поверх уже готової інфраструктури (`packages/engine`, `apps/web`, `apps/api` — див. [`MIGRATION-PLAN.md`](./MIGRATION-PLAN.md) для інфраструктурних фаз, які вже завершені).

На відміну від `MIGRATION-PLAN.md` (інфраструктура), тут — **фази геймплейного контенту**: токени, картки, кубики, тактичні механіки руху й взаємодії, прогресія героя. Дослідницька основа — обидва scout-звіти в [`docs/design/`](./design/).

**Робоче правило: кожна фаза нижче — це один окремий чат.** Не змішувати кілька фаз в одній розмові. Кожна фаза має власний "старт чату" — блок тексту, який можна скопіювати в нову розмову, щоб почати саме цю фазу й нічого більше. Питати дозвіл перед `git commit` лишається чинним на кожному кроці (стандартне правило проєкту).

Прогрес фіксується прямо в цьому файлі: коли фаза завершена, дописати `[DONE — дата]` в заголовок відповідної фази.

---

## Частина 1 — Узгоджені дизайнерські рішення

### 1.1. Категорії контенту

Увесь "фізичний" контент гри — це Zod-схеми в `packages/engine/src/content/`, версіоновані так само, як уже існуючі `resources`/`creatures`/`equipment`/`tools`/`constructions`/`loot`. Нові категорії, яких зараз немає:

- **Документація** — не лише зовнішні `docs/design/*.md`, а й ігровий контент-тип "довідка" (glossary/tooltip записи, що відкриваються по кліку на термін — принцип "Rulebook in context" з першого scout-звіту, розділ 7.4).
- **Токени** — підкатегорії, кожна зі своєю логікою прив'язки до стану:
  - токен героя (візуальна ідентичність, окремо від `HeroModel`);
  - токени ресурсів (вже є через hexobject resources);
  - токени навичок (нові);
  - токен годинника/раунду (новий — зараз є лише `heroSteps`, немає поняття "раунд сценарію");
  - токени статусів (нові);
  - маркери дії (частковий прототип уже є — `CombatMarker` у `combat-store.ts`: `attack-trace`, `defend`);
  - токени ініціативи (нові).
- **Картки** — ability-картки, event/quest-картки, item-картки. Зараз немає жодної.
- **Кубики** — новий контент-тип + **обов'язково seeded RNG-команда** в engine (не `Math.random()` у сторі), інакше ламається replay/multiplayer sync (rule #1 з `CLAUDE.md`). Кандидат для seed-хешування — вже наявний `utils/hash/sha256.ts`.

### 1.2. "Наглядач" — невидима роль стола

Концептуальна межа між **грою** (детермінований engine + сервер) і **столом** (рендер-шар). Не окремий персонаж, а робоче ім'я для набору обов'язків, які фізично виконував би людина-ведучий за настільним столом: розстановка токенів на старті сценарію, ведення годинника/раундів, показ AI-намірів ворогів (уже частково закладено як "AI intent overlay" у першому scout-звіті), контекстна довідка, event-лог, анімація переміщення фішок.

Working-назва: **"Наглядач"** — умовна, не з жодної існуючої гри; можна поміняти пізніше, це не архітектурне рішення, а лише термін для дизайн-документації.

### 1.3. Кожна механіка — окрема тактична гра, не клік

Ключовий принцип, узгоджений в розмові: механіки не повинні зводитись до "клікнув → сталося". Конкретні ідеї, які лягають в основу фаз D і E нижче:

- **Планування шляху з попереднім переглядом.** Гравець намічає маршрут через кілька гексів; система показує вартість (кроки) і ризик (шум, видимість) до підтвердження — і лише після підтвердження шлях виконується.
- **Шум і виявлення.** Дії типу рубання дерева чи видобутку руди створюють радіус шуму, здатний привабити ворога поблизу — вибір між "швидко-й-гучно" і "повільно-й-тихо" стає тактичним рішенням.
- **Кут підходу.** Якщо до обʼєкта можна підійти з кількох сусідніх гексів, кожен варіант дає різну експозицію (лінія видимості ворога, укриття рельєфом) — вибір гекса для взаємодії стає значущим, а не довільним.
- **Хід як запрограмована послідовність.** Гравець збирає коротку послідовність дій на хід і підтверджує її одним пакетом; рушій виконує крок за кроком і може перервати послідовність реактивним тригером.
- **Дія через токен, а не автоклік.** Дія вибирається як токен із властивостями (ефективність/шум/знос), а не виконується миттєво без рішення.

### 1.4. UI: спліт-скрін замість оверлея

Поточний стан: клік на токен героя відкриває `hero-inventory-overlay.vue` як модалку (backdrop + overlay-store). Узгоджена зміна:

- **Desktop / landscape** — дошка інвентаря докована постійно поруч із мапою (немає backdrop, немає модального перекриття), тобто "дві дошки" видно одночасно з початку гри — метафора фізичного стола (ігрове поле + дошка гравця поруч).
- **Reflow гріда.** Поточний грід інвентаря — 12×7 із заблокованою "дірою" 6×5 в центрі (рамка: верхній ряд на 12 комірок, нижній ряд на 12 комірок, дві бічні смуги 3×5). У вузькій вертикальній панелі верхній і нижній ряди рамки стають смугами швидкого доступу (екіпіровка/витратні предмети) зверху й знизу нової вужчої-й-вищої панелі, а бічні смуги схлопуються в центральну "paperdoll"-рамку. Точний вигляд — за референсом від Oleh (див. нижче), не за першою пробною версією.

**Mobile/portrait — свідомо відкладено (рішення від 6 серпня 2026).** Адаптивний layout для вузьких/портретних екранів не робимо зараз і не закладаємо в критерії приймання жодної з фаз нижче. Повертаємось до нього тільки після того, як на web/desktop буде готовий перший логічно цілісний сценарій/механіка (тобто коли вже є що адаптувати, а не абстрактний layout заздалегідь). До того моменту поточна overlay-поведінка на вузьких екранах лишається як є, без спеціальної підтримки чи тестування.

**Візуальний референс.** Перша пробна версія макета (HTML-прев'ю з перемикачем Desktop/Mobile) не підійшла — Oleh покаже власний референс пізніше. Фаза 0 нижче не стартує реалізацію конкретного вигляду, поки цей референс не буде наданий і узгоджений.

---

## Частина 2 — Фази (кожна = окремий чат)

### Фаза 0 — UI layout: спліт-скрін мапа + дошка [ЧЕКАЄ РЕФЕРЕНС]

**Статус.** На паузі — Oleh готує власний візуальний референс для дошки (перша пробна версія від Claude не підійшла). Не стартувати цю фазу, поки референс не буде показаний і узгоджений тут же в документі.

**Мета.** Перетворити модальну дошку інвентаря на доковану панель на desktop (без backdrop). Mobile/portrait — поза скоупом цієї фази, див. рішення в 1.4.

**Що робити (після узгодження референсу).**

- Винести вміст `hero-inventory-overlay.vue` (без backdrop/модального стеку) у нову доковану панель-компонент поруч із `hex-world-map.vue` у layout map-сцени.
- Reflow `inventory-board-grid.vue` за узгодженим референсом (не за старим HTML-прев'ю).
- Desktop-only: не додавати responsive/breakpoint-логіку зараз; `overlay-store` лишається для правді-модальних речей (`settings-overlay`, `hex-tile-details-overlay`) без змін.
- Оновити/додати `data-testid` хуки під нову структуру.

**Критерій приймання.** На desktop дошка видна одночасно з мапою без backdrop; ручна перевірка відповідає узгодженому референсу (не старому прев'ю); mobile не тестується й не блокує приймання.

**Старт чату (тільки після узгодження референсу):**

```
Working in hexoflat. Read docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md — Part 1 (all subsections,
note the mobile-deferred decision in 1.4) and Phase 0 only. A visual reference for the
docked board has been agreed with Oleh separately — use it exactly, don't invent layout
or colors. Implement the split-screen layout: dock the hero inventory board as a
persistent side panel next to the map (no backdrop, no modal overlay-store entry for
it). Reflow inventory-board-grid.vue per the agreed reference. Desktop-only — no
responsive/mobile breakpoint work. Ask before git commit. Do not touch any other phase
from that doc.
```

---

### Фаза A — Контент-таксономія (tokens / cards / dice схеми)

**Мета.** Формалізувати нові Zod-контент-категорії з розділу 1.1, без UI — лише схеми і content-map, як зараз для resources/creatures.

**Що робити.** Додати Zod-схеми й content-map записи для: hero-токена (візуальні властивості), clock/round-токена, skill-токена, status-токена, initiative-токена, ability/item/event карток, кубика + команда `rollDice`/аналог у `commands/` з seeded RNG (на основі `sha256.ts`), покрита юніт-тестами (детермінованість: однаковий seed → однаковий результат).

**Критерій приймання.** `pnpm --filter @hexoflat/engine build` і `test` проходять; нові категорії присутні в `content-map.ts`/`index.ts`; кидок кубика детермінований при фіксованому seed (тест це перевіряє).

**Старт чату:**

```
Working in hexoflat. Read docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md — Part 1.1 and Phase A
only. Add new Zod content categories to packages/engine/src/content/ per the
description: hero token, clock/round token, skill token, status token, initiative
token, ability/item/event cards, and a dice content type + a seeded-RNG dice-roll
command (build on utils/hash/sha256.ts) with unit tests proving determinism for a
fixed seed. No UI work — schemas and engine only. Ask before git commit. Do not touch
any other phase from that doc.
```

---

### Фаза B — Вибір токена героя

**Мета.** Нова сцена вибору героя: галерея токенів, привʼязка візуального токена до `HeroModel` і стартових статів/класу.

**Що робити.** Нова сцена (аналогічно `login-scene`), список доступних hero-токенів (з контенту Фази A), вибір записується в стан гравця/кампанії перед входом у камп.

**Критерій приймання.** Гравець може обрати токен героя перед стартом; вибір персистентний (переживає reload); привʼязка до `HeroModel` коректна.

**Старт чату:**

```
Working in hexoflat. Read docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md — Phase B only
(Phase A must already be done — hero token content type exists). Build a hero token
selection scene: gallery of available hero tokens, selection persists and binds to
HeroModel + starting stats/class. Ask before git commit. Do not touch any other phase.
```

---

### Фаза C — Поява в кемпі

**Мета.** Camp-сцена як hub між сценаріями — герой "прибуває" туди після вибору токена; природне місце для майбутнього asynchronous-outpost шару (перший scout-звіт, 14.5).

**Старт чату:**

```
Working in hexoflat. Read docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md — Phase C only
(Phases A and B must already be done). Build a camp/home-base scene: the selected
hero token visibly arrives there after selection; this scene is the hub between
scenarios. Keep scope minimal — no crafting/building systems yet, just the hub scene
and hero-arrival state. Ask before git commit. Do not touch any other phase.
```

---

### Фаза D — Тактичне планування шляху

**Мета.** Поглибити вже наявний hex-рух: замість миттєвого переміщення по кліку — планування маршруту з попереднім переглядом вартості й ризику, підтвердження, і лише тоді виконання (розділ 1.3).

**Що робити.** Розширити `pathfinding-service.ts`/`reachable-range-service.ts`: preview-шлях перед комітом, показ вартості (кроки) і ризику (заглушка "шум"/"видимість" — повне визначення цих параметрів узгоджується на початку цієї фази, не заздалегідь).

**Старт чату:**

```
Working in hexoflat. Read docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md — Part 1.3 and Phase D
only. Current hex movement is instant-on-click (see reachable-range-service.ts,
pathfinding-service.ts). Propose a concrete technical design for path-planning-with-
preview (route commit before execution, cost/risk shown first) and get it approved
before implementing. Ask before git commit. Do not touch any other phase.
```

---

### Фаза E — Тактична взаємодія з обʼєктами

**Мета.** Перетворити інстант-клік збору ресурсів на мікрорішення: шум/виявлення + кут підходу (розділ 1.3).

**Старт чату:**

```
Working in hexoflat. Read docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md — Part 1.3 and Phase E
only (Phase D should already be done). Propose a concrete technical design for
noise/detection radius on gathering actions and approach-angle-matters interaction,
get it approved before implementing. Ask before git commit. Do not touch any other
phase.
```

---

### Фаза F — Годинник раунду + токен ініціативи

**Мета.** Видимий трекер раунду сценарію — фундамент під майбутній бойовий vertical slice (пов'язано з gap, зафіксованим у `CLAUDE.md`: combat design ще не завершено).

**Старт чату:**

```
Working in hexoflat. Read docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md — Phase F only
(Phase A must already be done — clock/round and initiative token content types
exist). Add a visible round/turn tracker for a scenario, built on those token types.
Ask before git commit. Do not touch any other phase.
```

---

### Фаза G — Токени навичок

**Мета.** Мінімальний набір skill-токенів, привʼязаний до героя — фундамент під майбутню прокачку (другий scout-звіт, розділ 7.7).

**Старт чату:**

```
Working in hexoflat. Read docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md — Phase G only
(Phase A must already be done). Add a minimal set of skill tokens bound to the hero.
Ask before git commit. Do not touch any other phase.
```

---

### Фаза H — Кубики (UI + forecast)

**Мета.** Hex-кубик у рендері поверх уже готової seeded-RNG команди з Фази A, з попереднім переглядом шансів (Tactical Forecast, перший scout-звіт 7.1/14.1).

**Старт чату:**

```
Working in hexoflat. Read docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md — Phase H only
(Phase A must already be done — seeded dice-roll command exists). Add the hex-dice
visual/UI on top of the existing engine command, with an odds preview shown before
commit. Ask before git commit. Do not touch any other phase.
```

---

### Фаза I — Картки (hand UI)

**Мета.** Ability/item/event картки з Фази A отримують UI + hand management — точка, куди врешті підключиться бойовий vertical slice.

**Старт чату:**

```
Working in hexoflat. Read docs/GAMEPLAY-VERTICAL-SLICE-PLAN.md — Phase I only
(Phase A must already be done — card content types exist). Add card hand UI for
ability/item/event cards. Ask before git commit. Do not touch any other phase.
```

---

## Джерела рішень

- [`docs/design/gloomhaven-frosthaven-scout-report.md`](./design/gloomhaven-frosthaven-scout-report.md)
- [`docs/design/tactical-coop-dungeon-crawler-scout-report.md`](./design/tactical-coop-dungeon-crawler-scout-report.md)
- Брейншторм-розмова 5–6 серпня 2026 (Oleh + Claude) — узгодження контент-таксономії, ролі "Наглядача", тактичних принципів руху/взаємодії, і UI-рішення спліт-скрін.
