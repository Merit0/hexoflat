# CH0 — аудит відкриття контейнерів у трьох просторах

Дата: 2026-11-14. Режим: тільки читання, жодного коду/тестів змінено. Гілка `quests-board-improvment`, HEAD `fda14886`.

Скорочення просторів: **W** = скриня світу (печера), **G** = могила бою, **Q** = скриня «Шукача скарбів».
Усі шляхи — від кореня репозиторію; `E` = «entry», гекс, з якого герой відкрив контейнер.

Ключові файли:

| Простір | Перевірка/план                                                                                                                                                                   | Застосування                                                                  | Підбір                               |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| W       | `packages/engine/src/chests/open-chest.ts` (`chestRefusal` :62, `planChestOpening` :79, `openChest` :92), `chests/plan-chest-loot.ts` (`rollChestLoot` :40, `planChestLoot` :66) | `chests/place-chest-loot.ts:16`, виклик у `commands/apply-command.ts:245-283` | hex-дія `TAKE` (фінішер, весь стос)  |
| G       | `battle/collect.ts` `lootGrave` :88                                                                                                                                              | там само :127-151                                                             | `pickupLoot` `battle/collect.ts:154` |
| Q       | `quests/seeker-chest.ts` `seekerOpenChest` :122, `openRealChest` :71                                                                                                             | там само :99-119                                                              | `seekerPickup` :192                  |
| спільне | `loot/roll-loot.ts:45`, `loot/place-loot.ts:117`, `loot/plan-spread.ts:29`                                                                                                       | —                                                                             | —                                    |

---

## 1. Матриця «правило × простір»

Позначки: ✔ same (збігається з еталоном W), ≠ differs, ∅ missing.

| Правило                         | W (світ)                                                                                                                                                   | G (могила)                                                                                                                                                                                                                                                   | Q (скриня квесту)                                                                                                                                                   | Оцінка                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Порядок перевірок**           | герой є → стою на цілі → ціль не `CHEST` → не сусідній → кімната/сумка (план) → Воля (`apply-command.ts:245-283`, Воля перевіряється ПІСЛЯ плану :262-277) | стою на могилі → немає могили → вже оглянута → не сусідня → кімната/сумка (`collect.ts:95-108`); фаза/живий герой перевіряє зовнішній `collectRefusal` :204                                                                                                  | вже відкрита (`collect` є) → фаза ≠ walking → немає скрині → не сусідня → NO_INVENTORY → кімната/сумка (`seeker-chest.ts:128-140`, `:77`)                           | ≠ (три різні порядки, `STANDING_ON_TARGET` в Q — найпершим, у W — другим)                                                                            |
| **Коди відмов**                 | `NO_HERO`, `STANDING_ON_TARGET`, `CHEST_EMPTY`, `NOT_ADJACENT`, `NO_ROOM_FOR_LOOT`, `BAG_FULL` (`open-chest.ts:15-21`)                                     | `STANDING_ON_TARGET`, `NO_GRAVE`, `GRAVE_EMPTY`, `NOT_ADJACENT`, `NO_ROOM_FOR_LOOT`, `BAG_FULL`, `WRONG_PHASE` (бій іде; виправлено в CH-P0, раніше було `BATTLE_ENDED`), `BATTLE_ENDED`/`NOT_YOUR_TURN` (`collect.ts:95-99,209-210`, `battle-rejection.ts`) | `STANDING_ON_TARGET`, `CHEST_EMPTY`, `WRONG_PHASE`, `NO_CHEST`, `NOT_ADJACENT`, `NO_INVENTORY`, `NO_ROOM_FOR_LOOT`, `BAG_FULL` (`seeker-result.ts:6-25`)            | ≠ (три незалежні списки; «порожній» = `CHEST_EMPTY` / `GRAVE_EMPTY`; «немає цілі» = `CHEST_EMPTY` / `NO_GRAVE` / `NO_CHEST`)                         |
| **Ціна (Воля)**                 | content `willCost: 2` на `CHEST` (`content/constructions.content.ts:~211`), списується після успіху плану                                                  | 0                                                                                                                                                                                                                                                            | 0 (OPEN безплатний, QC1)                                                                                                                                            | ≠ (за дизайном)                                                                                                                                      |
| **Рух героя**                   | герой стає на гекс скриньки, `revealAroundHero` (`open-chest.ts:101-104`)                                                                                  | герой стає на гекс могили, **окрім** «нічого» (`collect.ts:110-125` не рухає)                                                                                                                                                                                | герой «стоїть» на скрині через `run.collect.hero` (`seeker-chest.ts:102-106`)                                                                                       | ≠ (G: виняток для порожньої могили; W: порожній кидок усе одно рухає)                                                                                |
| **Правило кімнати**             | `planLootSpread` → `placeLoot` (`plan-chest-loot.ts:76`)                                                                                                   | той самий `planLootSpread` (`collect.ts:101`)                                                                                                                                                                                                                | той самий `planLootSpread` (`seeker-chest.ts:85`)                                                                                                                   | ✔                                                                                                                                                    |
| **«В сумку»**                   | `placeChestLoot` → `grantToDraft(...,'loot')` (`place-chest-loot.ts:27`)                                                                                   | `grantToDraft` `collect.ts:133`                                                                                                                                                                                                                              | `grantToDraft` `seeker-chest.ts:99`                                                                                                                                 | ✔ (але три копії циклу застосування, див. §2)                                                                                                        |
| **Порожній стан**               | гекс стає `CHEST_OPEN` (alpha 0.45 на клієнті), `chestRefusal` дає `CHEST_EMPTY`                                                                           | `grave.examined = true` у `state.collect.graves`                                                                                                                                                                                                             | `chest` залишається, `collect.hero == chest.hex` → `CHEST_EMPTY`; проєкція `chest.empty`                                                                            | ≠ (три різні моделі «порожньо»)                                                                                                                      |
| **Заборона повторного входу**   | `LOOT_TARGET_KEYS` (CHEST, CHEST_OPEN, GRAVE) під героєм (`open-chest.ts:32-36,69-70`)                                                                     | `graveAt(collect, actor.pos)` (`collect.ts:95`)                                                                                                                                                                                                              | `sameHex(collect.hero, chest.hex)` (`seeker-chest.ts:129-134`)                                                                                                      | ≠ (та сама семантика, три реалізації)                                                                                                                |
| **Джерело сіда**                | `state.loot.seed` = `ServerWorld.worldSeed` (`plan-chest-loot.ts:49`)                                                                                      | `state.seed` (`collect.ts:70`)                                                                                                                                                                                                                               | `run.seed` (`seeker-chest.ts:42`)                                                                                                                                   | ≠                                                                                                                                                    |
| **Мітка потоку**                | `lootStreamLabel(mapId, "col:row")` (offset) `plan-chest-loot.ts:51`                                                                                       | `lootStreamLabel(battle.id, hexKey)` (axial) `collect.ts:70`                                                                                                                                                                                                 | `lootStreamLabel(run.seed, "col:row")` — `sourceId` = **сам сід**, не id запуску (`seeker-chest.ts:42`)                                                             | ≠ (три формати ключа цілі; Q кладе сід у `sourceId`)                                                                                                 |
| **Подія і payload**             | `CHEST_OPENED { heroId, coordinates, from, placed[{coordinates,itemKey,amount}], toBag }` (`open-chest.ts:108`)                                            | `GRAVE_LOOTED { creatureId, hex, from, placed[{hex,…}], toBag, nothing? }` (`collect.ts:114,138`)                                                                                                                                                            | `CHEST_OPENED { heroId, questId, hex, from, placed[{hex,…}], toBag }` (`seeker-chest.ts:109`)                                                                       | ≠ (W і Q однакова назва, **різні поля**: `coordinates` vs `hex`; G — інша назва; веб має три парсери: `loot-flight.ts:29,75,90`, `quest-loot.ts:13`) |
| **Відмова — подія**             | `LOOT_REJECTED {heroId, reason}` + `HEX_ACTION_START_REJECTED` (`open-chest.ts:75`, `apply-command.ts:249-253`)                                            | `BATTLE_REJECTED` через `reject()` (`battle-rejection.ts`)                                                                                                                                                                                                   | `QUEST_REJECTED {heroId, questId, reason}` (`seeker-result.ts:38-47`)                                                                                               | ≠                                                                                                                                                    |
| **Підбір**                      | hex-дія `TAKE` (фінішер, весь стос, Воля за content, `BAG_FULL` → `LOOT_REJECTED`)                                                                         | `pickup-loot`: безплатно, сусідній стос, весь або нічого (`collect.ts:154-185`)                                                                                                                                                                              | `QUEST_PICKUP`: безплатно, сусідній стос (`seeker-chest.ts:192-223`), подія `QUEST_LOOT_TAKEN`                                                                      | ≠ (G і Q майже ідентичні)                                                                                                                            |
| **Поля проєкції**               | `HexInfoView.empty/note`, тайли з `quantity`                                                                                                               | `collect { graves[{hex,examined}], items }`                                                                                                                                                                                                                  | `chest.empty`, `collect { ground, seen }`                                                                                                                           | ≠                                                                                                                                                    |
| **Де зберігається «що випаде»** | **не зберігається**, кидок у момент OPEN (`rollChestLoot`)                                                                                                 | `grave.tables: string[]` при смерті, кидок у момент OPEN (`collect.ts:50-67,69`)                                                                                                                                                                             | **зберігається**: `run.chest.drop`, перекинуто при появі скрині (`seeker-actions.ts:208-215`), запасний `generateChestDrop` у момент OPEN (`seeker-chest.ts:81-83`) | ≠                                                                                                                                                    |
| **Порожній кидок**              | OPEN успішний, скриня стає `CHEST_OPEN`, герой іде (`plan-chest-loot.ts:74`)                                                                               | `nothing: true`, оглянута, герой стоїть                                                                                                                                                                                                                      | неможливий: `throw CHEST_DROP_EMPTY` (`seeker-actions.ts:214`)                                                                                                      | ≠                                                                                                                                                    |
| **Кімната навколо**             | генератор гарантує ≥ 3 вільних сусіди (`chest-room.ts`, `where.freeAround: 3`)                                                                             | ні (може бути `NO_ROOM_FOR_LOOT`, 16.4% втрат)                                                                                                                                                                                                               | R-MAP-3 гарантує ≥ 3                                                                                                                                                | ≠                                                                                                                                                    |
| **Вільні сусіди**               | `isTerrainPassable && !hexobject` (`plan-chest-loot.ts:62`)                                                                                                | `isFreeHex(state, hex)` (`collect.ts:80`)                                                                                                                                                                                                                    | `floorKeys − ground − позиція героя − скриня` (`seeker-chest.ts:50-64`)                                                                                             | ≠ (три різні визначення «вільного»; Q явно виключає гекс скрині й героя)                                                                             |
| **Ідемпотентність/реєстр**      | журнал `command_journal` + ledger `loot` через `ledgerEntriesFor` (`apps/api/src/world/world.service.ts:460`)                                              | там само, `world.service.ts:531`                                                                                                                                                                                                                             | `quest-run.service.ts:210`                                                                                                                                          | ✔ (однакова схема, три місця виклику)                                                                                                                |

