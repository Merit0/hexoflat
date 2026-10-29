# B6b — загони як токени hexobject-ів

> **Рішення Олега (29.10.2026):** на будь-якій мапі (світ, табір, підземелля) є лише токени hexobject-ів — істоти, конструкції, здобич, ресурси, інструменти, спорядження. Взаємодія з ними вже визначена в проєкті (hex-дії). Усе, що не hexobject, прибираємо. Окремої сутності «encounter» на мапі немає.
>
> Фаза B6b замінює модель B6 «загін живе в `HexTileModel.encounter`». Правила бою (`battle/`), розстановка (`battlefield-setup`), вартовий і задача SNEAK лишаються — змінюється лише носій і шлях команд.

## 1. Що є зараз (B6) і чому це неузгоджено

| Що               | Зараз                                                                                                                                             | Проблема                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Загін на мапі    | `HexTileModel.encounter: MapEncounter` (окремий слот поруч із `hexobject`)                                                                        | не hexobject, без `groupType`                |
| Здобич після бою | той самий `encounter` у статусі `loot`, `PICKUP_LOOT`                                                                                             | не loot-токен, не `TAKE`                     |
| Дії              | окрема команда `ENCOUNTER` (attack / scout / start-sneak / answer-sneak / sneak-timeout / pickup-loot / step-ended / start-battle / close-battle) | паралельний конвеєр замість hex-дій          |
| Контент          | `encounters/encounter-content.ts` (`ENCOUNTERS`), не в контенті hexobject-ів                                                                      | загону немає в `CONTENT`, немає `spritePath` |
| Рендер           | `render/layers/encounter-layer.ts` поверх `tiles-layer`                                                                                           | другий шлях малювання істот                  |
| Web              | `encounter-store`, `services/encounters/encounter-flow.ts`, `encounter-popover`, `encounters-discovered-list`, `encounter-token`                  | окремий UI замість меню hex-дій тайла        |

## 2. Цільова модель

1. **Загін = hexobject групи `CREATURE`** у `content/creatures.content.ts`. Ключі: `lone-skeleton`, `skeleton-pack`, `bone-court`, `archer-watch` (лучники — пізніше, у печеру не ставиться). `spritePath` — спрайт ватажка (`creature-sprites`). `creature` розширюється блоком `squad` (Zod): `members`, `watcher` (прапорець вартового: такий токен нападає сам, коли герой ступає в його гекси огляду, без дії), `boss`, `loot`, `battlefieldBiome`. Стан екземпляра (`scouted`, `attempts`, `taskSeq`, `sneak`) — поля в `creature` екземпляра hexobject-а на тайлі, як `resource.isAvailable` / `regrowAt`; серіалізується разом із тайлом.
2. **Дії = hex-дії з контенту, через інструмент (рішення Олега 29.10.2026).** Герой підходить на сусідній гекс, перетягує інструмент на токен істоти (наявний механізм `tool-hex-tile` + `interactions-resolver`, як сокира на дереві) і бачить доступні дії:
   - **меч** → `ATTACK`;
   - **рука** → `SCOUT`, `SNEAK` і теж `ATTACK` (бій із тим, що в руках).

   Нові `EHexActionType.ATTACK`, `SCOUT`, `SNEAK`; які інструменти що дають — через можливості інструмента (`canAttack` уже є; додати `canScout`, `canSneak` для руки) і `actions` hexobject-а загону з `willCost` з контенту (атака 2, розвідка 1, крадькома 0) та `durationMs: 0`. Клік на ATTACK → `START_HEX_ACTION` списує Волю атомарно → картка розстановки → START BATTLE → бій, як зараз. Для дій загону `applyStartHexAction` передає керування обробнику загону (як `isWorldGate` для порталів), бо їм потрібен стан двигуна (`engagement`, `knowledge`), а не лише тайл.

