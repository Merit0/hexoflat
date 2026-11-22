# Path of Will — здобич зі скринь і могил (етап 1, специфікація для Claude Code)

> Гра: **Path of Will** (репозиторій `hexoflat`). Складено 2026-11-12.
> Основа: `docs/roadmap-after-r0.md` (етап 1), «Результати R0» у `docs/release/FIRST-RELEASE-CHECKLIST.md`. `architecture/domain-model-plan.md` у репозиторії **немає** (DM0/DM1 не виконані).
> Складено без перегляду коду; **L0 виконано 2026-11-13**, назви нижче виправлено за кодом (див. «Результати L0»). Шлях цього файлу — `docs/loot-plan.md` (не `docs/features/`).
> **Редакція 2 (2026-11-13):** застосовано рішення Олега Q-1…Q-5 та правила нижче; фази L2–L4 розбито на L2a/L2b/L2c та L3a/L3b.
> Гілку створює Олег. **Не комітити.** Одна фаза = один чат. Скіли: `hexoflat-phase`, `hexoflat-engine`, `hexoflat-web-state`, `hexoflat-render`, `hexoflat-e2e`.

---

## 0. Мета

Зараз з підземелля нічого не випадає: скриня лише «відмикається», а перемога над загоном просто прибирає жетон (`squad.loot` ніхто не читає). Після цього етапу коло замкнене:

```
підземелля → бій → могили → здобич → скриня → здобич → торговець → монети → спорядження
```

Це також закриває рядок чекліста «перше джерело монет».

## 1. Правило (рішення Олега 2026-11-12, уточнено 2026-11-13)

### 1.1 Спільне для скрині й могили

1. **Ціль** — повна скриня або неоглянута могила. Герой стоїть на сусідньому гексі `E` (гекс входу).
2. **Дія** запускається лише з кільця інструментів: у світі **рука → OPEN** (`EHexActionType.OPEN`), у бою **`LOOT_GRAVE`** (нова `BattleAction`). Мітка на кільці в обох випадках лишається **оком** (`tool.read`). Дія нічого не показує, вона лише запускає подію.
3. **Герой безплатно переходить на гекс цілі** — це частина самої дії, не окремий крок. Об'єкт не зникає: фішка героя стоїть на ньому зверху. Ціна самої дії береться з контенту: **OPEN скрині коштує 2 Волі** (`willCost: 2`, значення в контенті не змінюється), `LOOT_GRAVE` безплатна.
4. **Вільні місця** — сусіди гекса цілі, які одночасно: є на дошці, прохідні, без об'єкта, предмета, могили, істоти чи героя, і не є гексом `E`.
5. **Один розіграш на ціль.** Повний список здобичі розігрується **один раз на ціль** і лише потім обрізається: на вільні місця кладеться `min(довжина списку, вільні місця)` записів; зайві **гарантовані** записи йдуть у сумку (п.11), зайві **розіграні** відкидаються з кінця (LOOT-OVF, 2026-11-14). Розіграш детермінований (п.10), тому повтор після відмови `NO_ROOM_FOR_LOOT` дає **той самий** список.
6. **Злиття монет.** Усі записи монет зливаються в **один стос** до обрізання, на місці **першого** запису монет у списку. Стос монет — один предмет на один гекс, скільки б монет не було.
7. **Порядок розкладання — за годинниковою стрілкою на екрані** (рішення Олега 2026-11-13, замінює попереднє «за масивом»). `AXIAL_DIRS` (`packages/engine/src/utils/hex-utils.ts:28`) на екрані йде **проти** годинникової (схід → північний схід → північний захід → захід → південний захід → південний схід), тому обхід іде за **спаданням індексу** `AXIAL_DIRS`, починаючи з сусіда `(індекс E − 1) mod 6`. Той самий масив використовують `getHexNeighbors` (світ, odd-r, pointy-top) і `hexNeighbours` (бій), тож правило однакове в обох. Тест перевіряє порядок рукописними очікуваннями «за екраном», не обчисленими з масиву. Випадковості в розкладанні немає.
8. **Предмети на гексах лишаються `SOLID`** (як зараз). Герой підбирає здобич (`TAKE`) з гекса цілі **або з будь-якого сусіднього гекса**.
9. **Після дії** ціль стає **порожньою**: взаємодіяти не можна, стати на неї не можна. Герой сходить з неї на будь-який вільний сусідній гекс і повернутися вже не може.
10. **Дію відхилено, поки герой стоїть на гексі скрині чи могили** (будь-якої, повної чи порожньої): окрема причина відмови (пропонована назва `STANDING_ON_TARGET`). Перевіряється до списання Волі й до будь-якого переходу.
11. **Гарантований запис не губиться** (LOOT-OVF, 2026-11-14; замінює «гарантовані на `E`» і «лише при нулі місць»). Записи кладуться по порядку на вільні місця; **гарантовані (після злиття монет), що не вмістились, йдуть у сумку** (`toBag`), розіграні, що не вмістились, відкидаються. Результат може мати й `placements`, і `toBag` разом; нуль місць — те саме правило, не окрема гілка (усі гарантовані в сумці). Гекс `E` не отримує нічого ніколи. Якщо місць нуль і гарантованих немає, дія відхиляється до переходу героя з причиною `NO_ROOM_FOR_LOOT`, ціль лишається повною, Воля не списується. Сумка перевіряється на **весь** список `toBag` до переходу героя й до списання Волі: не вміщається — `BAG_FULL`, стан не змінюється, повтор дає той самий список, часткової видачі нема.
12. **Рахує сервер.** Потік випадковості `loot:<id карти або бою>:<ключ цілі>` від прихованого серверного сіда; клієнт сіда не бачить. Відкрити можна один раз. Повтор команди з тим самим `commandId` повертає позначку **`replayed: true`** (вона вже є у відповіді світових команд, `world.service.ts:185-201`) і **без** `tileDiffs`/`effects`/`hero`; клієнт, побачивши `replayed`, **перечитує проєкцію карти** (`GET /player/world`). `tileDiffs` у журнал **не зберігаємо**. Дві різні `commandId` одночасно: виконується одна, друга отримує відмову (порожня ціль), бо команди серіалізуються `lockExpedition`.
13. **Наведення** показує картку об'єкта із загальним описом і одним реченням правила без чисел: «здобич розлітається на вільні місця навколо; у тісноті зайве потрапляє в сумку, а випадкове пропадає». Порожня ціль має печатку «порожньо».

Як це робиться за столом: зняти з цілі жетон «повна», поставити фішку героя на ціль, витягти з мішечка весь список жетонів здобичі, склавши монети в один жетон; що не вміщається на вільні гекси навколо: гарантоване кладеться в сумку, випадкове прибирається з кінця списку; розкласти за годинниковою стрілкою від гекса, з якого прийшов герой.

### 1.2 Скриня (карта підземелля)

- Дія `OPEN` рукою, **2 Волі**; герой переходить на гекс скрині в тій самій дії.
- Відкрита скриня лишається на карті як `SOLID`-перешкода з іншим спрайтом (відкрита кришка): новий гексобʼєкт «відкрита скриня» (ключ додається в `HEXOBJECT_KEYS`; старі збережені скрині відкриваються за новим правилом, без міграції).
- Генератор ставить скриню так, щоб у неї було **щонайменше 3 прохідні сусіди без об'єктів**.
- Здобич лежить на карті підземелля, доки герой у ньому. Підземелля свіже на кожен вхід, тож незібране пропадає при виході.
- Повна сумка при підборі: предмет **лишається на гексі** (як зараз у `TAKE`), гравець бачить причину.

### 1.3 Могила (карта бою)

- **Могили стають обʼєктами стану бою в момент перемоги**: одна могила на гекс, де помер ворог. Якщо на одному гексі померло кілька (другий міг упасти на гекс першого), це **одна могила зі склеєними списками здобичі** (кожна таблиця розігрується окремо, списки склеюються в порядку смерті, далі злиття монет і обрізання за п.5–6). Гекс з могилою не є вільним місцем для здобичі сусідніх могил.
- Герой, що в момент перемоги стоїть на гексі могили, **спершу мусить зійти** з неї (кроки безплатні), лише потім може діяти.
- Після перемоги бій переходить у **фазу збирання**: кроки героя безплатні (не коштують ні Волі, ні бойової Волі), пастки вимкнені, вороги відсутні.
- Дія `LOOT_GRAVE` на сусідню могилу. Безплатна.
- **Вихід з поля бою** — наявна безплатна команда `WORLD_BATTLE { kind: 'close' }` (`world/battle-world.ts:192`). Після виходу жетон загону прибирається з карти підземелля, гекс стає вільним.
- Незібране на полі бою пропадає. Перед першим у житті героя виходом з незібраною здобиччю гра один раз попереджає (віха в `progress`).
- Поразка: фази збирання немає.
- Відновлення сесії повертає гравця у фазу збирання з тим самим розкладом здобичі (розклад зберігається в стані бою, не перераховується).

### 1.4 Таблиці здобичі

```ts
interface LootTable {
  id: LootTableId;
  rolls: [min: number, max: number]; // скільки жетонів витягти
  guaranteed?: LootEntry[]; // завжди випадає (бос)
  entries: { itemKey: THexobjectKey; weight: number; amount: [number, number] }[];
}
```

- **Таблиця на істоту**, не на загін. `CreatureDefinition` не існує: істоти бою — записи `battle/battle-catalogue.ts` (`skeleton-warrior`, `skeleton-archer`, `skeleton-king`), тож поле `lootTableId` додається туди (опційне, additive). Поле `squad.loot` (`ISquad`, один `THexobjectKey`) стає зайвим і прибирається в L5.
- Скриня: нове опційне поле `construction.lootTableId` у `constructionSchema` (`content-schema.ts:155`). `ObjectCapability.container` у коді немає.
- Початковий контент (числа в контенті, не в коді):

| Ціль                | `rolls` | Склад                                                                                       |
| ------------------- | ------- | ------------------------------------------------------------------------------------------- |
| Скелет-воїн         | 1–2     | монети (часто), зілля здоров'я, кістяний оберіг                                             |
| Скелет-лучник       | 1–2     | монети, зілля, сувій (рідко); лучник є в `battle-catalogue`, але в печері не розставляється |
| Скелет-король (бос) | 3–4     | гарантовано монети; далі меч, щит, сувій                                                    |
| Скриня печери       | 2–4     | монети, зілля, спорядження                                                                  |

- Пляшки енергії й мани в таблиці не входять, доки не працюють у бою.
- Продаж дерева й каменю в цей етап **не входить** (див. §5).

## 2. Фази

Одна фаза = один чат, кожна закінчується придатною до гри збіркою або зеленими тестами. `CONTENT_VERSION` не піднімати без окремого рішення Олега.

| Фаза                                               | Що                                                                                                                                                                                                                     | Межі                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **L0 — Звірка** [DONE 2026-11-13]                  | Знайти в коді все з §3; відповісти на питання; оновити назви                                                                                                                                                           | без змін коду                                        |
| **L1 — Правило в engine** [DONE 2026-11-13]        | `LootTable` + Zod, чиста функція розкладання (вхід: гекс цілі, гекс `E`, зайнятість сусідів, таблиця, rng; вихід: список «гекс → предмет» або `Refusal`), тести                                                        | лише нові файли в `packages/engine/src/loot/`        |
| **L2a — Скриня відкривається** [DONE 2026-11-13]   | `OPEN` більше не відмовляє; «відкрита скриня» як гексобʼєкт; герой може стояти на гексі з обʼєктом; кількість на екземплярі предмета, `TAKE` бере весь стос; відмова `STANDING_ON_TARGET`; здобичі ще немає            | engine (`registry/`, `content/`, `map/`, `world/`)   |
| **L2b — Здобич скрині на сервері**                 | команда відкриття на сервері через L1, таблиця скрині, правило генератора «≥ 3 сусіди», позначка `replayed`, API-тести                                                                                                 | engine `world/` + `apps/api` + контент печери        |
| **L2c — Скриня на клієнті** [DONE 2026-11-13]      | анімація вильоту, спрайт відкритої скрині, картка наведення, переклади відмов uk/en, перечитування карти на `replayed`, e2e                                                                                            | `apps/web` + `apps/playwright`                       |
| **L3a — Могили й фаза збирання** [DONE 2026-11-13] | могили в стані бою в момент перемоги, фаза збирання, `LOOT_GRAVE`, підбір у бою, вихід через наявний `close`, віха попередження, відновлення сесії                                                                     | engine `battle/` + `squads/` + `world/` + `apps/api` |
| **L3b — Могили на клієнті** [DONE 2026-11-14]      | кнопка/мітка ока на полі бою, спрайт оглянутої могили, анімація вильоту, одноразове попередження, переклади, e2e                                                                                                       | `apps/web` + `apps/playwright`                       |
| **L5 — Контент і економіка** [DONE 2026-11-14]     | таблиці здобичі в `battle/battle-catalogue.ts` і для скрині, прибрати `squad.loot`, тести економіки: симуляція 10 000 забігів за монети, «купити → продати ніколи не дає плюс» навіть при максимальній знижці магазину | контент + тести                                      |