---

## 2. Дубльована логіка

1. **Кидок + потік.** `rollChestLoot` (`chests/plan-chest-loot.ts:40-54`), `rollGrave` (`battle/collect.ts:69-75`), `generateChestDrop` (`quests/seeker-chest.ts:33-44`): всі три беруть таблицю, роблять `deriveStream(seed, lootStreamLabel(...))`, викликають `rollLoot`. Відрізняються лише тим, звідки сід, `sourceId` і ключ цілі.
2. **Розкладка + сумка.** Три виклики `planLootSpread` з майже однаковими аргументами: `plan-chest-loot.ts:76`, `collect.ts:101`, `seeker-chest.ts:85`.
3. **Застосування плану.** Цикл «placements → стани світу; toBag → `grantToDraft(...,'loot')`» повторено в `place-chest-loot.ts:20-29`, `collect.ts:130-135`, `seeker-chest.ts:94-99`.
4. **Сусіди цілі.** `neighboursOf` — три копії: `plan-chest-loot.ts:56`, `collect.ts:77`, `questLootNeighbours` `seeker-chest.ts:50` (кожна обходить `AXIAL_DIRS`, лише `free` різний).
5. **Конвертація координат** offset↔axial вручну в W (`plan-chest-loot.ts:75,87`) і Q (`seeker-chest.ts:80,95`); у G не потрібна.
6. **Відмови «стою на цілі / вже порожньо / не сусідній».** Три реалізації (див. рядки матриці).
7. **Підбір стосу.** `pickupLoot` (`collect.ts:154`) і `seekerPickup` (`seeker-chest.ts:192`): «знайти стос → сусідній → `bagTakesAll`/`grantToDraft('pickup')` → видалити стос → подія». Ідентичні, крім типу координат і назви події. W-підбір (TAKE) — інша природа (hex-дія).
8. **Побудова payload події** (`from`, `placed`, `toBag`) — три рази.
9. **Веб:** три парсери подій для політу (`services/loot/loot-flight.ts:29,75,90`, `services/quests/quest-loot.ts:13`) та дві таблиці відмов (`loot-rejection.ts`, `quest.refusal.*`).
10. **Рівень ціни:** `usePrice`/`willCost` для W; для G/Q Воля відсутня — не дубль, а різниця.

---

## 3. Реальні відмінності, що мають лишитися на простір

| Відмінність                                                                     | Чому лишається                                                                                                                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Воля (W: 2; G, Q: 0)                                                            | Дизайн: печера платна, збір після бою безкоштовний, квест платить на вході.                                                                                |
| Тип координат (offset у W/Q, axial у G)                                         | Бій працює в axial, карта світу в odd-r offset; конвертація — на краю адаптера.                                                                            |
| Що таке «вільний гекс»                                                          | Світ: рельєф + hexobject; бій: істоти/стіни/пили/могили/предмети; квест: підлога поля − стоси − герой − скриня.                                            |
| Модель «порожньо»                                                               | W: тайл змінює hexobject; G: прапор у `collect.graves`; Q: `collect.hero == chest.hex`. Усе — частина власного стану простору.                             |
| Порожній кидок: W рухає героя, G ні                                             | Це поведінка, закріплена тестами (`collect-nothing.test.ts`, `open-chest.test.ts`) і зачіпає UI; зміна — це геймплей, а не рефакторинг.                    |
| Кілька списків на одну ціль (G: `tables[]`, кілька смертей на одному гексі)     | Лише G має кілька джерел; `planLootSpread` вже приймає `lists[]`.                                                                                          |
| Фаза/хто діє (`collectRefusal`, `WRONG_PHASE`, `NOT_YOUR_TURN`, `NO_INVENTORY`) | Властиво просторам; у W фаза не існує.                                                                                                                     |
| Фіксація кидка (Q фіксує `chest.drop`)                                          | Q ховає випадіння до OPEN для проєкції «справжня = фальшива» (REQ-QST-032), а ще має інваріант «справжня скриня не порожня» (`CHEST_DROP_EMPTY`). Див. §5. |
| Спосіб підбору (W: hex-дія `TAKE` з Волею/зносом; G, Q: безплатна команда)      | Підбір у W — звичайна взаємодія з предметом на гексі.                                                                                                      |

---

## 4. Залежності у неправильному напрямку

Чистий модуль `loot/` (`roll-loot.ts`, `place-loot.ts`, `plan-spread.ts`, `loot-table.ts`, `loot-refusal.ts`): імпортує лише `utils/hex-utils`, `registry/hexobjects-registry` (для ключа монет у `place-loot.ts:2`), `inventory/apply-stock` (`plan-spread.ts:4`), `utils/random*`. **Не імпортує quest/battle/world.** Тести `loot/*.test.ts` не залежать від них. Знайдено:

1. `loot/plan-spread.ts:4` → `inventory/apply-stock` (`IInventoryDraft`, `grantToDraft`): loot знає про сумку. Для моделі «loot нічого не знає про контейнери» це допустимо, але `bagTakesAll` мішає розкладку з інвентарем — вказівник для §6.
2. `chests/plan-chest-loot.ts:1-9` → `content/loot-tables.content`, `content/content-accessors`, `abstraction/hexobject-abstraction`, `boards/terrain`, `map/models/*`. `chests/` — це світовий адаптер, а не контейнер: прив'язаний до `HexMapModel` і `HexTileModel`.
3. `chests/open-chest.ts:3-10` → `factory`, `hero-movement/hero-state`, `map/fog-service`, `map/models`: правило відкриття вшите в тип карти світу (змінює `tile.hexobject`, рухає героя, відкриває туман).
4. `content/loot-tables.content.ts` не імпортує quest/battle, але `content/validate-content.ts:7-9` → `quests/*`, `content/validate-loot.ts:2` → `battle/battle-catalogue`, `content/loot-economy-setup.ts:2-9` → `battle/*`, `chests/*` (тестовий/валідаційний код; це «content знає про споживачів» — не критично, але напрям «content → quests/battle» зворотний до «споживач → content»).
5. `quests/seeker-chest.ts:1-25` → `aggregates/progress-state`, `inventory/inventory-state`: Q-логіка змішує правила контейнера зі станом `progress` (Воля, `heroId`).
6. `battle/collect.ts:15` → `battle-catalogue` (`lootTableIdOfKind`): таблиця могили визначається типом істоти — залежність бойового каталогу від loot-таблиць; допустимо, але це означає, що «що лежить у контейнері» вирішує простір, не контейнер.
7. `content/loot-tables.content.ts` тримає таблиці Seeker (`SEEKER_*_CHEST_TABLE_ID`), посилання на які — з `quests/seeker-content.ts:27,61,79,108`: ідентифікатор таблиці живе в квесті, дані — у content.

«Не знайдено»: імпортів `quests/*` чи `battle/*` усередині `loot/` — немає. Імпортів `../world` у `chests/` поза тестами — немає.

---

## 5. Де створюється і зберігається список випадіння сьогодні

| Простір | Створення                                                                                                                                                                          | Зберігання                                                                                     | Що знадобиться для «список у контейнері при створенні»                                                                                                                                                                                                                                                          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W       | Не створюється до OPEN. Таблиця — `construction.lootTableId` (`constructions.content.ts:205`), кидок — `rollChestLoot` при відкритті, потік від `worldSeed` + `mapId` + ключ гекса | У тайлі лише `hexobjectKey`; ні кидка, ні сіда в тайлі                                         | Генератор печери при постановці скрині (`cave.ts`) мав би рахувати кидок і писати в `hexobject` (нове поле, напр. `contents`) — **збереження** світу вже серіалізує hexobject; але `worldSeed` на генерації доступний. Ризик: збережені печери без поля (читати як «ще не кинуто»), зміна таблиці між версіями. |
| G       | `enterCollectPhase` (`collect.ts:50-67`): записує **ідентифікатори таблиць** `grave.tables[]` у `state.collect.graves`; кидок — у OPEN                                             | `BattleState.collect.graves[].tables` (у снапшоті бою, на сервері в документі бою)             | Кидок можна робити в `enterCollectPhase` (сід і стан відомі) і писати `grave.contents: LootDrop[]` замість `tables`; поле additive. Порядок кидків (за порядком смертей) уже визначений.                                                                                                                        |
| Q       | `seeker-actions.ts:208-215`: при появі справжньої скрині `generateChestDrop` → `run.chest.drop`                                                                                    | `QuestRun.chest.drop` (`quest-state.ts:86`, `chestDropSchema`), серверний документ `srv-quest` | Уже зроблено; запасний шлях `generateChestDrop` в `seeker-chest.ts:81-83` лишився для запусків без `drop` (старі збереження).                                                                                                                                                                                   |

Важливе спостереження: **Q вже реалізує цільову модель** (контейнер несе свій список), W і G — ні. Тому «контейнер із готовим вмістом» — це поширення рішення Q, а не нова ідея.

---

## 6. Пропонований контракт (лише сигнатури)

```ts
// packages/engine/src/containers/container.ts
import type { LootDrop } from '../loot';

export type ContainerKind = 'chest' | 'grave' | 'quest-chest';

export interface ContainerState {
  readonly id: string; // стабільний ключ цілі (замість "col:row" / hexKey)
  readonly kind: ContainerKind;
  readonly at: Axial; // тільки axial усередині ядра
  readonly contents: readonly LootDrop[] | null; // null = ще не кинуто (старі збереження)
  readonly status: 'full' | 'empty';
  readonly source?: { seed: string; streamLabel: string }; // лише для lazy-roll
}

export type ContainerRefusal =
  'STANDING_ON_TARGET' | 'CONTAINER_EMPTY' | 'NOT_ADJACENT' | 'NO_ROOM_FOR_LOOT' | 'BAG_FULL';

// packages/engine/src/containers/open-container.ts
export interface OpenContext {
  actor: { at: Axial };
  container: ContainerState;
  neighbours: readonly LootNeighbour[]; // дає адаптер (визначення «вільного»)
  bag: IInventoryDraft;
}

export type OpenOutcome =
  | {
      ok: true;
      placed: { hex: Axial; itemKey: string; amount: number }[];
      toBag: { itemKey: string; amount: number }[];
      nothing: boolean;
      container: ContainerState; /* status: 'empty' */
    }
  | { ok: false; reason: ContainerRefusal };

export function openContainer(ctx: OpenContext): OpenOutcome; // чиста, без Волі і руху

// адаптер на простір
export interface ContainerSpace<TState> {
  containerAt(state: TState, hex: Axial): ContainerState | null;
  neighbours(state: TState, target: Axial): readonly LootNeighbour[];
  standsOnContainer(state: TState, actor: Axial): boolean;
  apply(state: TState, outcome: Extract<OpenOutcome, { ok: true }>, actor: Axial): DomainEvent[];
  refusalEvent(state: TState, reason: ContainerRefusal): DomainEvent;
  preconditions(state: TState, actorId: string): SpaceRefusal | null; // фаза, Воля, NO_INVENTORY
}

export function openInSpace<TState>(
  space: ContainerSpace<TState>,
  state: TState,
  actorId: string,
  at: Axial,
  bag: IInventoryDraft,
): { events: DomainEvent[]; ok: boolean };

// єдина подія
export interface ContainerOpenedPayload {
  actorId: string;
  containerId: string;
  kind: ContainerKind;
  hex: Axial;
  from: Axial;
  placed: { hex: Axial; itemKey: string; amount: number }[];
  toBag: { itemKey: string; amount: number }[];
  nothing: boolean;
}

// створення контейнера (генератор/бій/квест)
export function createContainer(input: {
  id: string;
  kind: ContainerKind;
  at: Axial;
  tableId: string | undefined;
  seed: string;
  sourceId: string;
}): ContainerState; // кидає список у момент створення
```

Примітка: `LootNeighbour`, `LootDrop`, `IInventoryDraft` — наявні типи; нових полів у `loot/` не потрібно.

---

## 7. Порядок міграції (кожна фаза зберігає поведінку)