3. **Решта життєвого циклу — у команді `BATTLE`:** `answer-sneak`, `sneak-timeout`, `start` (картка розстановки → бій), `close` (перемога / поразка). Вартовий (токен з `squad.watcher: true`) перевіряється в `MOVE_HERO` після кроку (замість `step-ended`) — засідка без дії гравця. Команда `ENCOUNTER` і `encounterActionSchema` видаляються.
4. **Перемога:** hexobject загону на тайлі замінюється loot-токеном зі `squad.loot` (зараз у кожного загону рівно один предмет), його підбирають звичайною дією `TAKE`. Якщо предметів стане кілька — скриня-конструкція з наявним `OPEN` (вирішує Олег, не в B6b).
5. **Поразка:** `attempts++` на екземплярі, герой у таборі (як зараз).
6. **Генератор:** деталь `objects: encounters` ставить hexobject загону на ті самі місця (treasure / chokepoint / dead-end / deep, `minSteps`). Тест «у підземеллях немає вогнища» лишається.
7. **Рендер:** `tiles-layer` малює загін за правилом `creature` (`render/object-fit.ts`), так само як героя. `encounter-layer` видаляється. Гекси огляду вартового — окремий тонкий шар підсвітки гексів (не токен), дані — з токенів із `squad.watcher: true`.
8. **Web:** ATTACK / SCOUT / SNEAK з'являються в наявному меню hex-дій тайла. `encounter-store`, `encounter-flow`, `encounter-popover` видаляються; `encounter-token` теж видаляється; `encounters-discovered-list` лишається з тим самим виглядом, але читає токени-істоти і малює їх `battle-hex-token.vue` (див. §4). Вікно SNEAK і картка розстановки працюють від стану двигуна (`engagement` / `sneak`), що читає `battle-store`.
9. **Збереження:** `HexMapModel.fromJSON` мігрує старий `tile.encounter` у hexobject загону (статус `loot` → loot-токен, `looted` → порожньо). `CONTENT_VERSION` не піднімаємо (D1), міграція адитивна з тестом.

## 3. Порядок робіт (один чат)

1. Характеризаційні тести поточної поведінки загонів (REQ-ENC-001…008) як специфікація, переписані під токени.
2. Контент + Zod-схема `squad`, нові `EHexActionType`, стартери дій загону.
3. Обробник дій загону в `applyStartHexAction`, перенесення sneak / start / close у `BATTLE`, вартовий у `MOVE_HERO`.
4. Генератор, міграція збережень, видалення `HexTileModel.encounter`, `encounters/` (крім `battlefield-setup.ts`, `threat.ts`, якщо ще потрібні — перенести в `battle/`).
5. Web: меню hex-дій, вікно SNEAK, картка розстановки, видалення encounter-UI; `tiles-layer` малює загони.
6. e2e-фічі, `pnpm lint/typecheck/test/build` + e2e, журнал, скіли, `CLAUDE.md`.

## 4. Рішення Олега (29.10.2026)

- **Вкладки (EVENTS / BATTLE):** вигляд лишається таким, як зараз; редизайн — пізніше, не в B6b. Список загонів у EVENTS лишається, але дані бере з токенів-істот, а не з `encounter` (тож `encounters-discovered-list` переписується на нове джерело даних, а не видаляється). **`encounter-token.vue` видаляється** — окремої сутності «жетон загону» немає; у рядку списку істоту показує той самий DOM-жетон істоти, що й у вкладці BATTLE (`battle-hex-token.vue`, спрайт із `creature-sprites`).
- **Загроза (easy / risky / deadly):** поки показується лише в меню дій тайла (підпис біля ATTACK). Можливо, пізніше прибираємо зовсім — не розвивати далі.

## 5. Старт чату

```
Phase B6b of docs/BATTLE-SYSTEM-PLAN.md — squads as hexobject tokens.
Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine, hexoflat-web-state, hexoflat-render, hexoflat-e2e.
Read: docs/battle-system/B6B-SQUADS-AS-TOKENS-PLAN.md (whole, §2 and §4 are Oleh's decisions),
plan §3.1, §6.1b, §7 REQ-ENC-*.
Rule: on any map there are only hexobject tokens (creature / construction / loot / …);
remove everything that is not a hexobject: HexTileModel.encounter, the ENCOUNTER command,
encounter-layer, encounter-store, encounter-flow, encounter-popover, encounter-token.
Squads are CREATURE hexobjects with a `squad` block (members, watcher, boss, loot, biome).
Interactions go through existing hex actions: drag a tool onto the creature token —
sword → ATTACK; hand → SCOUT, SNEAK, ATTACK. ATTACK spends Will, opens the deploy card,
START BATTLE runs the battle as now. A watcher token ambushes when the hero steps into its
watched hexes. Victory leaves a loot token taken with TAKE. Tabs (EVENTS / BATTLE) keep their
current look; the EVENTS list reads creature tokens and draws them with battle-hex-token.vue;
threat shows only in the action menu next to ATTACK.
Acceptance: no encounter entity left; old saves migrate; workspace green incl. e2e;
Oleh checks in the browser (D6). Journal row, skills + CLAUDE.md updated, stop.
```