L4 з редакції 1 розподілено між L2c і L3b. L5 іде після L3b, але таблиці можна наповнювати й раніше, якщо L2b/L3a вже зелені.

### Залежності квестів

Фаза Q3 «Шукача скарбів» уже виконана **без здобичі**. Справжня здобич скрині в фазі `collect` підключається після **L2b**. Фаза Q5 (засідка) потребує **L3a**. Оновлено в `docs/quest-board/more-detailed-treasure-seeker-plan.md` (файлу `docs/features/treasure-seeker-plan.md` немає).

### 2.1 Промпти фаз (вставляти в новий чат Claude Code)

Спільне: гілка поточна, нових гілок не створювати, **не запускати `git commit`**, шляхи реальні (`docs/loot-plan.md`). Спершу характеризаційні тести на наявну поведінку, потім зміна. Наприкінці: `[DONE — дата]` у заголовку фази, рядок у журналі, оновити скіли `.claude/skills/*` і `CLAUDE.md`, зупинитись. Результати L0 вважати джерелом назв файлів. Після змін engine виконати `pnpm build` у `packages/engine`.

#### L1

```text
Phase L1 of docs/loot-plan.md (hexoflat / Path of Will). Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine.
Read the whole plan incl. "Результати L0" first.

Only NEW files in packages/engine/src/loot/ (+ one export line in packages/engine/src/index.ts). No change to existing behaviour.
1. loot-table.ts: Zod LootTable { id, rolls [min,max], guaranteed?, entries { itemKey: THexobjectKey, weight, amount [min,max] } } validated against HEXOBJECT_KEYS and content (items must exist).
2. plan-loot-spread.ts: pure function. Input: target hex (axial), E hex (axial, must be a neighbour of the target), a predicate or set telling which neighbours are free (on board, passable, no object/item/grave/creature/hero, not E), the list of LootTable(s) (a concatenated list for a multi-death grave), a RandomNumberGenerator injected (use deriveStream from utils/random-seeded; never Math.random). Output: ordered list { hex, itemKey, amount } or a refusal { reason: 'NO_ROOM_FOR_LOOT' }.
3. Rules to implement exactly as §1.1: roll the FULL list once (rolls, guaranteed first, weighted entries), merge all coin entries into one stack at the position of the first coin entry, THEN truncate to min(list length, free places); order = screen-clockwise = DEscending index in AXIAL_DIRS (packages/engine/src/utils/hex-utils.ts:28) starting at (index of E - 1) mod 6; E never gets an item; zero free places: guaranteed drops go to a "to-bag" result and rolled ones are discarded, no guaranteed drops -> NO_ROOM_FOR_LOOT. Work in axial coordinates; offset conversion belongs to L2b.
4. Tests (Vitest, no Pinia): every bullet of §4 "Engine" incl. same seed + same target id => same list, retry-after-refusal gives the same list, coins merged at first coin position, order fixed by AXIAL_DIRS indices (not by screen), guaranteed kept first when truncating.
Acceptance: engine lint/typecheck/test green, nothing else touched. Tell Oleh in Ukrainian about every conflict, journal row, stop.
```

#### L2a

```text
Phase L2a of docs/loot-plan.md. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine, hexoflat-web-state.
Read the whole plan incl. "Результати L0" first.

Goal: the cave chest becomes openable, with no loot yet.
1. registry/action-starters-registry.ts:281 — OPEN no longer answers "broken"; handle the chest like squad actions (applyStartHexAction hands them to a dedicated starter) so the server path actWorld (world/world-commands.ts:173) runs it; Will 2 stays from content (constructions.content.ts:189).
2. New hexobject "open chest": key in registry/hexobjects-registry.ts, content in content/constructions.content.ts (SOLID, not interactable, tag-free so the cave generator ignores it), sprite placeholder = the closed chest sprite until Oleh supplies the open one (do not invent art). OPEN replaces the chest with it and moves the hero (heroCoordinates in world/server-world.ts) onto the chest hex in the same action. No loot here.
3. Refusal for OPEN while the hero stands on a chest hex (name STANDING_ON_TARGET), checked before Will is spent.
4. A hero may stand on a SOLID object hex: check hero-movement/move-planner.ts:29 and movement-grid.ts:34 (leaving such a hex must work), fog reveal, saves, and the web projection of the hero position (reload while standing on the chest).
5. Quantity on item instances: let a placed loot hexobject carry its own amount (map serialization in packages/engine/src/map/models, HexObjectFactory) and make the TAKE finisher (registry/action-finishers-registry.ts:104) take the whole stack; full bag leaves the item in place (already so; pin it with a test).
Tests: characterization tests first (OPEN today, TAKE today); new engine tests; a web unit test for walking off the chest hex. No CONTENT_VERSION bump. Acceptance: lint/typecheck/test green. Conflicts to Oleh in Ukrainian, journal row, stop.
```

#### L2b

```text
Phase L2b of docs/loot-plan.md. Requires L1 and L2a done. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine.
Read the whole plan incl. "Результати L0" first.

1. New packages/engine/src/world/loot-world.ts: chest OPEN over ServerWorld using loot/plan-loot-spread.ts (L1): E = hero's hex before the action, convert offset<->axial at this edge (getHexNeighbors / offsetToAxial in utils/hex-utils.ts), free places by isEnterableTile-like rules + empty hexobject, item hexobjects created with HexObjectFactory.create and an amount. Seed: hidden ServerWorld.worldSeed (stream loot:<mapId>:<chest key>), never rngSeed from the progress row and never anything the client sees (client-projection.ts uses cosmeticSeedFor). NO_ROOM_FOR_LOOT is refused before the Will is charged and before the hero moves (the world command returns no state on refusal). Zero free places: the L1 `to-bag` result puts the guaranteed drops straight into the hero's inventory (grantToDraft); decide the BAG_FULL case with Oleh first (§1.1 п.11).
2. Content: content/loot-tables.content.ts with the chest table; construction.lootTableId in content/content-schema.ts:155 and constructions.content.ts. Generator rule "at least 3 passable neighbours without objects" in the cave recipe (content/boards/models/cave.ts:19-34, boards/pipeline/pieces/rules.ts).
3. API: apps/api/src/world/world.service.ts — repeated commandId returns replayed: true (already so), no duplicated loot; response without seed or unrolled tables. Integration tests in apps/api/src/world/world.integration.spec.ts: replay marker + no duplication, other hero -> FORBIDDEN, two different commandIds at once -> exactly one succeeds, NO_ROOM_FOR_LOOT then success gives the same list, reload (GET /player/world) while standing on the chest.
4. No client work. If Q3 of the quest plan wants the shared rule, only note it in the journal.
Acceptance: engine + api tests green (real Postgres). Conflicts to Oleh in Ukrainian, journal row, stop.
```

#### L2c

```text
Phase L2c of docs/loot-plan.md. Requires L2b done. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-web-state, hexoflat-render, hexoflat-e2e.
Read the whole plan incl. "Результати L0" first.

1. Client state: the answer of WORLD_ACTION is applied by stores/server-world-actions.ts (applyTileDiffs + replayEffects); on replayed: true (services/player/player-socket.ts:21) refetch the world projection (GET /player/world, services/player/world-sync.ts reload) instead of applying nothing. No rules in stores.
2. Render: loot flies out from the chest hex centre to its hex (render/layers, durations in a timing file, never hard-coded); open-chest sprite via the existing object-fit rules (render/object-fit.ts). Never redesign existing looks.
3. Hover card: services/hex-info/build-hex-info.ts — one sentence of the rule without numbers (§1.1 п.13), "порожньо" seal on the open chest; literal hexInfo.* i18n keys.
4. i18n uk/en in locales/{en,uk}/ui.json for NO_ROOM_FOR_LOOT, STANDING_ON_TARGET and the full-bag pickup refusal (loot.reject.*, register dynamic keys in i18n/locale-keys.ts). Every new button/input has data-testid.
5. E2E: apps/playwright/e2e/hero/loot-chest.spec.ts through Feature/Component classes only (no locators in the spec); scenarios from §4 "Playwright" for the chest incl. reload while standing on the chest and the refused action while standing on a target. Run only the new spec through sh scripts/pre-push-e2e.sh <spec>.
Acceptance: web tests, lint, typecheck green; e2e spec green. Conflicts to Oleh in Ukrainian, journal row, stop.
```

#### L3a

```text
Phase L3a of docs/loot-plan.md. Requires L1 done (L2b recommended). Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine.
Read the whole plan incl. "Результати L0" and docs/battle-system/BATTLE-HANDOFF.md first.

1. battle/battle-state.ts: additive graves (default []) created in checkBattleEnd (battle/battle-end.ts:15) at victory: one grave per hex where a creature died (position of hp<=0 creatures), several deaths on one hex => one grave with the concatenated loot-table list; creatures carry the table id from battle/battle-catalogue.ts (field lootTableId may start empty; content in L5).
2. Collection phase after victory: hero steps cost nothing (battle/movement.ts), hazards (battle/hazard.ts) and enemy logic off, no deadlines/penalties from playOverdue; performAction (battle/perform-action.ts:44) must allow collect actions but still answer BATTLE_ENDED for fight actions. A hero standing on a grave hex at victory must step off before LOOT_GRAVE.
3. New BattleActions: LOOT_GRAVE (free, adjacent grave, rejected while standing on a grave: STANDING_ON_TARGET) using loot/plan-loot-spread.ts in axial coordinates; seed = hidden BattleState.seed (stream loot:<battle id>:<hex>); spread fills BattleState (loot objects on hexes, SOLID for movement, grave marked looted); plus a pickup action for loot in battle (needed, not named in the decision, see conflict in the plan). Free places exclude other graves and hp<=0 hexes (isFreeHex in battle/battle-board.ts:43 counts only living creatures: add the grave rule here).
4. Exit = existing WORLD_BATTLE close (world/battle-world.ts:192, squads/squad-battle.ts:166); one-time warning milestone in progress (progress schema v9 with upcaster; see aggregates/progress-state).
5. Session restore: battleView (apps/api/src/world/world.service.ts:716) and projectBattleForViewer (battle/projection.ts) must carry the collect state and the same layout; unrolled lists/seed stay hidden.
Tests: §4 Engine + two deaths on one hex, restore keeps layout, defeat has no collect phase. battle/balance.test.ts stays skipped, do not retune. Acceptance: engine+api green. Conflicts to Oleh in Ukrainian, journal row, stop.
```

#### L3b

```text
Phase L3b of docs/loot-plan.md. Requires L3a done. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-web-state, hexoflat-render, hexoflat-e2e.
Read the whole plan incl. "Результати L0" first.

1. Battle UI: composables/battle-tool-hex.ts + a-game-scenes/map-scene/components/battle/battle-tool-hex.vue offer LOOT_GRAVE next to an unlooted grave (the ring label stays the eye, one top-priority action per tool hex), battle-board-tap.ts, use-battle-view.ts; pickup in battle; LEAVE BATTLE stays the exit; one-time warning before leaving with loot left (services/battle/battle-server.ts / squad-flow.ts).
2. Render: render/layers/battle-grave.ts + render/battle/battle-look.ts (looted-grave look, ask Oleh for art, do not invent), loot objects on the board, flight animation with durations in render/battle/battle-timing.ts, preload new sprites in battleAssetPaths.
3. Hover card in battle: services/hex-info/build-battle-hex-info.ts (grave card with the cramped-surroundings sentence, "порожньо" seal).
4. Restore after reload mid-collect: battleStore.restore.
5. i18n uk/en, data-testids, e2e in apps/playwright/e2e/hero/loot-grave.spec.ts (win a squad, collect phase, LOOT_GRAVE, pick up coins, leave, no squad token, reload mid-collect, two deaths on one hex through a fixture in apps/web/src/e2e/battle-hooks.ts + engine battle/battle-fixtures.ts).
Acceptance: web + e2e spec green. Conflicts to Oleh in Ukrainian, journal row, stop.
```