| Фаза   | Що                                                                                                                                                                                                                     | Охороняють тести                                                                                                                                                                                                                                                                       | Прогалини (потрібен characterization-тест перед фазою)                                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0** | Characterization: зафіксувати payload подій і порядок відмов у трьох просторах дослівно                                                                                                                                | W: `chests/open-chest.test.ts` (17 it), `chest-loot.test.ts`, `chest-guaranteed.test.ts`; G: `battle/collect.test.ts`, `collect-nothing.test.ts`, `collect-phase.test.ts`, `collect-sweep.test.ts`; Q: `quests/seeker-chest-characterization.test.ts` (5), `seeker-chest-loot.test.ts` | Немає тесту «той самий сід + та сама ціль → однакові `LootDrop[]`» **між** просторами (потрібно, бо потоки різні); немає snapshot-тесту повного payload `CHEST_OPENED` W проти Q; немає тесту на `lootStreamLabel`-формат (`loot:<sourceId>:<key>`) у Q, де `sourceId == seed` |
| **P1** | Витягти спільне `rollFor(tableId, seed, sourceId, key)` і замінити три `deriveStream+rollLoot`                                                                                                                         | усі наведені вище + `loot/roll-loot.test.ts`, `content/loot-economy.test.ts` (REQ-LOOT-103…107, 10 000 запусків — найсильніша страховка)                                                                                                                                               | потрібен тест сумісності потоків: старі значення для фіксованих сідів не змінилися                                                                                                                                                                                             |
| **P2** | Витягти спільну «розкладка + застосування» (`planLootSpread` + цикл)                                                                                                                                                   | ті самі + `loot/place-loot*.test.ts`                                                                                                                                                                                                                                                   | порожньо                                                                                                                                                                                                                                                                       |
| **P3** | `neighbours` — три адаптери `LootNeighbour[]` з одним тілом обходу `AXIAL_DIRS`                                                                                                                                        | `collect-phase.test.ts` (REQ-LOOT-082), `chest-room.test.ts`, `seeker-chest-loot.test.ts` (REQ-QST-031 500 сідів)                                                                                                                                                                      | порожньо                                                                                                                                                                                                                                                                       |
| **P4** | Єдиний набір відмов і єдиний порядок: `STANDING_ON_TARGET → EMPTY → NOT_ADJACENT → ROOM/BAG`. **Це зміна поведінки Q** (порядок) — виділити окремим кроком або залишити порядок кожного простору через `preconditions` | REQ-LOOT-079/080, REQ-QST-026                                                                                                                                                                                                                                                          | немає тесту «одночасно виконується дві умови» (напр. стою на скрині І порожня) для W і G                                                                                                                                                                                       |
| **P5** | Єдина подія `CONTAINER_OPENED` — зміна контракту → web + API; робити з аліасами старих назв                                                                                                                            | e2e `loot-chest.spec.ts`, `battle-collect.spec.ts`, `quest-seeker-loot.spec.ts`; unit `quest-loot.test.ts`, `loot-flight*.test.ts`                                                                                                                                                     | немає API-тесту, що відповідь `quest:result` і `world:command` не містить `contents`/`seed` (в `CLAUDE.md` вже позначено як відкритий пункт)                                                                                                                                   |
| **P6** | Контейнер зберігає `contents` при створенні: спочатку G (`enterCollectPhase`), потім W (генератор), Q вже має                                                                                                          | усі вище + `snapshot/serialization` тести                                                                                                                                                                                                                                              | потрібен тест міграції: старий снапшот без `contents` ⇒ lazy-roll дає той самий результат, що й раніше                                                                                                                                                                         |
| **P7** | Прибрати старі функції (`planChestOpening`, `lootGrave`, `seekerOpenChest` залишаються тонкими адаптерами)                                                                                                             | повний набір                                                                                                                                                                                                                                                                           | —                                                                                                                                                                                                                                                                              |

Правило «одне витягання на коміт» зберігається; між фазами — `pnpm lint typecheck test`, баланс `loot-economy.test.ts`.

---

## 8. Клієнтська сторона: три шляхи «рука над гексом → команда»

| Шлях  | Ланцюг                                                                                                                                                                                 | Файли                                                                                                                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **W** | Рука над гексом (ring) → дія OPEN → `START_HEX_ACTION` → `hero-store.startHexAction` → `WORLD_ACTION` через сокет `world:command` → відповідь `effects`/`CHEST_OPENED` → політ здобичі | `apps/web/src/stores/world-map-store.ts:140-165` (`executeHexAction`), `stores/hero-store.ts:247`, `stores/server-world-actions.ts:20,55` (`chestOpenedOf`, `planLootFlights`), `services/player/player-socket.ts:156` |
| **G** | Рука/інструмент-гекс «око» біля могили → `collectToolTarget` → `act({kind:'loot-grave',hex})` → `WORLD_BATTLE`                                                                         | `composables/battle-collect.ts:67-79`, `composables/use-battle-collect-tool.ts:11-25`, `composables/use-battle-view.ts:226` (Take)                                                                                     |
| **Q** | Клік по гексу поля (без інструмента) → `FieldClick` `{kind:'chest'                                                                                                                     | 'pickup'                                                                                                                                                                                                               | …}`→`openQuestChest`/`pickUpQuestLoot`→`QUEST_OPEN_CHEST`/`QUEST_PICKUP`через`quest:command` | `services/quests/quest-field-model.ts:116-132`, `composables/use-quest-run-actions.ts:46-48`, `services/quests/quest-run-commands.ts:41-44` |

Чи можуть вони ділити один шлях:

- **Транспорт** — ні без зміни: три сокет-події (`world:command`, `WORLD_BATTLE`, `quest:command`) і три серверні сервіси (`WorldService`, бойова гілка `WorldService`, `QuestRunService`) із власними конвертами/ревізіями.
- **Відповідь → візуалізація** — так: політ здобичі вже спільний (`loot-flight-layer`, `planLootFlights`); різниться лише парсер події (`chestOpenedOf` / `graveLootedOf` / `questChestOpenedOf`). З єдиною подією `CONTAINER_OPENED` (P5) залишиться один парсер.
- **Вхід «рука над гексом»** — частково: W і G вже використовують один шаблон «око» в tool-гексі (CLAUDE.md, Book of Will pattern); Q навмисно без кільця (QC2: «No hand tool ring on the quest field»). Додати кільце на полі квесту — це UI-рішення Олега, не рефакторинг.
- **Відмови** — три таблиці (`loot-rejection.ts` для W і G, `quest.refusal.*` для Q) → одна за єдиного набору кодів.

---

## 9. Ризики та питання до Олега

| #   | Питання/ризик                                                                                                                                                                                                                              | Варіанти                                                                                                            | Вартість                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | **Збережені дані.** Контейнер зі збереженим `contents` змінює формат снапшота (світ, бій).                                                                                                                                                 | (a) additive поле + lazy-roll для старих (Рекомендовано); (b) `CONTENT_VERSION` bump — стирає збереження.           | (a) малий; (b) знищує прогрес усіх гравців                          |
| 2   | **Сумісність потоків.** У Q `sourceId = seed`, у W — `mapId`, у G — `battleId`. Уніфікація мітки змінить випадіння для вже існуючих запусків.                                                                                              | (a) залишити формули per-space як параметр `streamLabel` (безпечно); (b) уніфікувати та прийняти зміну випадіння;   | (a) майже нуль; (b) ламає детермінованість replay і тести економіки |
| 3   | **Порожній кидок** у W рухає героя, у G ні, у Q неможливий.                                                                                                                                                                                | (a) зберегти як є (адаптер вирішує); (b) уніфікувати на «не рухає» (змінює UX печери); (c) уніфікувати на «рухає».  | (a) 0; (b/c) геймплей + e2e + переоцінка економіки                  |
| 4   | **Порядок відмов** Q (`STANDING_ON_TARGET` перший) відрізняється.                                                                                                                                                                          | (a) зберегти через `preconditions` адаптера; (b) єдиний порядок W                                                   | (a) малий; (b) змінює відмову в рідкісному збігу умов               |
| 5   | **Єдина подія `CONTAINER_OPENED`** — ламає веб, e2e-хуки (`getQuestField`, `getGroundItems`), API-тести.                                                                                                                                   | (a) аліаси двох релізів; (b) один великий PR                                                                        | (a) середній; (b) ризик великий                                     |
| 6   | **Хто визначає таблицю контейнера**: W — hexobject content, G — каталог істоти, Q — картка квесту.                                                                                                                                         | (a) лишити в просторі, `createContainer(tableId)` приймає готове (Рекомендовано); (b) реєстр `tableId` у контейнері | (a) малий                                                           |
| 7   | **Приховування вмісту.** Якщо `contents` у стані, а клієнт читає проєкцію — треба гарантувати, що ні W-тайл, ні `collect.graves`, ні `chest.drop` не вийдуть у відповідь (REQ-QST-032, `projectWorldForClient`, `projectBattleForViewer`). | додати тести-«сторожі» на кожну проєкцію до P6                                                                      | середній, обов'язковий                                              |
| 8   | **Підбір (`TAKE` у W) не входить до моделі** — це hex-дія з Волею/зносом, не контейнерна.                                                                                                                                                  | (a) залишити поза межами; (b) окремий CH-етап                                                                       | (a) 0                                                               |
| 9   | **Q: `generateChestDrop` fallback** для запусків без `chest.drop`                                                                                                                                                                          | (a) лишити до зникнення старих запусків; (b) прибрати                                                               | (a) малий                                                           |
| 10  | ~~**Флейковий тест REQ-LOOT-096/098**~~ — **знято в CH-P0**: уже виправлено комітом `92453d7b`, 0 падінь із 50 запусків (див. §10)                                                                                                         | —                                                                                                                   | —                                                                   |