#### L5

```text
Phase L5 of docs/loot-plan.md. Requires L2b and L3a done. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine.
Read the whole plan incl. "Результати L0" first.

1. Content (numbers in content, not code): loot tables of §1.4 in content/loot-tables.content.ts; lootTableId on skeleton-warrior / skeleton-archer / skeleton-king in battle/battle-catalogue.ts; the cave chest table; every itemKey must exist and carry a coinPrice (content/coin-price.test.ts stays green).
2. Remove squad.loot: ISquad (abstraction/hexobject-abstraction.ts:74), content/creatures.content.ts (squadContent and the four squads), world/client-projection.ts:26, tests; no CONTENT_VERSION bump.
3. Economy tests: content/loot-economy.test.ts — (a) 10 000-run simulation of coins per cave run (chest + every squad of the cave recipe) stays inside a band recorded in the plan journal; (b) buy-then-sell never profits for every priced key at the maximum shop discount (trade discounts R6 up to 50%, sellRate 2/5 from content/traders.content.ts via sellUnitPrice).
4. Update docs: CLAUDE.md, skills, plan journal with the measured band.
Acceptance: workspace green. Conflicts to Oleh in Ukrainian, journal row, stop.
```

## 3. L0 — що з'ясувати (без коду)

1. Як зараз лежить предмет на гексі карти (зілля на `silesia`) і чи блокує він рух. Правило §1.1 п.4 і п.8 спирається на те, що блокує.
2. Чи може герой стояти на гексі з об'єктом `solid`; що для цього треба змінити в русі, рендері й збереженні позиції.
3. Скриня печери: де оголошена, що робить `FINISH_UNLOCK_ONLY`, який у неї стан після відкриття.
4. `squad.loot` у `creatures.content.ts`: формат, чи можна розкласти його на істот.
5. Бій: чи є надгробок частиною стану бою чи лише анімацією; що відбувається одразу після перемоги (`settle…`), де прибирається жетон загону; чи можна героєві рухатися полем після перемоги.
6. Як кільце інструментів передає дію `OPEN` / `EYE` в команду; чи є `EYE` вже як дія.
7. Чи є вже код відмов і переклади, куди додати `NO_ROOM_FOR_LOOT`.
8. Як `battleView` відновлює бій після перезавантаження і що треба додати для фази збирання.
9. Стан `architecture/domain-model-plan.md`: чи виконано DM0/DM1. Якщо `Reward`, `Refusal`, `LootTable` уже є, використати їх; якщо ні, L1 створює лише потрібне для здобичі в тих самих іменах.
10. Розбіжності з цим планом і питання до Олега.

Вихід L0: розділ «Результати L0» нижче, виправлені назви в §1–§2, список файлів для L1–L5.

### Промпт L0 (вставити в новий чат Claude Code)

```text
Phase L0 of docs/features/loot-plan.md (hexoflat / Path of Will). Work on the current branch; do not create branches. Do NOT run git commit. No code changes in this phase.
Load skills: hexoflat-phase, hexoflat-engine, hexoflat-web-state, hexoflat-render.
Read the whole plan first, then docs/release/roadmap-after-r0.md and the "Результати R0" section of docs/release/first-release-checklist.md.

Answer every question in §3 of the plan with file paths and line numbers. For each rule in §1 say: already supported / needs change (where) / conflicts with existing behaviour (how).
Write the result into "Результати L0", correct assumed names in §1–§2 to the real ones, list the files each phase L1–L5 will touch, and tell Oleh in Ukrainian about every conflict. Stop.
```

## 4. Тести (мінімум)

**Engine (Vitest)**

- 5 вільних сусідів, список дає 3 → 3 предмети на перших трьох гексах за годинниковою стрілкою на екрані від `E`.
- Список дає 5, вільних 2 → 2 предмети, решта відкинута (з кінця).
- Гекс `E` ніколи не отримує предмет (в усіх сценаріях і в sweep).
- 0 вільних без гарантованих → `NO_ROOM_FOR_LOOT`, стан не змінено, герой не переміщений, Воля не списана.
- 0 вільних з гарантованими → усі гарантовані записи в результаті `to-bag`, розіграні відсутні; два гарантованих записи (монети й предмет) обидва в `to-bag`.
- Монети: один запис-стос на місці першого запису монет, незалежно від кількості, злиття **до** обрізання.
- Той самий сід і той самий ключ цілі → той самий результат; **повтор після `NO_ROOM_FOR_LOOT` дає той самий список**.
- Порядок розкладання за годинниковою на екрані для `E` у кожному з шести напрямків (рукописні очікування).
- Сусідня могила зменшує кількість вільних місць.
- Порожня ціль: `OPEN` / `LOOT_GRAVE` відхилено; крок на неї відхилено.
- **Дію відхилено, поки герой стоїть на гексі скрині чи могили** (`STANDING_ON_TARGET`), до списання Волі.
- **Повна сумка: підбір лишає предмет на гексі**, стан інвентаря не змінено.
- **Два вбивства на одному гексі → одна могила зі склеєним списком.**
- `guaranteed` боса випадає першим і не відкидається, доки є хоч одне місце.

**API (інтеграція)**

- Повтор команди з тим самим `commandId` повертає `replayed: true`, не дублює здобич і не містить `tileDiffs`/`effects`/`hero`.
- Відповідь не містить сіда й нерозіграних таблиць.
- Чужий герой → `FORBIDDEN`.
- **Дві різні `commandId` одночасно на одну ціль: успішна лише одна.**
- **Перезавантаження (`GET /player/world`), поки герой стоїть на гексі скрині: позиція, предмети й порожня скриня на місці.**
- `NO_ROOM_FOR_LOOT`, потім звільнення місця й успіх → той самий список.

**Playwright**

- Відкрити скриню в печері → герой на гексі скрині → предмети навколо → підібрати → перезавантажити сторінку → предмети в сумці, скриня порожня.
- **Спроба `OPEN`, коли герой стоїть на гексі скрині: відмова з текстом.**
- **Перезавантаження, поки герой стоїть на гексі скрині: герой там само, скриня порожня.**
- **Повна сумка: підбір лишає предмет на гексі, текст відмови.**
- Перемогти загін → фаза збирання → `LOOT_GRAVE` → підібрати монети → вийти → жетона загону немає, прохід вільний.
- **Два вороги померли на одному гексі: одна могила, один розіграш.**
- Перезавантаження посеред фази збирання повертає в неї.

## 5. Поза межами етапу

Рівні складності й нові вороги (етап 3), скриня «Шукача скарбів» (етап 2, використає це саме правило), рідкість God Executor у таблицях, здобич для кількох героїв у коопі.

- **Продаж дерева й каменю.** Це лічильники (`yields: { wood: 1 }`, ефекти `treeCut`/`stones`), а не предмети; `coin-price.test.ts` дозволяє ціну лише LOOT/TOOL/EQUIPMENT. Окреме рішення пізніше (рішення Олега Q-3, 2026-11-13: поза межами).
- **Запечатування очищеного підземелля.** Окрема мала задача поза L-фазами: `world/world-leave.ts:53-57` запечатує печеру (`respawnAfterClearedMs`) за наявністю `HEXOBJECT_KEYS.GRAVE` на карті, але `GRAVE` у виробничому коді ніде не створюється (є лише `constructions.content.ts:298`, `registry/hexobjects-registry.ts:29` і тести), тож запечатування фактично не спрацьовує. Вирішити, за якою подією вважати підземелля очищеним (рішення Олега Q-5, 2026-11-13: окремо від L-фаз).

- **Адаптер здобичі скрині «Шукача скарбів» зроблено (QC1, 2026-11-14):** справжня скриня квесту розкладає здобич тим самим `planLootSpread` на полі квесту (`quests/seeker-chest.ts`); запечатування, продаж дерева й каменю та засідка Q5 лишаються поза межами.

## Результати L1 (2026-11-13)

Створено (нових файлів, `packages/engine/src/loot/`): `loot-table.ts` (Zod `LootTable`, `LootEntry`, `WeightedLootEntry`, `LootDrop`), `loot-refusal.ts` (`LootRefusal`, `lootRefusal`; `Refusal` у коді не було), `roll-loot.ts` (`rollLoot`, `lootStreamLabel`), `place-loot.ts` (`placeLoot` → `placed` | `to-bag` | `refused`), `index.ts`, фікстури `loot-test-setup.ts` і тести `loot-table.test.ts`, `roll-loot.test.ts`, `place-loot.test.ts`, `loot-sweep.test.ts` (36 тестів). Змінено один наявний файл: рядок `export * from './loot'` у `packages/engine/src/index.ts`. Наявні тести не чіпано.

Порядок і правила: див. §1.1 п.5–7 і п.11. Додатково реалізовано (поза буквою промпту, дрібні рішення):

- `lootStreamLabel(sourceId, targetKey)` повертає `loot:<id карти або бою>:<ключ цілі>`; сід викликач виводить сам через `deriveStream`.
- Обрізання за кількістю місць відкидає **розіграні** записи з кінця першими, гарантовані лишаються (для одного списку це збігається з «відкинути з кінця», бо гарантовані йдуть першими; для двох списків гарантовані з другого переживають розіграні з першого).
- Сусід, що не торкається цілі, або `E`, що не сусід цілі, — помилка викликача (`RangeError`), а не відмова гри.
- Гекс сусіда, якого немає в `neighbours` (край дошки), вважається невільним.
- Вага в таблиці — додатне ціле; вибір із поверненням.

| ID           | Що перевіряє                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| REQ-LOOT-001 | схема відхиляє `rolls` з min > max                                                                                                               |
| REQ-LOOT-002 | схема відхиляє нульові й від'ємні ваги                                                                                                           |
| REQ-LOOT-003 | схема відхиляє порожні `entries`, коли `rolls` може бути > 0                                                                                     |
| REQ-LOOT-004 | схема відхиляє кількість < 1 і діапазон навпаки                                                                                                  |
| REQ-LOOT-005 | коректна таблиця проходить круг `parse`                                                                                                          |
| REQ-LOOT-006 | `rollLoot`: гарантовані першими в порядку таблиці, далі розіграні                                                                                |
| REQ-LOOT-007 | `rollLoot`: той самий сід дає той самий список                                                                                                   |
| REQ-LOOT-008 | таблиця з нульовими `rolls` нічого не дає                                                                                                        |
| REQ-LOOT-009 | 5 вільних, 3 записи: перші три гекси за годинниковою після `E`                                                                                   |
| REQ-LOOT-010 | 5 записів, 2 місця: 2 розкладено, 3 останні відкинуто                                                                                            |
| REQ-LOOT-011 | `E` ніколи не отримує запис, навіть якщо позначений вільним                                                                                      |
| REQ-LOOT-012 | 0 вільних без гарантованих: `NO_ROOM_FOR_LOOT`, вхід не змінено                                                                                  |
| REQ-LOOT-013 | 0 вільних з гарантованими: `to-bag`, розіграні відсутні                                                                                          |
| REQ-LOOT-014 | 0 вільних, два гарантованих (монети й предмет): обидва в `to-bag`                                                                                |
| REQ-LOOT-015 | гарантовані першими й переживають обрізання                                                                                                      |
| REQ-LOOT-016 | монети зливаються в один стос на першому місці монет до обрізання; стос гарантований, якщо була гарантованою будь-яка частина                    |
| REQ-LOOT-017 | два списки склеюються по порядку, монети зливаються між ними                                                                                     |
| REQ-LOOT-018 | зайнятий сусід пропускається, порядок триває                                                                                                     |
| REQ-LOOT-019 | `E` у кожному з шести напрямків дає повернутий порядок (рукописні очікування «за екраном»; окремо перевірено, що кільце справді за годинниковою) |
| REQ-LOOT-020 | край дошки: менше шести сусідів                                                                                                                  |
| REQ-LOOT-021 | ключ потоку містить id карти/бою й цілі; різні карти дають різні списки                                                                          |
| REQ-LOOT-022 | кількість вільних місць не впливає на розіграний список (префікс збігається)                                                                     |
| REQ-LOOT-023 | sweep 1000 сідів × 3 таблиці: кількість, діапазони, ключі, відсутність дублів, `E` і ціль порожні, не більше вільних місць                       |
| REQ-LOOT-024 | важчий запис випадає частіше за легший                                                                                                           |
| REQ-LOOT-025 | вхід не мутується (заморожений), однакові входи дають однаковий результат                                                                        |
| REQ-LOOT-026 | `E` чи сусід не з кільця цілі — `RangeError`                                                                                                     |

Перевірки: `packages/engine` `pnpm lint` (0 помилок, 12 попереджень, усі старі), `pnpm typecheck`, `pnpm test` (140 файлів зелені, 1247 тестів, 2 були `skip`); корінь: `pnpm lint`, `pnpm typecheck`, `pnpm test` (5/5 задач, API 198 тестів).

## Рішення L2b (2026-11-13, записано до коду)

- Відмова ніколи не змінює стан. Результат здобичі обчислюється під час перевірки, застосовується після списання Волі.
- Порядок перевірок OPEN скрині: герой є → не стоїть на цілі → скриня повна → поруч → місце → Воля.
- «Місце»: `placeLoot` повертає `placed`, або `to-bag` і сумка приймає усі гарантовані записи. Нуль місць без гарантованих: `NO_ROOM_FOR_LOOT`. `to-bag`, що не вміщається цілком: `BAG_FULL`. Часткової видачі немає. В обох відмовах Воля не списана, герой не рухався, скриня повна, повтор дає той самий список.
- Журнал зберігає лише коди відмов; тексти uk/en додаються в L2c.
- Ім'я поля таблиці в контенті скрині — `construction.lootTableId` (за планом §1.4), не `container.*`.

## Результати L2b (2026-11-13)

Рішення див. «Рішення L2b». Нове: `chests/plan-chest-loot.ts` (`rollChestLoot`, `planChestLoot`: потік `deriveStream(worldSeed, lootStreamLabel(mapId, "col:row" скрині))`, сусіди з власного стану сервера, `placeLoot`, перевірка сумки для `to-bag`), `chests/place-chest-loot.ts` (`placeChestLoot` — єдине місце застосування: предмети з `quantity` на гекси, `to-bag` через `grantToDraft(..., 'loot')`), `chests/chest-room.ts` (`CHEST_MIN_OPEN_NEIGHBOURS = 3`), `content/loot-tables.content.ts` (`cave-chest-provisional`, тимчасова таблиця для L5: монети, зілля, оберіг, щит, сокира, кайло), `construction.lootTableId` у схемі й на `chest`, перевірка таблиць у `validateContent`, `HexEngineState.loot { seed, sourceId }` (будує `stateOf` з `ServerWorld.worldSeed` і `mapId`). `worldSeed` свіжий на кожен вхід (`mapId` — новий UUID), окремого ідентифікатора входу не потрібно. Порядок: герой є → не стоїть на цілі → скриня повна → поруч → місце (`NO_ROOM_FOR_LOOT`/`BAG_FULL`) → Воля → виконання. Подія `CHEST_OPENED` тепер має `placed [{ coordinates, itemKey, amount }]` і `toBag [{ itemKey, amount }]`; відкинуті записи, таблиця й сід у події та відповідях відсутні. Генератор: у правилі `rules` нове `where.freeAround` (≥ N прохідних сусідів без об'єктів, `cave.ts`: `freeAround: 3`), а `squads` не ставить загін так, щоб скриня втратила третє вільне місце. Пресет з скринею лише один (`cave`). До змін 4 з 200 печер мали скриню з < 3 вільними сусідами, після змін 0 з 200.

Переписано: REQ-LOOT-033 (`open-chest.test.ts`, форма події).

| ID           | Що перевіряє                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| REQ-LOOT-054 | характеризація: одна скриня на печеру (до правила)                                                                     |
| REQ-LOOT-055 | розкладання збігається з `placeLoot` для того самого сіда, з кількістю, один стос монет, `E` порожній, скриня відкрита |
| REQ-LOOT-056 | нуль місць: відмова до списання й переходу, стан незмінний; звільнене місце дає той самий список                       |
| REQ-LOOT-057 | той самий сід і скриня дають ту саму здобич, інший id карти — інший потік                                              |
| REQ-LOOT-058 | сусідній предмет, істота чи об'єкт зменшують кількість місць                                                           |
| REQ-LOOT-059 | `TAKE` з гекса скрині бере сусідній стос цілим; після збору будь-який сусід є виходом                                  |
| REQ-LOOT-060 | подія не містить відкинутого, таблиці чи сіда                                                                          |
| REQ-LOOT-062 | нуль місць з гарантованими: дроп у сумці, на карті нічого, герой на скрині                                             |
| REQ-LOOT-063 | повна сумка: `BAG_FULL`, стан незмінний; після звільнення сумки той самий список                                       |
| REQ-LOOT-064 | генератор: 200 реальних печер, скриня має ≥ 3 прохідних сусідів без об'єктів                                           |
| REQ-LOOT-065 | герой не поруч зі скринею: Воля не списується (відновлює намір тесту, переписаного в L2a)                              |
| REQ-LOOT-066 | API: той самий `commandId` двічі: одне списання, один набір, `replayed`                                                |
| REQ-LOOT-067 | API: два різні `commandId` одночасно: успішна одна, предмети один раз                                                  |
| REQ-LOOT-068 | API: у відповідях і проєкції немає сіда, таблиці, відкинутого                                                          |
| REQ-LOOT-069 | API: відновлення сесії: ті самі предмети з кількістю, герой на гексі скрині                                            |

## Результати L2a (2026-11-13)

Лише engine й api, веб не чіпано. Зміни: `abstraction/hexobject-abstraction.ts` (`quantity?: number` на екземплярі, за замовчуванням 1), `factory/hex-object-factory.ts` (override `quantity`, ціле ≥ 1), `map/models/hex-map-model.ts` (`hydrateHexobject` зберігає `quantity`), `registry/action-finishers-registry.ts` (`TAKE` бере `quantity ?? resource.amount ?? 1`, повний стос або нічого: `planGrant` атомарний), `registry/hexobjects-registry.ts` + `content/constructions.content.ts` (`chest-open`, SOLID, без дій і тегів, спрайт скрині-плейсхолдер), нова папка `chests/` (`open-chest.ts`: `chestRefusal`, `openChest`, `isChestOpening`; `place-chest-loot.ts`: єдине місце виклику для L2b, нічого не кладе), `commands/apply-command.ts` (OPEN на скрині йде в `openChest` після перевірки Волі, перевірки скрині ДО Волі), `world/world-commands.ts` (`actWorld` синхронізує `heroCoordinates` і `progress.presence` після дії). Нові події: `CHEST_OPENED { heroId, coordinates, from }`, `LOOT_REJECTED { heroId, reason }` (`NO_HERO`, `STANDING_ON_TARGET`, `CHEST_EMPTY`, `NOT_ADJACENT`). Стартер `ACTION_STARTERS.OPEN` лишився (відповідає «broken» для інших об'єктів, напр. скрині схову). Порядок відмов OPEN: немає героя → стоїть на скрині/могилі → ціль порожня → не поруч → Воля → виконання. Герой стоїть на гексі скрині лише як результат OPEN; вихід, шлях і досяжність працюють без змін (BFS стартує з позиції героя). Тести: `chests/take-quantity.test.ts`, `chests/open-chest.test.ts` (engine), нові 6 тестів у `apps/api/src/world/world.integration.spec.ts`; переписано один наявний тест (`knowledge/will-economy.test.ts`, «does not spend Will when the action itself is refused»: тепер перші події `LOOT_REJECTED`, `HEX_ACTION_START_REJECTED`, бо в тесті немає героя).

| ID           | Що перевіряє                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------ |
| REQ-LOOT-027 | предмет без кількості дає 1 шт. (характеризація)                                                 |
| REQ-LOOT-028 | стос 7 монет іде в сумку цілим, предмет зникає з гекса                                           |
| REQ-LOOT-029 | стос, що не вміщається, відхилено цілком: предмет і кількість лишаються, інвентар без змін       |
| REQ-LOOT-030 | кількість переживає збереження; старий предмет без кількості дає 1 шт.                           |
| REQ-LOOT-031 | крок на SOLID-гекс (повну скриню) відхилено `BLOCKED` (характеризація)                           |
| REQ-LOOT-032 | реєстровий стартер OPEN і далі відповідає «broken» для не-скрині                                 |
| REQ-LOOT-033 | успіх: Воля −2 один раз, герой на гексі скрині, скриня порожня, одна `CHEST_OPENED`              |
| REQ-LOOT-034 | перехід героя безплатний (кроки не рахуються)                                                    |
| REQ-LOOT-035 | мало Волі: відмова, стан не змінено                                                              |
| REQ-LOOT-036 | герой на скрині: OPEN на іншу відмовлено `STANDING_ON_TARGET`, Воля й стан без змін              |
| REQ-LOOT-037 | з нульовою Волею на скрині відповідь `STANDING_ON_TARGET`, не «мало Волі»                        |
| REQ-LOOT-038 | не поруч: `TOO_FAR` (світ) і `NOT_ADJACENT` (правило)                                            |
| REQ-LOOT-039 | другий OPEN відмовлено і з гекса скрині, і збоку (`CHEST_EMPTY`)                                 |
| REQ-LOOT-040 | крок назад на порожню скриню відмовлено                                                          |
| REQ-LOOT-041 | крок на кожного вільного сусіда звичайний, 1 Воля                                                |
| REQ-LOOT-042 | з нульовою Волею крок зі скрині відмовлено `INSUFFICIENT_WILL` (наявне правило), герой лишається |
| REQ-LOOT-043 | досяжність і найкоротший шлях стартують з гекса скрині                                           |
| REQ-LOOT-044 | гекс скрині непрохідний як ціль                                                                  |
| REQ-LOOT-045 | збереження і завантаження світу з героєм на гексі скрині                                         |
| REQ-LOOT-046 | клієнтська копія з `tileDiffs` показує порожню скриню                                            |
| REQ-LOOT-047 | відкриття розкриває сусідні гекси                                                                |
| REQ-LOOT-048 | API: відкриття через `WORLD_ACTION`, Воля один раз, герой на скрині                              |
| REQ-LOOT-049 | API: перезавантаження повертає героя на гекс скрині, скриня порожня, `presence` там само         |
| REQ-LOOT-050 | API: другий OPEN відмовлено, Воля без змін                                                       |
| REQ-LOOT-051 | API: той самий `commandId` двічі, Воля списана один раз, `replayed: true`                        |
| REQ-LOOT-052 | API: чужий акаунт `FORBIDDEN`, скриня повна                                                      |
| REQ-LOOT-053 | API: мало Волі, відмова, скриня повна                                                            |

## Результати L2c (2026-11-13)

Лише `apps/web`, `apps/playwright` і одна дозволена зміна engine: `TAKE` з повною сумкою тепер каже `LOOT_REJECTED { heroId, reason: 'BAG_FULL' }` через `ctx.emit` (для цього в `IActionContext` додано необов'язкове `heroId`, `applyCommand` ставить його, коли в стані рівно один герой; `REQ-LOOT-070`). Крок 0 виконано: `CLAUDE.md` і скіл `hexoflat-engine` описують `chests/`, `HexEngineState.loot`, `where.freeAround`, тимчасову таблицю, `loot.reject.*`, кількість на екземплярі.

Що зроблено у веб:

- **Стан.** `WorldCommandResult.replayed`; `applyWorldResultAction` (`stores/server-world-actions.ts`): `replayed` → рівно одне перечитування `GET /player/world` (`refetchServedWorld`, `refetchWorldAction`: карта й позиція героя беруться з відповіді, без `reseed`/відновлення бою), інакше `CHEST_OPENED` ставить героя на гекс скрині й запускає виліт, а `tileDiffs` застосовуються одразу. Предмети «в сумку» приходять з агрегатом інвентаря. Відновлення сесії з героєм на гексі скрині не скидається (тест `world-chest-restore.test.ts`). Відмова `TAKE` приходить у відповіді тіку: `serverTickAction` показує `loot.reject.BAG_FULL`.
- **Рендер.** Порядок шарів: плитки, герой, виліт здобичі (жетон героя вище скрині). Порожня скриня = той самий спрайт із `EMPTY_CHEST_ALPHA` 0.45 (`tiles-layer.ts`), поки Олег не дасть арт. Картка предмета показує кількість стосу (`obj.quantity ?? loot.amount`).
- **Анімація.** `render/loot-timing.ts` (усі тривалості, ≤ 800 мс разом), `render/layers/loot-flight-layer.ts`, `services/loot/loot-flight.ts` (чисте планування) і `loot-flight-state.ts` (модульний стан, `prefers-reduced-motion` → без анімації, запобіжний таймер). Предмети летять із центру гекса скрині на свої гекси в порядку масиву з затримкою, предмети «в сумку» піднімаються й гаснуть над героєм; спрайт плитки схований (`isObjectHidden`), доки предмет не приземлиться. `data-ready` полотна повертається після польоту.
- **Наведення.** Повна скриня: опис + речення без чисел `hexInfo.hints.chestLoot`; порожня: печатка `hexInfo.tags.empty` («порожньо»), `HexInfoView.empty` / `note`. Таблиця й кількість ніде не показуються.
- **Відмови.** `loot.reject.*` (uk/en) для `NO_ROOM_FOR_LOOT`, `BAG_FULL`, `STANDING_ON_TARGET`, `CHEST_EMPTY`, `NOT_ADJACENT`, реєстр у `lootLocaleKeys()`; показ через `heroToolStore.setActionMessage` (як інші відмови).
- **Хуки e2e** (`apps/web/src/e2e/loot-hooks.ts`): `getGroundItems`, `getChests`, `isLootFlying`, `tryOpenChest`; наявні `getHeroCoordinates`, `findTilesWithKey`. Сіда й таблиці немає.

Нові id/тести: `hex-info-note`, seal `data-state="empty"`; веб-юніт `loot-flight.test.ts`, `loot-rejection.test.ts`, `loot-layers.test.ts`, `server-world-actions.loot.test.ts`, `world-chest-restore.test.ts`, 4 тести в `build-hex-info.test.ts`; engine `REQ-LOOT-070`; e2e `e2e/hero/loot-chest.spec.ts` (5 тестів) через `LootChestFeature` / `LootBoardComponent`.

### Ручна перевірка для Олега

1. Печера: підійди до скрині рукою, наведи — картка «Скриня» з реченням про розліт здобичі, без чисел здобичі. Очікую: жодних кількостей, лише опис і «Відкрити».
2. Натисни OPEN: Воля −2, герой стає на гекс скрині (над спрайтом), предмети вилітають із центру скрині на сусідні гекси за годинниковою від гекса, з якого ти прийшов, менш ніж за секунду. Гекс входу порожній.
3. Наведи на стос монет: у картці «Кількість N». Підбери рукою: усі монети разом у сумці.
4. Наведи на відкриту скриню (під героєм або після кроку вбік): печатка «порожньо», спрайт притемнений, речення про розліт відсутнє.
5. Перезавантаж сторінку, поки стоїш на скрині з нерозібраною здобиччю: герой там само, ті самі предмети на тих самих гексах з тими самими кількостями, нічого не вилітає.
6. Зійди зі скрині, зроби перезавантаження: скриня порожня, предмети в сумці лишаються.
7. Стоячи на відкритій скрині, спробуй OPEN на іншу повну скриню: «Спершу зійди з цього місця.», Воля не списана.
8. Заповни сумку й спробуй підібрати предмет: «Сумка повна. Звільни місце.», предмет лишається на гексі.
9. Скриня, біля якої стоїть загін (або стіни зі всіх боків): вільних місць менше — здобич розкладена лише на вільні гекси, зайве зникає; якщо вільних місць нуль і гарантованого немає, «Навколо немає місця для здобичі.», скриня лишається повною, Воля не списується.
10. Увімкни «зменшення руху» в системі: предмети з'являються на місцях одразу, без польоту.

### Конфлікти плану з кодом

- Відкрита скриня (`chest-open`) у контенті не інтерактивна й без дій, тож рука не пропонує на ній OPEN, і текст `CHEST_EMPTY` у грі недосяжний через кільце. E2E перевіряє його хуком `tryOpenChest`, який шле справжню команду OPEN і показує справжній текст. Рішення Олега потрібне: дати `chest-open` дію OPEN лише заради відмови чи лишити як є.
- Хук розміщення ставить предмети з кількістю 1, тож e2e «повна сумка» бере сокиру, а не стос; стос, що не вміщається, покритий engine-тестом `REQ-LOOT-029`.
- Картка повної скрині показує ціну дії «2 Волі» у списку дій (це не здобич, чисел здобичі там немає).

## Результати L3a (2026-11-13)

Лише engine й api. Усе за прапором `BATTLE_RULES.graveLootEnabled` (за замовчуванням `false`, `WorldService.battleRules` у тестах вмикає). Прапор зберігається на самому бої (`BattleState.lootEnabled`, ставиться в `startBattle`), тож `checkBattleEnd`/`applyDamage` не потребують правил. З вимкненим прапором стан, події, проєкція й відповіді не змінилися (характеризаційні тести REQ-LOOT-071…076 зелені до й після).

**Модель.** Фаза збирання = `phase: 'ended'` + `outcome: 'victory'` + `BattleState.collect { graves[{ hex, tables[], examined }], items[{ hex, itemKey, amount }] }` (нового значення `BATTLE_PHASES` немає, тому ніщо з `phase === 'ended'` не ламається). `BattleState.fallen` фіксує порядок смертей (лише з прапором). Могила з'являється в `checkBattleEnd` (`enterCollectPhase`, подія `GRAVES_MARKED`) для кожного ворога з `hp 0`, один гекс = одна могила, таблиці в порядку смерті; `lootTableId` — поле `BattleCreatureDef` (три тимчасові таблиці `*-provisional` у `content/loot-tables.content.ts`, бос має `guaranteed`; `squad.loot` не чіпали).

**Правила фази** (`battle/collect.ts`): `performAction` у `ended` пропускає лише `move`, `loot-grave`, `pickup-loot` (решта: `BATTLE_ENDED`); крок безплатний, без `undo`, без пасток (`collectStep`); `isFreeHex` рахує могили й предмети перешкодою (лише коли є `collect`); `LOOT_GRAVE` = `{ kind: 'loot-grave', hex }`: порядок відмов `STANDING_ON_TARGET` → `NO_GRAVE` → `GRAVE_EMPTY` → `NOT_ADJACENT` → `NO_ROOM_FOR_LOOT`/`BAG_FULL`; потік `deriveStream(state.seed, lootStreamLabel(state.id, "q,r"))`; успіх ставить героя на гекс могили, лишає предмети в `collect.items`, гарантовані при нулі місць іде в сумку (`ITEM_GRANTED`, джерело `loot`), подія `GRAVE_LOOTED`. Підбір: `{ kind: 'pickup-loot', hex }` (назви в плані не було, вибрано в стилі решти дій), весь стос або нічого, `NO_LOOT_THERE`/`NOT_ADJACENT`/`BAG_FULL`, джерело `pickup`, подія `LOOT_PICKED`. Спільний помічник `loot/plan-spread.ts` (`planLootSpread`, `bagTakesAll`; без типів карти світу) використовують і скриня (`chests/plan-chest-loot.ts` переписано на нього, тести скрині без змін), і могила. Нові коди відмов живуть окремо (`COLLECT_REJECTION_CODES`), щоб не ламати тест повноти `battle.reject.*` у вебі (L3b додасть тексти й може злити списки).

**Інвентар у бою.** `performAction`/`applyBattleCommand` мають необов'язковий `ctx: { inventory?: IInventoryDraft }`; `battleWorld` передає чернетку з `session.inventory`, а після успішної дії записує її й додає події чернетки до відповіді (леджер API бачить `ITEM_GRANTED`). Відмова нічого не змінює.

**Вихід.** `WORLD_BATTLE close` не змінювався: приймається з будь-якого гекса, прибирає жетон загону, незібране пропадає, сумка лишається (REQ-LOOT-089). Проєкція (`projectBattleForViewer`) у фазі збирання має `collect { graves[{hex, examined}], items }` і `lootLeft: boolean`; сід, таблиці, `fallen`, `lootEnabled` приховані. Фікстура `finish: victory` теж будує могили (для e2e L3b). Віха попередження: `claimedRewards` містить `grave-exit-warning-acknowledged`, команда `ACK_GRAVE_EXIT_WARNING { heroId }` (прогрес, без ревізії, ідемпотентна, дозволена під час бою).

| ID           | Що перевіряє                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| REQ-LOOT-071 | характеризація: виграний бій без прапора (кінець, відмови `BATTLE_ENDED`, мертвий лишається, гекс вільний)        |
| REQ-LOOT-072 | характеризація: програний бій без фази збирання                                                                   |
| REQ-LOOT-073 | характеризація: `close` після перемоги (жетон, гекс, kills, з будь-якого гекса)                                   |
| REQ-LOOT-074 | характеризація: `close` після поразки (respawn)                                                                   |
| REQ-LOOT-075 | характеризація: проєкція ended-бою (набір ключів), збереження й завантаження світу                                |
| REQ-LOOT-076 | характеризація API: відновлення виграного бою, `close` звільняє гекс загону                                       |
| REQ-LOOT-077 | могили: по одній на гекс смерті, таблиці істот, одна відповідь з `GRAVES_MARKED`, без прапора й у бою їх немає    |
| REQ-LOOT-078 | дві смерті на одному гекс: одна могила, порядок смертей, монети в один стос                                       |
| REQ-LOOT-079 | герой на гексі могили: `STANDING_ON_TARGET`, поки не зійде                                                        |
| REQ-LOOT-080 | кожна відмова `LOOT_GRAVE` не змінює бій, сумку, гекс героя                                                       |
| REQ-LOOT-081 | успіх: збігається з `placeLoot` (20 сідів), герой на могилі, `E` порожній, назад на могилу не можна; потік по бою |
| REQ-LOOT-082 | сусідні могила й предмет забирають місця                                                                          |
| REQ-LOOT-083 | бос без місць: гарантоване в сумку; повна сумка `BAG_FULL`, далі той самий список                                 |
| REQ-LOOT-084 | кроки безплатні, пастка не діє, бойові дії `BATTLE_ENDED`, могили/предмети/стіни тверді, поразка без збирання     |
| REQ-LOOT-085 | підбір: весь стос, `BAG_FULL` лишає, не поруч / немає здобичі                                                     |
| REQ-LOOT-086 | проєкція: `collect`, `lootLeft`, жодних секретів; у бою й без прапора нічого не додано                            |
| REQ-LOOT-087 | 500 сідів з ботом героя: могил = різних гексів смерті, здобич не на могилі/стіні/`E`                              |
| REQ-LOOT-088 | світ: перемога дає збирання, збереження/завантаження, `LOOT_GRAVE`/підбір крізь `battleWorld`, без сіда й таблиць |
| REQ-LOOT-089 | вихід з оточеного гекса, сумка лишається, kills, прапор вимкнено = як раніше, поразка без збирання                |
| REQ-LOOT-090 | віха: ставиться раз, повтор нічого не змінює; сувора схема команди                                                |
| REQ-LOOT-091 | контент: таблиця для кожного ворога, бос має `guaranteed`                                                         |
| REQ-LOOT-092 | API: той самий `commandId` двічі: один набір, `replayed`                                                          |
| REQ-LOOT-093 | API: два `commandId` одночасно: успішна одна                                                                      |
| REQ-LOOT-094 | API: у відповіді й проєкції немає сіда, таблиць, `fallen`, `lootEnabled`                                          |
| REQ-LOOT-095 | API: чужий акаунт `FORBIDDEN`                                                                                     |
| REQ-LOOT-096 | API: відновлення до й після `LOOT_GRAVE` однакове (могили, предмети, гекс героя)                                  |
| REQ-LOOT-097 | API: відмова не змінює стан                                                                                       |
| REQ-LOOT-098 | API: підбір пише сумку й рядок леджера, `close` лишає сумку                                                       |
| REQ-LOOT-099 | API: віха ставиться раз, повтор без нової ревізії                                                                 |

## Результати L3b (2026-11-14)

- **Крок 0:** віха попередження переїхала з `claimedRewards` у `progress.graveExitWarningAcknowledged` (`progress` v9, upcaster 8 → 9); порожня могила дає успіх `GRAVE_LOOTED { nothing: true }` (могила оглянута, герой стоїть, нічого не розкладено; повторне око дає `GRAVE_EMPTY`); фікстурна таблиця `nothing-fixture` (кидки [0, 0]); `graveLootEnabled` увімкнено за замовчуванням. Письмової пропозиції оновлень документації в плані L3a не знайдено, тому оновлення виведено з «Результати L3a».
- **Клієнт:** перемога лишає поле відкритим; око (мітка дії руки, шаблон `tool.read`) на сусідній могилі, «Взяти» на стосі; кроки у фазі збирання безкоштовні; могили малюються зі стану (`grave-hex.png`, оглянута 0.45), без подвійної могили; виліт здобичі через спільний шар (≤ 800 мс); картки: могила з реченням без чисел і «порожньо»; одноразове підтвердження виходу (`battle-leave-warning|confirm|cancel`); `battle.reject.*` для всіх кодів; `replayed` перечитує бій один раз; відновлення сесії повертає у фазу збирання.
- **Знайдена помилка:** підбір здобичі перемикав праву панель на Inventory (`useOpenInventoryOnPickup`) і ховав LEAVE BATTLE; тепер у відкритому бої вкладка не змінюється.
- **Змінені наявні специфікації:** `squad-actions.spec.ts` (через `squad-actions.feature.ts`: після перемоги вихід може питати підтвердження, `leaveConfirmingIfAsked`); engine-тести `collect.test.ts`, `battle-collect-world.test.ts`, `battle-close-characterization.test.ts` тепер явно вимикають прапор там, де характеризують стару поведінку.
- **Хуки e2e:** `getBattleCollect()` (могили й предмети з `standHexes`, без зерна й таблиць). Нова специфікація `e2e/combat/battle-collect.spec.ts` (3 тести).
- **Перевірки:** lint 0 помилок, typecheck зелений; engine 1344 пройдено / 2 skip, api 217, web 3211, playwright-пакет 37; skip до й після: 2 → 2; повний e2e з увімкненим прапором: 223 пройдено, 1 впав і 4 нестабільні в першому прогоні (`quest-seeker` «stepping back three times» — не пов'язано з боєм; перезапуск разом із `battle-collect` і `squad-actions`: 16 з 16).

## Результати L0

Виконано 2026-11-13 на гілці `quest-board-implementation`, без змін коду. Вердикти: ✅ підтримано · 🔧 треба змінити · ⚠ конфлікт з наявною поведінкою.

### Відповіді на питання §3

**1. Предмет на гексі карти.** Усі предмети `loot` мають `collision: SOLID` (`packages/engine/src/content/loot.content.ts:23` монети, `:44` зілля, `:68` енергія; те саме в `tools.content.ts:18,39`, `equipment.content.ts:25,51`). SOLID блокує рух: `hero-movement/move-planner.ts:29` (`isEnterableTile`) і `movement-grid.ts:34` (`isTraversableTile`). Підбір — дія `TAKE` рукою: стартер `registry/action-starters-registry.ts:161`, фінішер `registry/action-finishers-registry.ts:95-113`; предмет лишається на гексі, доки `grantToDraft` не поверне `true`. Кількість: `amount = groupType === RESOURCE ? resource.amount : 1` (`:104`), тобто **стос монет з одного гекса дає 1 монету** (⚠ п.7 §1.1).

**2. Герой на SOLID-гексі.** Герой — це лише `ServerWorld.heroCoordinates` (`world/server-world.ts:20-29`) і `progress.presence`, нічого не заважає записати туди координату гекса з об'єктом. Блокує лише планувальник кроку _на_ SOLID-гекс; вихід _з_ нього працює (BFS стартує з позиції героя). Потрібно: (а) серверна «безплатна телепортація» в новій команді, не через `MOVE_HERO`/`stepWorld`; (б) перевірити, що `fog-service` і `tiles-layer`/`hero-layer` малюють героя поверх спрайта об'єкта (шар героя вище шару тайлів — підтвердити в L4); (в) гекс героя на SOLID не ламає збереження (це звичайні координати). Новий гексобʼєкт «порожня ціль» має бути SOLID, тоді правило §1.1 п.8 виконується само (стати на нього знову не можна).

**3. Скриня печери.** Ключ `chest` (`registry/hexobjects-registry.ts:30`), контент `content/constructions.content.ts:189-207`: тег `treasure`, `chestType: LOOT`, дія `OPEN` рукою, `willCost: 2` (⚠ план каже «типово безплатно»). Генератор ставить її правилом `treasure` у `content/boards/models/cave.ts:19-34` (`pick: { tag: 'treasure' }`, регіон `deep`, `required`), поруч із загоном `skeleton-pack` на місці `treasure` (`:38-41`). **Найважливіше (⚠):** `OPEN` зараз **завжди відмовляє**: стартер `action-starters-registry.ts:281-286` повертає `{ ok: false, message: 'The chest is broken and cannot be opened.' }`, тож `FINISH_UNLOCK_ONLY` (`action-finishers-registry.ts:166`) для скрині недосяжний. Стану «відкрита» немає: `construction` має лише `integrity/isLocked/chestType`. Правило «≥ 3 вільних сусіди» у генераторі відсутнє (воно є тільки в `quests/trail.ts:12`, `MIN_FREE_AROUND_CHEST` для скрині квесту).

**4. `squad.loot`.** `ISquad.loot: THexobjectKey` (`abstraction/hexobject-abstraction.ts:74`), значення в `content/creatures.content.ts:60-78` (зграя → `sword`, лучники → `health-bottle`, двір → таблиця луту боса). **Ніхто не читає**, крім `world/client-projection.ts:26` (ховає значення від клієнта). Розкласти на істот не можна: один ключ на загін, а істоти бою — окремий каталог (`battle/battle-catalogue.ts:89-107`). Тому `lootTableId` ставиться на запис істоти каталогу бою.

**5. Бій після перемоги.** Надгробка в стані бою немає: убита істота лишається в `BattleState.creatures` з `hp = 0` (`battle/battle-end.ts:45-53`, `CREATURE_FELL`), а гріб малює лише рендер (`render/layers/battle-grave.ts`, `BATTLE_GRAVE_SPRITES`). Рушій вважає такий гекс **вільним** (`battle/battle-board.ts:43-49`, `isFreeHex` рахує лише живих), тому функція розкладання в L1 мусить сама виключати гекси істот із `hp <= 0` (⚠ п.4 §1.3). Перемога: `checkBattleEnd` (`battle-end.ts:15-37`) ставить `phase: 'ended'`, `outcome: 'victory'`; після цього `performAction` відмовляє `BATTLE_ENDED` (`battle/perform-action.ts:44`), тобто **герой не може рухатися полем** (⚠ потрібна фаза збирання). Жетон загону прибирається в `closeBattle` (`squads/squad-battle.ts:166-196`, `tile.hexobject = null` на `:176`), який викликає `closeBattleWorld` (`world/battle-world.ts:192-224`) за командою `WORLD_BATTLE { kind: 'close' }`; у веб це кнопка LEAVE BATTLE. Тобто «вихід з поля» з §1.3 вже існує як `close`, але між кінцем бою й ним фази нема. Поразка: `close` → `respawnWorld`, фаза збирання не потрібна, як у плані.

**6. Кільце інструментів → дія.** Веб: `tool-hex-tile.vue` обчислює дії через `resolveActions` (`engine game-resolvers/interactions-resolver.ts:170-181`: `OPEN` потребує `cap.canOpen` і `requiredTool`, пріоритет 95), шле `START_HEX_ACTION` → `WORLD_ACTION` (`world/world-commands.ts:173-205`, відстань > 1 → `TOO_FAR`). **Дії `EYE` немає.** «Око» — це лише підпис: `tool-hex-tile.vue:210-222` (`isReadAction`: для `knowledge-book` і `quest-board` з рукою показує `tool.read`, а під капотом дія `USE`, `constructions.content.ts:278`). Для могили на полі бою `battle-tool-hex.vue` не має такої дії; могили — не гексобʼєкти, а `hp<=0` істоти. Отже `EYE` = нова бойова дія (`BattleAction`, напр. `loot-grave`) + нова гілка в `battle-tool-hex.ts`, а не новий `EHexActionType`. Лишається рішення Олега (Q-2): називати її EYE в коді чи `LOOT_GRAVE`.

**7. Відмови й переклади.** Світові відмови: `ACTION_REJECTED`/`TOO_FAR`/`NO_POSITION` → `HEX_ACTION_START_REJECTED { message }` (`apps/web/src/stores/world-map-store.ts:164`), окремої мапи «код → переклад» для світових команд немає. У новіших підсистемах схема така: подія-відмова (`QUEST_REJECTED`, `TRADE_REJECTED`, `BATTLE_REJECTED`) + ключі `quest.board…`, `shop.error.<CODE>`, `battle.reject.<CODE>` у `apps/web/src/locales/{en,uk}/ui.json`. `NO_ROOM_FOR_LOOT` не існує; додається як `LOOT_REJECTED { reason }` (в `REJECTION_TYPES`, `execute-player-command.ts`-стиль) + `loot.reject.*` у ui.json (uk + en; тест ключів вимагає буквальних `t()`).

**8. Відновлення бою.** `GET /player/world` повертає `battleView` (`apps/api/src/world/world.service.ts:716`, `projectBattleForViewer(world.battle, 'heroes')`), веб: `services/battle/battle-server.ts:31` (`loadServerBattleView`) → `battleStore.restore`. Виграний, але не закритий бій уже відновлюється (`phase: 'ended'` лишається в `srv-world:<id>`), тому для фази збирання треба лише: нові поля стану збирання в `BattleState` (additive, `.default`), їх проєкція в `projectBattleForViewer`, і вся здобич уже лежить у стані → відновлення «з тим самим розкладом» вийде безкоштовно, якщо розклад зберігати в стані, а не перераховувати.

**9. `domain-model-plan.md`.** Файлу немає (немає й каталогу `docs/architecture/`), DM0/DM1 не виконано. `Reward` частково є: `quests/quest-definition.ts` (`item | will`). `Refusal` і `LootTable` немає. L1 створює `LootTable` і результат-відмову локально в `packages/engine/src/loot/` тими ж іменами.

**10.** Див. «Конфлікти й питання до Олега».

### Додаткові питання

**11. Дедуплікація `commandId`.** Є. Таблиця `command_journal` з унікальним `command_id` (`apps/api/src/db/schema.ts:146-165`). Перевірка на початку транзакції: `world.service.ts:171-195` (світ), `quests/quest-run.service.ts:110`, `player/player-command.service.ts`. Зберігається рядок журналу: `result`, `reason`, `events`, `newRevision`, `payload`. ⚠ **Повторна відповідь НЕ ідентична**: для світових команд повтор повертає `events` із журналу, але `tileDiffs: []`, `effects: []`, `hero: null` і поточні агрегати (`world.service.ts:185-201`). Для здобичі це означає: повтор не покаже клієнту, де лежать предмети. Вирішення (Олег обирає, Q-4): клієнт після `replayed: true` перечитує карту (`/player/world`), або `tileDiffs` пишемо в журнал. Захист від подвійної видачі однак подвійний: порожня ціль (стан) + журнал.

**12. Ключі §1.4.** Є в контенті: `coins` (`coins-hex.png`), `health-bottle`, `return-scroll` (`teleport-scroll-token.png`), `sword` (`sword-hex.png`), `shield`, `axe` (`axe-token.png`), `pickaxe`. Усі з `coinPrice`, крім `coins`. Нових предметів для таблиць не потрібно, але «спорядження» зі скрині = лише ці чотири (меч, щит, сокира, кайло), які вже є стартовою вмістиною першої скрині кемпу. Нове потрібне: гексобʼєкт «відкрита скриня» (ключ + спрайт), «оглянута могила» — рендер-стан (спрайт). Ресурси `wood`/`stone` предметами не є (див. Q-3). Енергія/мана в таблиці не входять, як і сказано.

**13. Повна сумка при підборі.** `TAKE`-фінішер (`action-finishers-registry.ts:95-113`): `grantToDraft` повертає `false` (`BAG_FULL`/`TOO_HEAVY`, `inventory/plan-stock.ts:10`), предмет **лишається на гексі**, дія тихо завершується (`return false`, інструмент розблоковується). У веб окремого повідомлення про повну сумку для підбору я не знайшов (`BAG_FULL` у web є лише для квестів). Для здобичі це добре (предмет не зникає), але гравець не знає чому; текст відмови — у L4.

**14. Де зберігати здобич між запитами.** Скриня/карта підземелля: у картці `ServerWorld.map` (документ `srv-world:<mapId>`, `expedition_blobs`), як звичайні гексобʼєкти на тайлах; клієнт отримує `tileDiffs` (`world/tile-diff.ts`). Фабрика: `HexObjectFactory.create(key, coords)` (`world/world-fixtures.ts:46` робить так само). Здобич після бою: у `BattleState` (документ того ж світу, `world.battle`), нове поле стану збирання. ⚠ Перевірити в L1/L2: чи серіалізація тайла зберігає кількість монет на конкретному екземплярі (`loot.amount` береться з контенту; перевизначення на екземплярі в `toJSON` не підтверджене).

**15. Скриня «Шукача скарбів» (Q3) і що переглянути після L2.** `quests/seeker-actions.ts:354-394` (`seekerOpenChest`): справжня скриня лише міняє `phase` на `collect` і шле `CHEST_OPENED` (здобичі немає); фальшива → фаза `ambush`. Скриня квесту не гексобʼєкт, а `run.chest` у документі `srv-quest`, поле малює `createTreasureField`. Після L2: підключити те саме чисте правило розкладання (L1) до `collect`-фази квесту, тобто `CHEST_OPENED` має породжувати розкладання, а `QUEST_RETURN` (`seekerReturn`) лишається завершенням; безкоштовні кроки `collect` і REQ-QST-022/023 закриваються там. Це окремий етап 2, у L2–L5 не чіпаємо.

**16. `CONTENT_VERSION` (`content/content-version.ts`, зараз 1).** Не треба підіймати: нові опційні поля (`construction.lootTableId`, `lootTableId` у каталозі бою), нові гексобʼєкти й нові поля `BattleState` з `.default` — additive; старі збережені карти містять `chest`, який і далі відкривається. Підйом потрібен лише якщо в L2 вирішимо мігрувати вже збережені скрині (не треба: стара скриня просто стає відкритою за новим правилом) або змінити зміст наявного поля. Серверні документи світу перевіряють `contentVersion` літералом (`serializedWorldSchema`), тому будь-який підйом знищив би всі збережені карти.

### Рядок за рядком: правила §1

| Правило                                    | Вердикт | Де / як                                                                                                                                                                                                                                 |
| ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 ціль і гекс `E`                      | 🔧      | потрібна нова серверна команда; `E` = позиція героя (`heroCoordinates`) на момент дії; відстань ≤ 1 перевіряє `actWorld` (`world-commands.ts:177`)                                                                                      |
| 1.1.2 дія з кільця                         | ✅/🔧   | світ: `OPEN` рукою вже є; бій: нової дії немає (п.6)                                                                                                                                                                                    |
| 1.1.3 герой переходить на ціль             | 🔧      | можливо (п.2), потрібна серверна телепортація й перевірка рендера                                                                                                                                                                       |
| 1.1.4 вільні місця                         | ✅      | `isEnterableTile` (світ) і `isFreeHex` (бій) дають основу; ⚠ бій: додати виключення гексів із `hp<=0` істотами; світ: «без предмета» = `hexobject === null`                                                                             |
| 1.1.5 `min(n, вільні)`                     | 🔧      | нова чиста функція (L1)                                                                                                                                                                                                                 |
| 1.1.6 порядок за годинниковою              | 🔧      | потрібен порядок сусідів гекса (`getHexNeighbors` у `utils/hex-utils` для світу; `hexNeighbours` у `battle/hex-battle-geom.ts` для бою) — **визначити напрямок обходу й перший сусід після `E` для odd-r і для axial окремо, з тестом** |
| 1.1.7 монети одним стосом                  | ⚠       | `TAKE` дає 1 шт. (`action-finishers-registry.ts:104`); потрібна кількість на екземплярі                                                                                                                                                 |
| 1.1.8 ціль порожня                         | 🔧      | замінити гексобʼєкт на SOLID «порожню ціль» (світ); у бою — прапорець у стані збирання                                                                                                                                                  |
| 1.1.9 `NO_ROOM_FOR_LOOT`                   | 🔧      | нова відмова до переходу героя, ціль повна                                                                                                                                                                                              |
| 1.1.10 рахує сервер, один раз, `commandId` | ✅/⚠    | сід `deriveStream(seed,'loot:<id>')` — патерн є (`utils/random-seeded`); повтор — п.11                                                                                                                                                  |
| 1.1.11 картка наведення                    | 🔧      | `build-hex-info.ts` + `build-battle-hex-info.ts`; печать «порожньо» нова                                                                                                                                                                |
| 1.2 скриня: OPEN, відкрита лишається       | ⚠/🔧    | OPEN зараз завжди відмовляє (п.3); ціна 2 Волі проти «безплатно»                                                                                                                                                                        |
| 1.2 генератор ≥ 3 сусіди                   | 🔧      | немає; правило `treasure` у `cave.ts` + перевірка в `pipeline/pieces/rules.ts`                                                                                                                                                          |
| 1.2 здобич до виходу з підземелля          | ✅      | підземелля свіже на вхід (`world-leave.ts:44-61`, `leaveOrigin` → `create`)                                                                                                                                                             |
| 1.3 надгробок                              | ⚠       | лише `hp<=0` + рендер; рушій вважає гекс вільним                                                                                                                                                                                        |
| 1.3 фаза збирання                          | 🔧      | нової фази немає; `performAction` відмовляє після `ended`                                                                                                                                                                               |
| 1.3 вихід з поля                           | ✅      | наявний `close`                                                                                                                                                                                                                         |
| 1.3 попередження один раз                  | 🔧      | віха в `progress` (як `claimedRewards`) — нове поле, схема v8 → v9 з upcaster'ом                                                                                                                                                        |
| 1.3 відновлення сесії                      | ✅/🔧   | `battleView` вже повертає ended-бій; потрібне поле здобичі в стані                                                                                                                                                                      |
| 1.4 таблиці                                | 🔧      | `LootTable` немає                                                                                                                                                                                                                       |

### Конфлікти й питання до Олега

1. ⚠ **OPEN на скрині зараз завжди відмовляє** («The chest is broken…»). Скриня — мертвий код, тому L2 це не «додати здобич», а «вперше зробити її відкривною».
2. ⚠ **Ціна відкриття скрині 2 Волі** (`constructions.content.ts`) проти «типово безплатно» в плані. Q-1: лишити 2 чи поставити 0?
3. ⚠ **Предмети SOLID, стос монет = 1 шт.** Для «один стос монет на гекс» треба кількість на екземплярі й зміна `TAKE`.
4. ⚠ **Надгробка в бою немає як даних**, а рушій вважає гекс могили вільним.
5. ⚠ **Після перемоги герой не може рухатися** (`BATTLE_ENDED`), потрібна нова фаза збирання (це L3, як і планувалось).
6. ⚠ **Дії `EYE` не існує.** Q-2: новa бойова дія (`LOOT_GRAVE`/`EYE`) у `BattleAction`, а не `EHexActionType`; на карті світу «око» залишається лише підписом.
7. ⚠ **Повтор `commandId` повертає порожні `tileDiffs`/`effects`** замість «того самого результату». Q-4: перечитувати карту на `replayed` чи писати `tileDiffs` у журнал?
8. ⚠ **Дерево й камінь не предмети** (лічильники), а тест цін дозволяє ціну лише LOOT/TOOL/EQUIPMENT. Q-3: (а) зробити їх предметами `wood`/`stone` і продавати, (б) продавати лічильник окремою командою, (в) відкласти. Без рішення L5 цей пункт пропускає.
9. ⚠ `squad.loot` і `docs/architecture/domain-model-plan.md` (на який посилається план) відсутні/невикористані; `squad.loot` прибираємо в L3.
10. ⚠ Скелет-лучник є в `battle-catalogue`, але в печері не ставиться (`archer-watch` не розставлено); таблицю створюємо, а перевірити її буде можливо лише через `/dev/battlefield`.
11. ℹ Ще один побічний висновок: `GRAVE`-гексобʼєкт (`HEXOBJECT_KEYS.GRAVE`) у виробничому коді ніде не створюється, а `world-leave.ts:53-57` саме по ньому запечатує печеру після очищення (`respawnAfterClearedMs`). Тобто запечатування «очищеного» підземелля сьогодні фактично не спрацьовує. До L3 не стосується, але гробок-гексобʼєкт на карті підземелля міг би бути тим самим механізмом. Окреме питання Олегу (Q-5), не блокує.

### Файли за фазами

- **L1 (лише нове в `packages/engine/src/loot/`):** `loot-table.ts` (Zod `LootTable`), `plan-loot-spread.ts` (чиста функція), `loot-refusal.ts`, `index.ts`, `*.test.ts`; додати експорт у `src/index.ts`. Без змін наявних файлів.
- **L2 (скриня):** `content/content-schema.ts` (`constructionSchema.lootTableId`), `content/constructions.content.ts` (`chest` → `lootTableId`, ціна дії, новий `chest-open`), `registry/hexobjects-registry.ts` (ключ), `registry/action-starters-registry.ts` (OPEN) і `action-finishers-registry.ts`, новий `world/loot-world.ts` + команда в `world/world-commands.ts` / `world-commands` Zod-схемах, `apps/api/src/world/world.service.ts` (+ `.integration.spec.ts`), `content/boards/models/cave.ts` і `boards/pipeline/pieces/rules.ts` (≥ 3 сусіди), `content/loot-tables.content.ts`, `abstraction` для кількості на екземплярі, `map/models` (серіалізація кількості), `registry/action-finishers-registry.ts` (`TAKE` бере кількість).
- **L3 (могили й збирання):** `battle/battle-state.ts` (поля збирання, additive), `battle/battle-commands.ts`, `battle/perform-action.ts`, `battle/battle-end.ts`, новий `battle/collect-phase.ts`, `battle/projection.ts`, `squads/squad-battle.ts` (`closeBattle`), `world/battle-world.ts`, `battle/battle-catalogue.ts` (`lootTableId`), `abstraction/hexobject-abstraction.ts` + `content/creatures.content.ts` (прибрати `squad.loot`), `aggregates/progress-state` (віха попередження, v9), `apps/api/src/world/world.service.ts`.
- **L4 (клієнт):** `apps/web/src/a-game-scenes/map-scene/components/battle/battle-tool-hex.vue`, `composables/battle-tool-hex.ts`, `composables/use-battle-view.ts`, `battle-board-tap.ts`, `render/battle/*` (анімація вильоту, `battle-timing.ts`, спрайти), `render/layers/battle-grave.ts`, `services/hex-info/build-hex-info.ts` і `build-battle-hex-info.ts`, `tool-hex-tile.vue`, `services/battle/battle-server.ts`, `locales/{en,uk}/ui.json`, `i18n/locale-keys.ts`, `apps/web/src/e2e/*-hooks.ts`, `apps/playwright/src/components/*`, `apps/playwright/src/features/*`, `apps/playwright/e2e/hero/` (нова спека), `apps/playwright/impact-map.ts`, `apps/api/src/cors.ts` (лише якщо з'явиться новий HTTP-метод; сподіваюсь, ні).
- **L5 (контент і економіка):** `content/loot-tables.content.ts`, `content/coin-price.test.ts`, `content/traders.content.ts` (перевірка «купити → продати не дає плюс»), нові тести `content/loot-economy.test.ts`, рішення Q-3 щодо дерева й каменю.

### Питання до Олега (вирішено 2026-11-13)

- **Q-1** вирішено: `OPEN` скрині коштує 2 Волі (значення контенту лишається), перехід героя на гекс скрині входить у дію.
- **Q-2** вирішено: нова `BattleAction` називається `LOOT_GRAVE`, мітка на кільці лишається оком.
- **Q-3** вирішено: продаж дерева й каменю поза межами (див. §5).
- **Q-4** вирішено: повтор повертає `replayed: true`, клієнт перечитує проєкцію карти, `tileDiffs` у журнал не пишемо.
- **Q-5** `GRAVE`-гексобʼєкт і запечатування очищеного підземелля: пов'язати з могилами чи окремо?

## Результати L5 (2026-11-14)

**Крок 0 (веб).** `GRAVE_LOOTED` тепер має крок `walk` у плані анімації (`battle-animation-plan.ts`: від гекса входу на гекс могили, `BATTLE_TIMING.stepMs` 190 мс; порожня могила кроку не має, бо герой стоїть). Виліт здобичі стартує після кроку: `lootSchedule(count, leadMs)` зсуває затримки на `leadMs` і ділить той самий бюджет 800 мс, `graveWalkLeadMs` (`services/loot/loot-flight.ts`) дає зсув, `grave-flights.ts` його передає. Предмети на плитках лишаються схованими з першого кадру (`pending`), тож блимання немає. Тести: два в `battle-animation-plan.test.ts`, чотири в `loot-flight.test.ts`.

**Контент.** `content/loot-tables.content.ts`: тимчасові таблиці замінено справжніми, id мають суфікс `-loot` (`cave-chest-loot`, `skeleton-warrior-loot`, `skeleton-archer-loot`, `skeleton-king-loot`). Нових предметів не знадобилось: усі ключі §1.4 вже були (`coins`, `health-bottle`, `return-scroll`, `sword`, `shield`, `axe`, `pickaxe`), **арту від Олега не потрібно**. Пляшок енергії й мани в таблицях немає. Мета економіки живе в контенті: `LOOT_ECONOMY_TARGET` (`gearKey` меч, 2-3 забіги, допуск 20%).

| Ціль          | Кидки | Гарантовано  | Розіграні записи (вага, кількість)                                                  |
| ------------- | ----- | ------------ | ----------------------------------------------------------------------------------- |
| Скелет-воїн   | 0-3   | нічого       | монети (6, 3-9), зілля здоров'я (2, 1), кістяний оберіг (2, 1)                      |
| Скелет-лучник | 0-3   | нічого       | монети (6, 3-9), зілля здоров'я (3, 1), сувій повернення (1, 1)                     |
| Скелет-король | 2-3   | монети 30-50 | меч (1, 1), щит (4, 1), сувій повернення (3, 1), зілля здоров'я (4, 1-2)            |
| Скриня печери | 2-4   | нічого       | монети (5, 10-30), зілля здоров'я (2, 1-2), щит (1, 1), сокира (1, 1), кайло (1, 1) |

Кидки `[0, 3]` дають порожню могилу в одному випадку з чотирьох (рівномірний вибір кількості); бос і скриня ніколи не порожні (`[2, 3]` з гарантованими і `[2, 4]`). Лучник у печері не ставиться, його таблиця перевіряється лише контентом.

**`squad.loot` прибрано** з `ISquad`, `squadSchema`, чотирьох загонів у `creatures.content.ts` і з `client-projection.ts` (там він лише затирався для клієнта). Доказ, що читача не було: після видалення типу `tsc` зелений у engine, api і web (читач не скомпілювався б), `grep` за `squad.loot`, `.loot` і `SquadBlock` знаходив лише запис у проєкції й один тест. Старий збережений жетон із `squad.loot` завантажується (REQ-LOOT-108). `CONTENT_VERSION` не змінено.

**Валідація при завантаженні** (`content/validate-loot.ts`, викликається з `validateContent`): кожна таблиця проходить Zod (ключ предмета з `HEXOBJECT_KEYS`); кожен крім монет предмет має `coinPrice`; кожна істота бою (крім героя) і кожна інтерактивна скриня `LOOT` називає таблицю, що існує; перший учасник загону з `boss: true` має таблицю з `guaranteed`. Чисті функції приймають дані як параметр, тому тести подають зіпсовані.

**Симуляція** (`content/loot-economy-setup.ts`): 10 000 забігів печери = скриня на справжній згенерованій печері (`planChestLoot`) + могили трьох загонів печери (двір кісток, зграя, одинак), кожен загін це справжній бій, програний ботом героя до перемоги (`battle/collect-playout-setup.ts`, спільний з `collect-sweep.test.ts`), здобич розкладається справжнім `loot-grave` по черзі (предмети з попередньої могили займають місця). Пули: 120 печер і 80/80/60 боїв, розкладка вибирається за сідом забігу; сумка порожня. Детермінована: ті самі сіди дають ті самі числа.

| Показник (10 000 забігів)                                                             | Результат                                                |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Монет за забіг                                                                        | середнє 96.2, медіана 95, 5-й перцентиль 57, 95-й 140    |
| Загальна вартість продажу за забіг (монети плюс те, що платить торговець за предмети) | середнє 216.7, медіана 202, 5-й перцентиль 141, 95-й 400 |
| Забігів до меча (500)                                                                 | 2.31 за середнім, 2.48 за медіаною                       |
| Порожніх звичайних могил                                                              | 23.8% з 43 244                                           |
| Здобичі, втраченої через тісноту                                                      | 16.4%                                                    |

**Цільове припущення й чому не щит.** «Найдешевше спорядження за 2-3 забіги» прочитано як меч (500 монет), а не щит (40, найдешевший предмет групи EQUIPMENT). Ціль залишається мечем після видалення неузгодженого трофея з дропу боса (2026-11-22). Ціль зсувається однією константою `LOOT_ECONOMY_TARGET` та числами таблиць; допуск у тесті ±20% від смуги 167-250.

**Нові тести** (нумерація продовжує REQ-LOOT; 101 і 102 уже були зайняті, тому далі 103): REQ-LOOT-103 (валідація: таблиці парсяться, відсутній id, невідомий ключ, предмет без ціни, бос без гарантованого, у загонах немає `loot`), 104 (пляшки енергії й мани поза таблицями; бос і скриня ніколи не порожні в 10 000 кидків; гарантовані бос-записи в 10 000 з 10 000; нуль місць веде гарантовані в сумку на справжній таблиці й у справжньому оточеному бою), 105 (купити, а потім продати ніколи не дає плюс для кожного товару торговця при найбільшій знижці; жодний предмет здобичі не продається дорожче за свою ціну в магазині при знижці), 106 (10 000 забігів: смуга вартості, порожні могили 20-30%, втрати від тісноти менше 25%), 107 (детермінізм), 108 (старе збереження зі `squad.loot`).

**Змінені наявні специфікації:** `collect.test.ts`, `collect-phase.test.ts`, `battle-collect-world.test.ts`, `battle-world.test.ts` (id таблиць без `provisional`; перевірка «клієнт не бачить» тепер шукає суфікс `-loot`, а тест проєкції загону більше не спирається на `sword`), `battle-collect.integration.spec.ts` (те саме), `collect-sweep.test.ts` (бере спільний `playOutSquad`).

**Перевірки:** `pnpm lint` 0 помилок, `pnpm typecheck` зелений, engine 1378 (2 skip), api 217, web 3217, playwright-пакет 37; skip 2 → 2. Повний e2e з увімкненим `graveLootEnabled`, один чистий прогін: `228 passed (10.6m)`. Спеки e2e не змінювались.

**Що лишається поза планом здобичі:** адаптер здобичі скрині «Шукача скарбів» (REQ-QST-022 і друга половина 023), засідка Q5, запечатування очищеного підземелля (Q-5), продаж дерева й каменю (Q-3), розмір сіда, нестабільний `quest-seeker` «stepping back three times».

## Журнал

| Дата       | Фаза      | Результат                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-12 | —         | План створено з рішень Олега й результатів R0, без перегляду коду                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-11-13 | L0        | Звірено з кодом, відповіді §3 і 6 питань, файли L1–L5, питання Q-1…Q-5 до Олега; код не змінювався                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-11-13 | —         | Редакція 2: рішення Олега Q-1…Q-5, нові правила §1 (один розіграш, злиття монет, порядок за `AXIAL_DIRS`, відмова на цілі, гарантовані на `E`, могили в стані бою), фази L2a/b/c, L3a/b, L5, промпти фаз, розширені тести §4; залежності Q3/Q5 у плані квестів оновлено                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-11-13 | L1        | Реалізовано `packages/engine/src/loot/` (`LootTable`, `rollLoot`, `placeLoot`), 36 тестів REQ-LOOT-001…026, workspace зелений. Рішення Олега: порядок за годинниковою на екрані (спадання індексу `AXIAL_DIRS`), 0 вільних місць → гарантовані в сумку (`to-bag`). Плани виправлено                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-11-13 | L2a       | Скриня відкривається (OPEN → `chest-open`, герой стає на її гекс, `STANDING_ON_TARGET`/`CHEST_EMPTY`/`NOT_ADJACENT`), кількість на екземплярі предмета, `TAKE` бере весь стос; здобичі ще немає (`place-chest-loot.ts` порожній). REQ-LOOT-027…053, engine 1271 / api 204 / web 3097 тестів зелені, skip 2 → 2                                                                                                                                                                                                                                                                                                                                                               |
| 2026-11-13 | L2b       | Здобич скрині на сервері: `planChestLoot`/`placeChestLoot`, таблиця `cave-chest-provisional`, `construction.lootTableId`, `NO_ROOM_FOR_LOOT`/`BAG_FULL` до списання Волі, `freeAround` у генераторі печер. REQ-LOOT-054…069, engine 1282 / api 208 / web 3097 зелені, skip 2 → 2                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-11-13 | L2c       | Скриня на клієнті: `CHEST_OPENED` ставить героя й запускає виліт ≤ 800 мс (`prefers-reduced-motion` без анімації, `data-ready` після польоту), `replayed` перечитує світ один раз, картка скрині з реченням без чисел і печаткою «порожньо», `loot.reject.*` uk/en, `TAKE` з повною сумкою каже `BAG_FULL` (єдина зміна engine), e2e `loot-chest.spec.ts`                                                                                                                                                                                                                                                                                                                    |
| 2026-11-13 | L3a       | Могили й фаза збирання на сервері за прапором `graveLootEnabled` (вимкнено): `battle/collect.ts`, `loot/plan-spread.ts` (спільний із скринею), `LOOT_GRAVE`/`pickup-loot`, проєкція з `collect`/`lootLeft`, `ACK_GRAVE_EXIT_WARNING`, тимчасові таблиці істот. REQ-LOOT-071…099                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-14 | L3b       | Могили й збирання на клієнті, `graveLootEnabled` увімкнено, віха в `progress` v9, «нічого не знайдено», підтвердження виходу, e2e `battle-collect.spec.ts`; виправлено перемикання панелі на Inventory під час підбору в бою                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-11-14 | L3b-fix   | Закриття приймання L3b без змін коду: два повні e2e поспіль з увімкненим `graveLootEnabled`: **228 passed, 0 failed, 0 flaky (15.5 хв)** і **228 passed, 0 failed, 0 flaky (10.7 хв)**; lint 0 помилок, typecheck зелений, engine 1344 / api 217 / web 3211 / playwright 37, skip 2 → 2. Таблиця класифікації: порожня (провалених і нестабільних тестів немає); єдиний збій з прогону L3b, `quest-seeker` «stepping back three times» («Nothing to step on»), у двох прогонах не повторився, вважається залежним від сида квестового поля (окремий Pixi-шар, не торкається шару вильоту, розбиття `useBattleView` чи вкладки Inventory); 10 окремих повторів не запускалися |
| 2026-11-14 | L5        | Справжні таблиці здобичі (воїн, лучник, король, скриня), порожня могила ≈ 1 з 4, `squad.loot` прибрано, валідація посилань на таблиці, симуляція 10 000 забігів (середня вартість 216.7, 2.31 забігу до меча), крок 0: хід героя на могилу перед вильотом здобичі. REQ-LOOT-103…108. **План здобичі завершено**                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-14 | LOOT-OVF  | `placeLoot` більше не губить гарантований запис: результат `{ kind: 'placed', placements, toBag }` (вид `to-bag` зник), нуль місць — те саме правило; `planLootSpread` перевіряє `BAG_FULL` проти всього `toBag` до будь-якої видачі. Виклики (світова скриня, могила, квестова скриня) вже застосовували обидва списки, події не змінились (`placed` і `toBag` можуть бути обидва непорожні). Тести: `loot/place-loot-overflow.test.ts` (REQ-LOOT-109…113), web `server-world-actions.loot.test.ts` (REQ-LOOT-114). Переписано: REQ-LOOT-013/014 і тест REQ-LOOT-104 про закриту скриню боса (форма результату). `CONTENT_VERSION` не змінено.                              |
| 2026-11-14 | QC2-green | `REQ-LOOT-096` і `098` (API) падали у 23 з 50 запусків: після L5 звичайна могила воїна кидає `[0, 3]` і буває порожньою, а тести чекали предмет на землі. Лише тести: на час блоку «with grave loot on» таблиця воїна підміняється таблицею з гарантованими монетами, усі твердження збережені; 0 з 50. Таблиці й діапазони не змінювались                                                                                                                                                                                                                                                                                                                                   |

Перевірки L3a: `pnpm lint` (0 помилок), `pnpm typecheck`, `pnpm test`: engine 1338 пройдено / 2 skip, api 217, web 3147, playwright-пакет 37; skip до й після: 2 → 2; повний e2e з вимкненим прапором: 225 пройдено (10.4 хв).