Не знайдено: єдиного місця, де всі три простори викликали б одну «відкрити контейнер»; тесту, що порівнює три простори між собою; тесту на відсутність `contents`/`seed` у `quest:result` (CLAUDE.md позначає як відкритий пункт).

---

## 10. Журнал CH-P0 (2026-11-14): характеризаційні тести, без змін продукту

Нові файли (тільки тести): `packages/engine/src/container-characterization/` (`golden-setup.ts`, `world-chest.test.ts`, `grave.test.ts`, `quest-chest.test.ts`, `golden-loot.test.ts`, `old-save.test.ts`) і `apps/api/src/player/container-secrets.integration.spec.ts`. Продуктовий код, таблиці, флаги, веб, чужі тести й `CONTENT_VERSION` не чіпались.

### 10.1 Виправлення матриці §1 і ризиків §9

1. **REQ-LOOT-096/098 не флейкові** (виправлено `92453d7b`): 0 падінь із 50 запусків `battle-collect.integration.spec.ts`. Пункт ризику №10 і згадка «~25%» в `CLAUDE.md` застаріли.
2. **G, бій іде:** код відмови `WRONG_PHASE`, а не `BATTLE_ENDED` (`BATTLE_ENDED` лише коли `state.collect` немає або дія не з набору збирання).
3. **Q, порядок підбору інший, ніж у G.** Q: `WRONG_PHASE → NO_INVENTORY → NOT_ADJACENT → NO_LOOT_THERE → BAG_FULL`. G: `NO_LOOT_THERE → NOT_ADJACENT → BAG_FULL`. У §1 цього рядка не було.
4. **Q, порожній кидок.** «Неможливий» правильно лише при створенні (`CHEST_DROP_EMPTY`). Старий забіг без `chest.drop` і з порожньою таблицею на OPEN відкривається успішно: фаза `collect`, `placed` і `toBag` порожні.
5. **Q, порядок відмов OPEN:** спершу «вже відкрита» (`STANDING_ON_TARGET` або `CHEST_EMPTY`, воно сильніше за `WRONG_PHASE`), далі `WRONG_PHASE → NO_CHEST → NOT_ADJACENT`, `NO_INVENTORY` лише для справжньої скрині, після `NOT_ADJACENT`.
6. **G, `STANDING_ON_TARGET` сильніший за `GRAVE_EMPTY`/`NOT_ADJACENT`/`NO_GRAVE`**; **W, `STANDING_ON_TARGET` сильніший за `CHEST_EMPTY`**, а `CHEST_EMPTY` сильніший за `NOT_ADJACENT` (закріплено, раніше була лише «різниця» без порядку).
7. **W, кімната перед Волею:** без місця й без Волі відповідь `NO_ROOM_FOR_LOOT`, не `INSUFFICIENT_WILL`.
8. `quest:result` у шлюзі — це дослівно відповідь `QuestRunService.execute` (`player.gateway.ts:170`), тому тест сервісу покриває сокетну відповідь.

### 10.2 Нова знахідка F-S1 (суперечить припущенню §9, ризик 7)

Знімок світу для клієнта (`world.snapshot`, він же містить `battleView`) несе на кожній **повній** скрині `hexobject.construction.lootTableId` (наприклад `"cave-chest-loot"`). Не сід, не результат кидка й не список випадіння, лише ідентифікатор таблиці (таблиці й так у спільному пакеті engine, тож це слабка, але реальна розбіжність із вимогою «жодна проєкція не називає таблицю»). Ключ `worldSeed` у знімку є, але значення це `cosmeticSeedFor` (за задумом, не витік). Тест `container-secrets` приймає лише цей ключ і окремо закріплює його наявність, тому P6 прибере його свідомо: тест тоді впаде і його оновлять. Рішення, що робити з F-S1, за Олегом (варіанти: лишити; прибрати з `projectWorldForClient`; прибрати разом із P6).

### 10.3 Що закріплює кожен файл

| Файл                                                           | Закріплює                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `world-chest.test.ts` (15)                                     | порядок `NO_HERO → STANDING → CHEST_EMPTY → NOT_ADJACENT`, заборона повторного входу (відкрита/могила/повна), подія-пара відмови та її повідомлення, кімната перед Волею, ціна 2, точний набір ключів `CHEST_OPENED`, порожній кидок (`openChest` з порожнім планом) |
| `grave.test.ts` (19)                                           | усі порядки відмов G, ціна 0 (жодних Will-подій), рух героя, кімната/сумка (`NO_ROOM_FOR_LOOT`, `BAG_FULL`, гарантовані в сумку), ключі `GRAVE_LOOTED` (із `nothing` і без), порожня могила, `GRAVE_EMPTY`, підбір (порядок, ключі `LOOT_PICKED`)                    |
| `quest-chest.test.ts` (13)                                     | порядок відмов OPEN, подія `QUEST_REJECTED`, ціна 0, рух/гекс E, ключі `CHEST_OPENED`/`QUEST_LOOT_TAKEN`, створення з порожнім дропом кидає, порожній OPEN старого забігу, проєкція `chest.empty` без `drop`, порядок підбору                                        |
| `golden-loot.test.ts` (5)                                      | точний список і розкладка для 20 фіксованих сідів на простір (світ, могила воїна, могила короля, скриня квесту: збережений дроп і розкладка) + буквальні мітки потоку `loot:<sourceId>:<ключ>` (у Q `sourceId` = сам сід)                                            |
| `old-save.test.ts` (4)                                         | Q: забіг без `chest.drop` відкривається так само, як із ним; схема не додає `drop`; W: перезавантажений світ відкривається з тим же золотим результатом; G: збережений бій (лише `tables`) дає той же золотий результат                                              |
| `container-secrets.integration.spec.ts` (4, реальний Postgres) | W, G, Q: ні відповіді, ні знімки не містять справжнього сіда, значення збереженого списку, структурних ключів (`guaranteed`, `rolls`, `entries`, `drop`, `discarded`, `tables`, `chestLootTableId`, `rngSeed`) і жодного id таблиці (крім F-S1)                      |

Стабільність: нові engine-тести 20/20, нові API-тести 20/20; `pnpm lint`, `pnpm typecheck`, `pnpm test` зелені (engine 1477, api 227, web 3282, playwright-unit 37), пропущених тестів 2 (`balance.test.ts`).

### 10.4 Прогалини з §7 (P0) і що лишилось відкритим

Закрито: однакові сід/ціль між просторами (золотий тест), повний payload і мітки потоку, перетини умов («стою на ціль і вона порожня») для W і G, міграція старих збережень без списку.
Відкрито:

- **Викинуті (discarded) дропи:** API не дає сценарію з усіканням, тому перевіряється лише відсутність ключів `discarded`/`guaranteed`/`drop`, а не конкретного відкинутого значення. Повне закриття потребує продуктової фікстури (заборонено в P0).
- **W-підбір `TAKE`** не пересписаний (лишається в `chests/take-quantity.test.ts`, не торкався).
- **Старі W/G збереження «з готовим списком»** не існують (формату ще нема), тому тест міграції P6 з `contents` можливий лише після появи поля.
- Клієнт (веб, e2e) за умовою не чіпався; політ здобичі й парсери подій не мають нових тестів.

---

## 11. Decisions (Oleh, 2026-11-14)

Відповіді на §9:

| #   | Рішення                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **1a**: additive-поле з lazy-roll для старих збережень, без `CONTENT_VERSION`.                                                                                                                                                                              |
| 2   | **2a**: мітка потоку лишається параметром простору; випадіння існуючих забігів не змінюється (золоті тести це стережуть).                                                                                                                                   |
| 3   | **Герой лишається на місці при порожньому кидку в кожному просторі** (зміна для світової скрині: сьогодні вона рухає героя). Це змінює поведінку W і робиться окремим кроком P4 з оновленням тестів і економіки; до того порожній кидок W закріплений як є. |
| 4   | **Один порядок перевірок:** передумови простору (фаза, наявність героя/сумки) → стою на цілі → порожньо → не поруч → кімната і сумка → ціна. Сьогодні Воля W іде після кімнати, а `NO_INVENTORY` Q після `NOT_ADJACENT`; це зміни порядку в P4.             |
| 5   | **Міграція по одному простору, без аліасів** подій і кодів (не два релізи подій).                                                                                                                                                                           |
| 6   | **6a**: таблицю контейнера лишає за собою простір, `createContainer(tableId)` приймає готове.                                                                                                                                                               |
| 7   | **Сторожі проєкцій у P0**, а не наприкінці (див. §10, `container-secrets.integration.spec.ts`).                                                                                                                                                             |
| 8   | **8a**: підбір `TAKE` у світі лишається поза моделлю; плюс **один спільний підбір стосу для G і Q** (їхні порядки відмов сьогодні різні, див. §10.1).                                                                                                       |
| 9   | **9a**: `generateChestDrop` fallback лишається до зникнення старих запусків.                                                                                                                                                                                |
| UI  | Поле квесту отримує інструментальне кільце руки в **останній** фазі міграції.                                                                                                                                                                               |

## 12. Журнал CH-P0, друге проходження (2026-11-15)

Нові файли поверх §10: `payload-snapshots.test.ts` (13 inline-знімків: повна подія відкриття й кожна відмова W, G, Q, подія й відмови підбору G і Q), `world-bag-full.test.ts` (знімок `BAG_FULL` світу, потрібна підміна таблиці, тому окремий файл), `double-conditions.test.ts` (9: три подвійні умови на простір, переможець сьогодні), посилений `golden-loot.test.ts` (в кожному тесті простору буквальна мітка `loot:map-chest:4:2`, `loot:b1:1,0`, `loot:golden-3:14:16` і точний список викинутих дропів до злиття монет).

Виправлення матриці:

- **W, `NOT_ADJACENT` через команду недосяжна:** світ відповідає `TOO_FAR` раніше (`actWorld`); код `NOT_ADJACENT` бачить лише `chestRefusal`. Подвійна умова «не поруч + немає місця» у W закріплена на рівні правила (`NOT_ADJACENT`).
- Порожній кидок могили залежить від сіда: тест «стою на цілі» мусить брати сід, де могила не порожня (`golden-3`), інакше герой не стає на могилу.
- `lootStreamLabel` у W бере `mapId`, у тесті це `map-chest`.

Відкрито: див. §10.4 (викинуті дропи без фікстури, `TAKE`, міграція зі списком у W/G, веб і e2e).

## 13. Журнал CH-P1–P3 (2026-11-15): спільні функції, байт-в-байт той самий вихід

Усі кроки зроблені по одному, після кожного прогін воріт (`container-characterization/`, `content/loot-economy.test.ts`, `chests/`, `loot/`, `battle/collect*`, `quests/` + `tsc`): 351 тест зелений п'ять разів поспіль, нуль правок у тестах.

| Крок            | Додано в `loot/`                                                                                                                           | Замінено                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 1. Кидок        | `roll-for.ts` (24 р.): `rollLootLists(tables, {seed, sourceId, targetKey})` (один потік на всі таблиці, як було в могилі) і `rollLootList` | тіла `rollChestLoot`, `rollGrave`, `generateChestDrop` (пара `deriveStream` + `rollLoot` більше не живе поза `loot/`) |
| 2. Застосування | `apply-spread.ts` (20 р.): `applySpreadPlan(plan, bag, place)`: `placed` через колбек простору, `toBag` через `grantToDraft('loot')`       | цикли в `placeChestLoot`, `lootGrave`, `openRealChest`                                                                |
| 3. Сусіди       | `neighbours.ts` (13 р.): `lootNeighbours(target, isFree)`, `isFree` повертає `null` для гекса поза полем                                   | три цикли по `AXIAL_DIRS` (три предикати лишились у просторах)                                                        |
| 4. Конвертація  | `offset-placement.ts` (19 р.): `offsetPlacement(placement, key)`                                                                           | ручні `axialToOffset` на розкладці у W (`coordinates`) і Q (`hex`)                                                    |
| 5. Підбір стосу | `pickup-stack.ts` (31 р.): `pickupStack({stacks, isTarget, adjacent, order, bag})`                                                         | `pickupLoot` (G) і `seekerPickup` (Q), `TAKE` у світі не чіпав                                                        |

Рядки до/після: `loot/` 265 → 377 (+112, нові файли), `chests/plan-chest-loot.ts` 95 → 89, `chests/place-chest-loot.ts` 31 → 31, `battle/collect.ts` 212 → 197, `quests/seeker-chest.ts` 223 → 220. Прибуток у просторах малий (−24), бо лишились самі правила й предикати; виграш у тому, що правила потоку, розкладки й підбору тепер в одному місці.

Що не вдалося поділити повністю, і чому:

- **Таблиця, а не її id.** Функції кидка беруть уже знайдену `LootTable`, не id: `loot/` не може імпортувати `content/loot-tables.content` (той імпортує `loot/`, вийшов би цикл). Пошук `lootTableOf(id)` лишається у просторі.
- **Порядок перевірок підбору.** G перевіряє «стос є» перед «поруч», Q навпаки. Щоб не міняти поведінку, `pickupStack` має параметр `order: 'stack-first' | 'adjacent-first'`. Прибрати його можна лише в P4 (єдиний порядок), це змінює відмову.
- **Видалення стосу.** Q прибирав усі стоси на гексі, G лише перший за індексом; спільна функція повертає `remaining` без усіх стосів гекса. Різниця могла б проявитись тільки при двох стосах на одному гексі, а розкладка таких не робить.
- **Атомарність сумки.** Спільний підбір спершу перевіряє `bagTakesAll`, потім `grantToDraft`; у Q раніше невдалий `grantToDraft` міг торкнутись чернетки, тепер ні (спостережуваного ефекту нема).
- **Світовий `TAKE`** лишився окремою hex-дією (рішення 8a).
- `loot/` як і раніше не імпортує `quests/`, `battle/`, `chests/`, `world/`.

## 14. Журнал CH-P4a (2026-11-15): світова скриня відкривається через `containers/`

Нове: `containers/` (`container.ts`: `ContainerState`, `ContainerRefusal`; `open-container.ts`: чистий `openContainer`/`accessRefusal`; `open-in-space.ts`: `ContainerSpace`, `openInSpace`, `ContainerPrice`), світовий адаптер `chests/world-container-space.ts`, виклик у `commands/apply-command.ts` (`willPriceOf` складає ціну Волі: перевірка після місця, списання перед застосуванням). Подія й поля `CHEST_OPENED` без змін. Видалено `chests/place-chest-loot.ts` і `openChest`/`planChestOpening`. F-S1 закрито: `projectTileForClient` прибирає `construction.lootTableId` (клієнт його не читав, grep порожній). Web: `CONTAINER_EMPTY` у таблиці відмов (uk/en, текст як `CHEST_EMPTY`). Г і К не чіпав.

| Очікування                                              | Було                                       | Стало                                                | Рішення §11                       |
| ------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- | --------------------------------- |
| world-chest: відмова «не повна скриня» перед «не поруч» | `CHEST_EMPTY`                              | `CONTAINER_EMPTY`                                    | 4 (один порядок), 5 (без аліасів) |
| world-chest: усі коди мають повідомлення                | ключ `CHEST_EMPTY`                         | `CONTAINER_EMPTY`                                    | 5                                 |
| world-chest: другий OPEN на порожній                    | `CHEST_EMPTY`                              | `CONTAINER_EMPTY`                                    | 5                                 |
| world-chest: порожній кидок                             | герой ставав на скриню                     | герой лишається на місці, `placed`/`toBag` порожні   | 3                                 |
| double-conditions (світ): порожня і не поруч            | `CHEST_EMPTY`                              | `CONTAINER_EMPTY`                                    | 5                                 |
| payload-snapshots (світ): `reason` і назва тесту        | `CHEST_EMPTY`                              | `CONTAINER_EMPTY`                                    | 5                                 |
| chests/open-chest.test REQ-LOOT-039                     | `CHEST_EMPTY`                              | `CONTAINER_EMPTY`                                    | 5                                 |
| API container-secrets: F-S1                             | дозвіл і закріплений тест на `lootTableId` | `lootTableId` у маркерах заборони, тест перевертнуто | 1a / F-S1                         |

Рядки `chests/`: `open-chest.ts` 118 → 69, `plan-chest-loot.ts` 89 → 89, `place-chest-loot.ts` 31 → 0, `world-container-space.ts` 0 → 100; `containers/` 0 → 158 (без тестів). Golden-loot, тести G і Q без правок. Перевірки: engine 1518 passed / 2 skipped, api 227, web 3286, lint 0 помилок, typecheck зелений, e2e `loot-chest.spec.ts` 5/5.

## 15. Журнал CH-P4b (2026-11-15): могила відкривається через `containers/`

Нове: `battle/grave-container-space.ts` (`graveSpace()`: `ContainerSpace` над `BattleState`, `graveAt`, `collectActorRefusal` для умов «фаза, герой живий, свій хід»). `lootGrave` викликає `openInSpace`, ціна 0, потік `loot:<battleId>:<q,r>` і кілька таблиць на одній могилі як було. Порожній кидок (hero stays, `nothing: true`) тепер дає ядро (`outcome.nothing`), у `grave-container-space` лише формування події. `GRAVE_LOOTED` без змін, підбір стосу з параметром `order` не чіпав. Світ і квестова скриня без правок.

**Розширення контракту (одне, і чому).** `ContainerState.contents`, `OpenInput.contents` і `ContainerSpace.rollContents` стали списком списків `LootLists` (було один `LootDrop[]`): могила кидає кілька таблиць, і `planLootSpread` ділить їх за списками, тож злиття в один список змінило б розкладку (golden-loot). Світовий адаптер обгортає свій результат у `[ ... ]`, поведінка світу та його тести не змінились.

Коди відмов: `NO_GRAVE` і `GRAVE_EMPTY` прибрано, обидва стали `CONTAINER_EMPTY` (ядро P4a: відсутній контейнер = порожній; рішення 4, 5). Наслідок для гравця: «Тут немає могили.» зникло, натомість «Нічого не знайдено!» (недосяжно з UI, клік лише на нарисованій могилі).

| Очікування                                                                  | Було                             | Стало                                                                                    | Рішення §11 |
| --------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| grave.test: далека гекса без могили                                         | `NO_GRAVE`                       | `CONTAINER_EMPTY`                                                                        | 4, 5        |
| grave.test: далека оглянута могила; повторне відкриття                      | `GRAVE_EMPTY`                    | `CONTAINER_EMPTY`                                                                        | 4, 5        |
| double-conditions (могила): порожня й не поруч                              | `GRAVE_EMPTY`                    | `CONTAINER_EMPTY`                                                                        | 5           |
| payload-snapshots (могила): ключі `NO_GRAVE`/`GRAVE_EMPTY`, `rejected`      | `NO_GRAVE`, `GRAVE_EMPTY`        | ключі `CONTAINER_EMPTY_NO_GRAVE`/`CONTAINER_EMPTY_EXAMINED`, `rejected: CONTAINER_EMPTY` | 5           |
| battle/collect.test, collect-nothing.test, world/battle-collect-world.test  | `NO_GRAVE`/`GRAVE_EMPTY`         | `CONTAINER_EMPTY`                                                                        | 4, 5        |
| web battle-collect.test, ui.json `battle.reject`, `use-battle-collect-tool` | ключ `GRAVE_EMPTY`, є `NO_GRAVE` | ключ `CONTAINER_EMPTY` (текст «Нічого не знайдено!» той самий), `NO_GRAVE` прибрано      | 5           |

`battle/collect.ts` 197 → 127 рядків (+95 у `grave-container-space.ts`). Golden-loot, collect-sweep, loot-economy, світові та квестові файли без правок. Перевірки: lint/typecheck зелені, engine 2 skipped, web 3283, api 227 (один прогін дав збій у `REQ-QST-036`, квест, не грав: окремо 3 з 3 й повний повторний прогін зелені), e2e `battle-collect.spec.ts` 3/3.

## 16. Журнал CH-P4c (2026-11-15): квестова скриня відкривається через `containers/`, один підбір стосу

Нове: `quests/quest-chest-space.ts` (`questChestSpace(helpers)`: `ContainerSpace` над `QuestChestOpening { progress, source, board, inventory, tableId, result }`; передумови `WRONG_PHASE` (лише коли немає `collect` і фаза не `walking`, тож уже відкрита скриня лишається за `STANDING_ON_TARGET`/`CONTAINER_EMPTY`) і `NO_INVENTORY`). `seekerOpenChest` викликає `openInSpace`, ціна 0. `chest.drop` = вміст контейнера, без нього лазі-кидок `generateChestDrop` (мітка потоку без змін). Приманка проходить ті самі перевірки з порожнім вмістом (кімната не може відмовити, R-MAP-3), відрізняється лише гілка успіху (`AMBUSH_SPRUNG`, `ambush`). `pickupStack` без параметра `order`: один порядок для G і Q (передумови простору, немає стосу, не поруч, сумка). Коди `CHEST_EMPTY` і `NO_CHEST` у квесті прибрано, обидва стали `CONTAINER_EMPTY` (рішення 4, 5). Контракт `containers/` не змінено. Web: текст `CONTAINER_EMPTY` для квесту вже діє через `loot.reject.*` (P4a), додано лише випадок у `quest-loot.test.ts`.

| Очікування                                                | Було                            | Стало                                                                                                        | Рішення §11 |
| --------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- |
| quest-chest: відкрита скриня, герой осторонь              | `CHEST_EMPTY`                   | `CONTAINER_EMPTY`                                                                                            | 4, 5        |
| double-conditions (квест): порожня й не поруч             | `CHEST_EMPTY`                   | `CONTAINER_EMPTY`                                                                                            | 5           |
| quest-chest: немає скрині (після фази)                    | `NO_CHEST`                      | `CONTAINER_EMPTY`                                                                                            | 4, 5        |
| quest-chest: подія відмови без скрині                     | `reason: NO_CHEST`              | `reason: CONTAINER_EMPTY`                                                                                    | 5           |
| quest-chest: далека скриня без сумки                      | `NOT_ADJACENT`                  | `NO_INVENTORY` (передумова першою); з сумкою лишається `NOT_ADJACENT`                                        | 4           |
| quest-chest: порядок підбору                              | …NOT_ADJACENT, NO_LOOT_THERE, … | …NO_LOOT_THERE (далека порожня гекса), NOT_ADJACENT (далекий стос), …                                        | 8, крок 6   |
| seeker-actions REQ-QST-014; seeker-chest-loot REQ-QST-026 | `NO_CHEST`, `CHEST_EMPTY`       | `CONTAINER_EMPTY`                                                                                            | 5           |
| payload-snapshots (квест): ключі й `reason`               | `CHEST_EMPTY`, `NO_CHEST`       | `CONTAINER_EMPTY_EXAMINED`, `CONTAINER_EMPTY_NO_CHEST`; далекий підбір `NOT_ADJACENT` -> `NO_LOOT_THERE_FAR` | 4, 5, 8     |

Підбір могили не змінився (вона вже була «стос першим»), очікування G без правок. Світові файли, golden-loot, old-save тест без правок. Новий тест `quests/seeker-chest-lure.test.ts` (справжня й приманка: відмови байт-в-байт однакові, проєкція до OPEN однакова). `seeker-chest.ts` 220 -> 164 рядки (+97 у `quest-chest-space.ts`). Перевірки: engine 1522 passed / 2 skipped, web 3283, api 227, lint 0 помилок, typecheck зелений, e2e `quest-seeker*` 15/15.

## 17. Журнал CH-P6 (2026-11-15): контейнер несе вміст і статус, створюється однією фабрикою

Нове: `containers/create-container.ts` (`createContainer({ id, kind, at, tables, seed, sourceId, targetKey })`: таблиці приходять готові, вміст кидається тим самим потоком `lootStreamLabel(sourceId, targetKey)`, що й раніше при відкритті, статус `full`; `containers/` нічого не імпортує з `content/`, `chests/`, `battle/`, `quests/`), `containerStateSchema` і `emptiedContainer` у `containers/container.ts`. `LootLists` тепер змінний `LootDrop[][]` (щоб збігався зі схемою).

| Простір | Де зберігається контейнер                                                                                                                                                                | Хто створює                                                                                                                                               | Запасний шлях для старих збережень                                 |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| W       | `hexobject.container` (additive поле `IBaseHexobject`, відновлюється в `hydrateHexobject` через фабрику) на тайлі; після OPEN на `chest-open` стоїть `{ status: 'empty', contents: [] }` | `chests/create-chest-containers.ts` з `createServerWorld` одразу після генерації карти (там відомі `worldSeed` і `mapId`; сам генератор карти їх не знає) | скриня без поля: лінивий `rollChestLoot`, статус з ключа hexobject |
| G       | `Grave.container` (additive, у `BattleState.collect.graves`)                                                                                                                             | `enterCollectPhase` після злиття таблиць однієї могили (один кидок на могилу)                                                                             | могила без поля: лінивий кидок із `tables`, статус з `examined`    |
| Q       | `QuestRun.chest.container` (additive); `chest.drop` пишеться як і раніше (читачі й золотий хелпер)                                                                                       | `seekerStep` при появі справжньої скрині; правило «справжня скриня не порожня» (`CHEST_DROP_EMPTY`) лишилось у `quests/`                                  | запуск з лише `drop`, а далі `generateChestDrop` (рішення 9a)      |

Клієнт: `projectTileForClient` прибирає `hexobject.container`, проєкції бою й квесту його не беруть. `CONTENT_VERSION` не чіпано, подій, кодів відмов і міток потоків не змінено, золоті тести й `loot-economy` без правок (у `loot-economy-setup.ts` реплей бою з іншим сідом знімає `container` з могили, бо імітує ліниве відкриття).

Правки тестів через нове поле: `container-characterization/grave.test.ts` (очікуваний список могил містить `container`; `setGraveTables`), `quest-chest.test.ts`, `payload-snapshots.test.ts`, `seeker-chest-loot.test.ts` (імітація «старої скрині» знімає і `container`), `seeker-chest-characterization.test.ts`, `battle/collect-nothing.test.ts` (нова допоміжна `setGraveTables` пересоздає контейнер). Нові тести: `containers/create-container.test.ts` (в т.ч. 3 × 10 000 викликів, ніколи порожньо), `container-characterization/container-migration.test.ts` (старий світ/бій/квест = свіжий для 20 сідів; кругова серіалізація; кидок при створенні = кидок при відкритті для всіх скринь згенерованої печері), API `container-secrets` (маркери `"contents"`, `"kind":"grave"|"quest-chest"`, `"status":"full"`; знімки до і після OPEN у W, G, Q).

Перевірки: engine 1611 passed / 2 skipped, api 228, web 3283, lint 0 помилок, typecheck зелений, e2e не запускались (видимих змін немає). REQ-QST-036: API 1 збій із 30, engine 0 з 30, не виправлялось.

## 18. Журнал CH-P5 (2026-11-15): одна подія `CONTAINER_OPENED`, один парсер у вебі

**Gate (крок 1).** Перший прогін економіки в P6 показав 33,1% втраченого, бо симуляція перевстановлює `seed` бою (`${runSeed}:${label}`) _після_ перемоги, а збережений контейнер уже був кинутий зі старим сідом: `rolled` рахувався за новим сідом, а лежало те, що в контейнері за старим, тому різниця рахувалась як «втрата». Тоді контейнер знімали (`delete grave.container`). Тепер симуляція перестворює контейнер могили тією ж фабрикою `createContainer` з новим сідом, без зняття: числа збігаються з ледачим шляхом до цифри (10 000 запусків): монет за запуск mean 95.6 (median 94, p5 57, p95 139), ціна продажу mean 214.6, до меча 2.33 запуску, порожніх звичайних могил 23.8% з 43 244, втрачено через тісноту 21.8% (замір ледачого шляху до зміни був тим самим).

**Контракт.** Ядро (`openInSpace`) саме збирає подію; `ContainerSpace.apply` повертає `{ opened: { from, placed, toBag } | null, events }` і лише пише стан простору. Лура квесту дає `opened: null` (лише `AMBUSH_SPRUNG`, як і раніше).

| Простір | Було                                                                                                                  | Стало                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| World   | `CHEST_OPENED { heroId, coordinates(offset), from(offset), placed[{ coordinates(offset), itemKey, amount }], toBag }` | `CONTAINER_OPENED { actorId, containerId, kind:'chest', hex, from, placed[{ hex, itemKey, amount }], toBag, nothing }` (усе axial) |
| Grave   | `GRAVE_LOOTED { creatureId, hex, from, placed[{hex,...}], toBag, nothing? }` (`nothing` лише при порожньому)          | той самий `CONTAINER_OPENED` з `kind:'grave'`, `nothing` завжди є                                                                  |
| Quest   | `CHEST_OPENED { heroId, questId, hex(offset), from(offset), placed[{ hex(offset), ... }], toBag }`                    | той самий `CONTAINER_OPENED` з `kind:'quest-chest'` (axial)                                                                        |

Специфічні поля: `questId` — немає читачів (парсер квесту його не читав), прибрано; `creatureId` у бою — замінено `actorId` (той самий id, читає `battle-animation-plan`); `heroId` — замінено `actorId`. Старі назви не залишено аліасами.

**Клієнт.** Видалено три парсери (`chestOpenedOf`, `gravePlayedOf`, `questChestOpenedOf`); єдиний `containerOpenedOf(events, toBoard)`; перетворення axial → offset робить викликач через аргумент `toBoard` (світ і квест — `axialToOffset`, бій — `offsetOf` дошки). `graveWalkLeadMs`, `use-battle-collect-tool` і план анімації читають нову подію. Replay зі старою назвою події не падає (replayed-відповідь перечитує світ ще до парсингу; парсер не знаходить старої назви).

**Тести.** Оновлено лише знімки відкриття (`payload-snapshots.test.ts.snap`, 5 знімків, ключі тестів перейменовано); знімки відмов і золоті тести без правок (допоміжні `golden-setup.ts` конвертують axial → offset, рядки золотих значень ті самі).
