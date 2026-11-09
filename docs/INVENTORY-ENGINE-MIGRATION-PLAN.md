# Інвентар і схованка в engine: повна інструкція міграції на команди та події

Статус: **план, код не змінювався** (2026-11-08). Фази I0–I6, кожна в окремому чаті на окремій гілці за `hexoflat-phase`: характеризаційні тести спершу, коміт лише з дозволу Олега, прогрес записується в розділ «Журнал» цього файлу, e2e запускає Олег (на pre-push).

**Передумова:** гілка міграції мусить містити код схованки (`packages/engine/src/inventory/`, `apps/web/src/stores/hero-stash-store.ts`, `docs/stash/`). Це коміти гілки `hero-stash-implementation`; якщо вони вже злиті в `main`, гілку міграції створюють від оновленого `main`. Фазу I0 не починати, доки `git ls-files packages/engine/src/inventory` порожній.

Читати разом із: `CLAUDE.md` (правила №1, №2, №4), скіли `hexoflat-engine`, `hexoflat-web-state`, `hexoflat-e2e`, `docs/stash/stash-board-spec-doc-ref.md` (як збудована схованка).

---

## 1. Навіщо і що вважається успіхом

Правило №1: усі зміни стану гри йдуть через валідовані команди (Zod) і дають події домену. Інвентар і схованка цього не роблять: рух, підбір, споживання, оплата скринь і руки змінюють Pinia-store, збереження лежить у localStorage, а сервер взагалі не бачить інвентаря (`apps/api/src/game/server-action-context.ts` має заглушку `putToInventory: () => ({ ok: true })` із коментарем «tracked as follow-up debt»).

Наслідки: сервер не може авторитетно перевірити переміщення (правило №4: drop-in/drop-out co-op, передача героя, знімки, реплей); чисті правила в `packages/engine/src/inventory/` викликає лише клієнт; стан інвентаря не потрапляє у знімок.

**Успіх** = (1) кожна зміна інвентаря та схованки є командою engine з подіями; (2) стан інвентаря входить у `HexEngineState` і знімок; (3) web лише показує стан (read model) і надсилає команди; (4) UI, стилі, `data-testid` і поведінка гравця **не змінилися**; (5) `IInventoryPort` і дубльовані правила видалені; (6) сервер приймає ті самі команди.

**Не входить:** джерела монет і квести, нові механіки схованки, розмір чанка карти (окрема задача), сервер як джерело істини для всієї гри (лише готовність до нього).

---

## 2. Перевірені факти про поточний стан (2026-11-08)

### 2.1 Дані та збереження

| Що                    | Де                                                                                                                        | Деталі                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Торба й руки          | `apps/web/src/stores/hero-inventory-store.ts`                                                                             | `items: InventoryItem[]` із `slotKey`: `rXcY` для торби (сітка 12×7 із вирізаним центром 6×5 і зарезервованою клітинкою Волі `r0c0`, тобто 53 клітинки), `eq:<slot>` для 8 слотів спорядження; порожній слот руки містить предмет-заглушку `hand`; `carryCapacityKg` (за замовчуванням 10), `rotationsById`, `selectedItemId`, `isNew` |
| Схованка              | `apps/web/src/stores/hero-stash-store.ts`                                                                                 | `cells[210]`, `chests` (0–5), `activeChest`, `filter`, `starterGiven`; **спільна для всіх героїв у браузері**                                                                                                                                                                                                                          |
| Збереження            | `services/persistence/inventory-storage.ts` (`hexoflat.hero.inventory.v1`), `stash-storage.ts` (`hexoflat.hero.stash.v2`) | localStorage, без транзакцій                                                                                                                                                                                                                                                                                                           |
| Старт нового героя    | `hero-inventory-store.hydrate()` → `grantStarterScrolls()`                                                                | 50 сувоїв повернення; стартове спорядження в схованці: `STARTER_STASH_ITEMS`                                                                                                                                                                                                                                                           |
| Місце нового предмета | `pickFreeSlot()`                                                                                                          | випадкова вільна клітинка через `getStream('inventory')` (потрібен детермінізм для реплею)                                                                                                                                                                                                                                             |

### 2.2 Правила, що вже в engine (`packages/engine/src/inventory/`, 58 тестів без Pinia)

`planItemMove`, `planItemAutoPlace`, `planStoreResources`, `planSortStash`, `planUnlockStashChest`, `carriedWeightKg`, `categoryOf`, `compareItemsForSort`, константи схованки (7×6, 5 скринь, ціни 100/1000, `STARTER_STASH_ITEMS`), агрегат `IInventoryAggregate { bag, equip, stash }` (плоскі клітинки без `slotKey`). Розбіжності з легасі-кодом дивись у §6.

### 2.3 Шаблон, за яким робити: `KnowledgeState` + команда `KNOWLEDGE`

- Стан: `packages/engine/src/knowledge/state.ts`, Zod-схема, поле `revision` (оптимістична конкурентність), адитивне поле `HexEngineState.knowledge?` (`commands/apply-command.ts`) і у знімку (`commands/snapshot.ts`), без підвищення `CONTENT_VERSION`.
- Команди: `commands/hex-engine-commands.ts` (`KNOWLEDGE`, `SACRIFICE_TO_SKILL`, `RESET_SKILLS` мають `heroId` і `revision`), union + `HEX_ENGINE_COMMAND_SCHEMAS`, `case` у `applyCommand` (виняток для невідомого типу — `assertNever`), події `KNOWLEDGE_CHANGED` / `KNOWLEDGE_REJECTED { reason }`.
- Web-хост: `apps/web/src/services/knowledge/knowledge-controller.ts`: `dispatchKnowledge(host, action)` будує `HexEngineState`, викликає `applyCommand`, приймає результат, якщо є очікувана подія; запис і читання — `transactKnowledge(heroId, update)` у `services/persistence/knowledge-storage.ts` (ключ `hexoflat:knowledge:v1:<heroId>`, **Web Locks** серіалізують читання-перевірку-запис між вкладками, без `navigator.locks` падає «закрито»).
- Тест-обв'язка: `commands/command-test-context.ts`.

### 2.4 Споживачі інвентаря у web (28 файлів без тестів)

Критичні для міграції (поза чистим UI):

| Файл                                                                                                                                                                          | Що робить з інвентарем                                                                                              | Куди в цільовій схемі                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `a-game-scenes/inventory-scene/*` (`inventory-board-grid`, `inventory-token`, `equip-token`, `hero-equip-board`, `token-details-panel`) + `composables/use-inventory-drag.ts` | drag між клітинками й слотами → `moveItemToSlot`                                                                    | `MOVE_ITEM`                                                                                         |
| `stash/*`, `services/inventory/stash-transfer.ts`, `use-stash-drag.ts`, `use-stash-board-data.ts`                                                                             | переміщення, авто-розміщення, Store, Sort, оплата скринь                                                            | `MOVE_ITEM`, `AUTO_PLACE_ITEM`, `STORE_RESOURCES`, `SORT_STASH`, `UNLOCK_STASH_CHEST`               |
| `world-map-store.ts` (збирає `IActionContext.inventory`) → фінішери дій (`registry/action-finishers-registry.ts`, TAKE: `ctx.inventory.putToInventory`)                       | підбір з мапи                                                                                                       | `GRANT_ITEM` (всередині `applyCommand`, без порту)                                                  |
| `composables/use-portal.ts`                                                                                                                                                   | `countItem(SCROLL)` для ціни порталу; витрата сувою                                                                 | селектор `countItem(state, key)` і `CONSUME_ITEM`                                                   |
| `services/squads/squad-flow.ts`                                                                                                                                               | `squadLoadoutSource()` читає `equippedItems`/`items`; `closeOut` викликає `takeFromInventory` для витраченого в бою | бій читає `state.inventory` напряму; `CONSUME_ITEM`                                                 |
| `services/battle/battle-hands-gate.ts` → `bindInventoryHandsGate`                                                                                                             | під час бою зміна рук дозволена лише з оплатою Волі (`set-hands`), інакше відкат                                    | правило engine: `MOVE_ITEM` у слот руки в бою відхиляється з `HANDS_LOCKED`, шлях бою — `set-hands` |
| `stores/user-store.ts` (`logout`)                                                                                                                                             | очищає світи та інвентар                                                                                            | команда/дія скидання стану інвентаря героя                                                          |
| `composables/use-equipment-health-sync.ts`, `use-hero-details.ts`, `hero-details-board.vue`                                                                                   | читають `equippedItems` для сердець/характеристик                                                                   | селектори над станом, логіка лишається у web                                                        |
| `composables/use-item-tooltip.ts`, `use-stop-tool-when-unequipped.ts`, `use-open-inventory-on-pickup.ts`, `use-hex-board-input.ts`, `tool-hex-tile.vue`                       | читання (тултіп, активний інструмент, перемикання вкладки)                                                          | read model, без змін                                                                                |
| `apps/web/src/e2e/stash-hooks.ts`, `create-test-api.ts`                                                                                                                       | тест-хуки `setBag/getBag/setStash/getStash/setStashChests`                                                          | службова команда лише для e2e (§5, I4)                                                              |
| `apps/api/src/game/server-action-context.ts`                                                                                                                                  | заглушка порту                                                                                                      | прибрати порт; сервер приймає ті ж команди                                                          |

Суто UI-стан, що **лишається у web**: `selectedItemId`, `rotationsById`, `isNew`, `filter`, `activeChest`, `isOpen`, привид перетягування.

---

## 3. Цільова архітектура

### 3.1 Принцип атомарності

Переміщення між торбою, руками й схованкою мусить бути **одним атомарним кроком** (інакше предмет подвоюється або зникає). Зараз це забезпечує синхронна заміна двох store. Тому цільовий стан — **один агрегат на героя**, а не два незалежні записи; одна транзакція (`transactInventory`) і один `revision`.

### 3.2 Стан (ескіз, Zod у `packages/engine/src/inventory/inventory-state.ts`)

```ts
InventoryItem   = { id, key, type, stackKey?, amount }                 // без slotKey / isNew
InventoryState  = {
  heroId, revision, capacityKg,
  bag:   (InventoryItem | null)[53],        // порядок = bagSlotKeys(grid) із web, але індекс, не rXcY
  equip: Record<TEquipSlot, InventoryItem | null>,   // порожній слот = null (заглушка hand живе лише у web)
  stash: { chests: 0..5, starterGiven: boolean, cells: (InventoryItem | null)[210] },
  idSeq: number,                            // детермінований id нових предметів: `${heroId}:${idSeq}`
}
HexEngineState.inventory?: InventoryState   // адитивно; у знімку; без підвищення CONTENT_VERSION
```

### 3.3 Команди (усі з `heroId` і `revision`, як `KNOWLEDGE`)

| Команда              | Payload (понад `heroId`, `revision`)                                | Обробник викликає                                               | Події                                                                                                          |
| -------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `MOVE_ITEM`          | `from: TItemLocation`, `to`, `split`                                | `planItemMove`                                                  | `ITEM_MOVED { from, to, kind, moved }` або `ITEM_TRANSFER_REJECTED { reason }`                                 |
| `AUTO_PLACE_ITEM`    | `from`, `toContainer: 'bag' \| 'stash'`, `split`, `preferredChest?` | `planItemAutoPlace`                                             | ті ж                                                                                                           |
| `STORE_RESOURCES`    | `preferredChest?`                                                   | `planStoreResources`                                            | `STASH_RESOURCES_STORED { stacks }`                                                                            |
| `SORT_STASH`         | —                                                                   | `planSortStash`                                                 | `STASH_SORTED`                                                                                                 |
| `UNLOCK_STASH_CHEST` | — (рука з монетами вибирає engine: `coinHandSlot`)                  | `planUnlockStashChest`                                          | `STASH_CHEST_UNLOCKED { chests, price }` або відхилення (`NOT_ENOUGH_COINS`, `NO_COINS_IN_HAND`, `MAX_CHESTS`) |
| `GRANT_ITEM`         | `key`, `amount`, джерело (`pickup` \| `loot` \| `starter` \| `dev`) | нове правило `planGrant` (вага, злиття стеків, вільна клітинка) | `ITEM_GRANTED { key, amount, placedAt[] }` або `ITEM_GRANT_REJECTED { reason }`                                |
| `CONSUME_ITEM`       | `key`, `amount`                                                     | нове правило `planConsume`                                      | `ITEM_CONSUMED { key, amount }`                                                                                |

Загальні правила: схема в `HEX_ENGINE_COMMAND_SCHEMAS`, `case` лише оркеструє `plan*`, `revision` не збігся → відхилення без змін (`INVENTORY_STALE`), `Math.random()` і `crypto` заборонені (нові id з `idSeq`; вільна клітинка для підбору — детермінований вибір через `deriveStream(seed, 'inventory:<heroId>:pickup:<n>')` або перша вільна, рішення D4), кожен обробник має тест без Pinia. Події — єдиний вихід для UI, журналу подій і майбутньої синхронізації.

### 3.4 Web після міграції

- `hero-inventory-store` і `hero-stash-store` — read model: ті самі геттери (`equippedItems`, `itemsBySlot`, `items`, `carriedWeightKg`, `isOverCapacity`, `cells`, `ownedCells`, `usedCount`, `preferredRange`), але обчислені з `InventoryState`. Адаптер `slotKey ↔ індекс` (зараз `inventory-aggregate.ts`) переїжджає на межу «стан → модель для UI», щоб 28 споживачів не змінювалися.
- `stash-transfer.ts`, drag-композабли й токени лише відправляють команди та показують відхилення через `heroToolStore.setActionMessage` (тексти `stash.error.*` без змін).
- `dispatchInventory(host, command)` у `services/inventory/inventory-controller.ts` + `transactInventory(heroId, update)` у `services/persistence/inventory-storage.ts` за зразком `knowledge-controller.ts` / `transactKnowledge` (Web Locks, ключ `hexoflat:inventory:v2:<heroId>`).
- Заглушка рук `hand` залишається деталлю відображення (порожній слот у стані = `null`).

---

## 4. Рішення I0 [ПІДТВЕРДЖЕНО Олегом — 2026-11-09: D1–D7 за рекомендаціями]

| №   | Питання                                                                       | Рекомендація                                                                                                             | Наслідок вибору                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Схованка: на героя чи на кампанію                                             | **На героя** (один агрегат, одна транзакція, атомарний рух торба ↔ схованка)                                             | Зараз схованка спільна для всіх героїв у браузері; міграція копіює її поточному герою, інші починають зі стартової. Альтернатива «на кампанію» вимагає транзакції на два записи й поняття кампанії, якого в моделі ще нема |
| D2  | Сітка `rXcY` і вирізаний центр                                                | У стані індекси `bag[0..52]`; геометрію сітки лишає web                                                                  | `slotKey` зникає з моделі engine, зберігається лише у видимій моделі                                                                                                                                                       |
| D3  | Декоративне (`rotationsById`, `isNew`, `selectedItemId`)                      | Лишається у web                                                                                                          | Не стан гри, не потрапляє у знімок                                                                                                                                                                                         |
| D4  | Вибір клітинки для нового предмета                                            | Перша вільна у торбі (детерміновано); випадковість `getStream('inventory')` прибрати                                     | Поведінка розкладки зміниться (зараз випадкова). Якщо хочете лишити випадковість, потрібен `deriveStream`                                                                                                                  |
| D5  | Старі збереження localStorage                                                 | Одноразова міграція при першому завантаженні, потім ключі `v1`/`v2` видаляються                                          | Потрібні тести міграції для порожнього, звичайного й пошкодженого збереження                                                                                                                                               |
| D6  | Тест-хуки e2e                                                                 | Службова команда `E2E_REPLACE_INVENTORY` у `create-test-api.ts` під `VITE_E2E_HOOKS` (не в `HEX_ENGINE_COMMAND_SCHEMAS`) | Хуки `setBag/setStash/…` лишаються для специфікацій без змін                                                                                                                                                               |
| D7  | Місткість (`carryCapacityKg`, 10 кг, у старому збереженні запасне значення 5) | Частина `InventoryState`, змінюється лише правилами (спорядження, навички)                                               | Поки константа 10; запасне значення 5 при читанні старого збереження — помилка, виправити в I1                                                                                                                             |

---

## 5. Фази

Кожна фаза: гілка від попередньої (`inventory-engine-i0` …), перший крок — прочитати цей файл і скіли, останній — записати прогрес у §9 і запропонувати повідомлення коміту. **Фаза не змінює вигляд і поведінку для гравця, окрім явно названого.** Після кожної фази Олег запускає e2e групи `hero` та `combat` (а для I3 також `camp` і `board`), бо я e2e не запускаю.

### I0. Аудит, характеризація, рішення [DONE — 2026-11-09]

Мета: нічого не міняти в коді продукту; зафіксувати поточну поведінку й закрити D1–D7.

Кроки:

1. Скласти повну таблицю «шлях → команда» (розширити §2.4 повним `grep -rn "useHeroInventoryStore\|putToInventory\|takeFromInventory\|countItem\|equippedItems"` по `apps/web/src`, `apps/api/src`, `packages/engine/src`). Окремо знайти, хто викликає `ctx.inventory.*` у фінішерах (TAKE, USE зілля/сувій).
2. Характеризаційні тести легасі-поведінки там, де вони відсутні: `applyMoveToSlot` (заміна руки-заглушки, злиття лише в не-слот, обмін), `putToInventory` (ліміт ваги, злиття стеків, випадкове місце), `takeFromInventory`, `fillEmptySlotsWithHands`, `hydrate` (старт зі сувоями, виселення з клітинки Волі), `handsGate` (відкат у бою).
3. Звести розбіжності між легасі та `plan*` (§6) у таблицю «що збережено / що змінюється свідомо».
4. Узгодити D1–D7 з Олегом і записати рішення в §4.

Приймання: тести зелені без змін продукту; таблиця шляхів і розбіжностей у цьому файлі; D1–D7 закриті.

**Старт чату:** «Фаза I0 з docs/INVENTORY-ENGINE-MIGRATION-PLAN.md. Прочитай план і скіли hexoflat-phase, hexoflat-engine, hexoflat-web-state. Продукт не змінюй. Склади таблицю шляхів, напиши характеризаційні тести, збери розбіжності легасі та plan*, підготуй питання по D1–D7 і запитай мене.»

### I1. Стан інвентаря в engine [DONE — 2026-11-09]

Файли: `packages/engine/src/inventory/inventory-state.ts` (+ тест), `commands/apply-command.ts` (`HexEngineState.inventory?`), `commands/snapshot.ts` (серіалізація й перевірка), `apps/web/src/services/persistence/inventory-storage.ts` (читання нового формату + міграція).

Кроки:

1. Zod-схема `InventoryState`, `createInventoryState(heroId)` (порожня торба/руки, стартові сувої й схованка зі стартовим спорядженням як зараз).
2. Додати поле до `HexEngineState` і знімка зі `.default`; перевірити, що старі знімки читаються (тест «старий payload»).
3. Міграція: функція `migrateLegacyInventory({ items, rotationsById, carryCapacityKg }, stash)` → `InventoryState`: `rXcY` → індекс торби, `eq:<slot>` → `equip`, `hand` → `null`, предмети в клітинках, що не належать торбі, не губляться (покласти у вільні клітинки), порожнє збереження → стартовий стан. Усі кутові випадки з легасі-`hydrate` (виселення з `r0c0`) повторити.
4. Web поки що **лише читає** новий стан паралельно зі старим store (без перемикання), щоб порівняти їх у тесті «ідентичний вигляд».

Тести: схема приймає/відхиляє, знімок туди-назад, міграція (порожнє, звичайне, з предметом на клітинці Волі, з пошкодженим предметом, з приватними даними схованки з прапорцем `starterGiven`), незмінність вхідних даних.

Приймання: engine-тести, `pnpm build` у `packages/engine`; продукт працює як раніше; `CONTENT_VERSION` не змінений.

**Старт чату:** «Фаза I1 з docs/INVENTORY-ENGINE-MIGRATION-PLAN.md (стан інвентаря в engine). Рішення D1–D7 уже записані в §4. Дотримуйся рецепта зі скіла hexoflat-engine. Без команд, без змін UI.»

### I2. Команди переміщення

Файли: `packages/engine/src/inventory/inventory-commands.ts` (схеми), `apply-inventory.ts` (оркестратор), `commands/hex-engine-commands.ts` і `apply-command.ts` (union, реєстр схем, `case`), події в `inventory/inventory-events.ts`.

Кроки:

1. Схеми й типи для `MOVE_ITEM`, `AUTO_PLACE_ITEM`, `STORE_RESOURCES`, `SORT_STASH`, `UNLOCK_STASH_CHEST` (див. §3.3), перевірка `revision`.
2. Адаптер `InventoryState ↔ IInventoryAggregate` (поле `heroId`, `idSeq` для `newId`) і виклики існуючих `plan*`; після успіху `revision += 1`, подія `INVENTORY_CHANGED { revision }` плюс спеціальні події.
3. Відхилення без змін стану: `ITEM_TRANSFER_REJECTED { reason }` із тими самими кодами, що зараз (`WRONG_SLOT`, `OVERWEIGHT`, …) плюс `INVENTORY_STALE`.
4. Правило «руки в бою» (`HANDS_LOCKED`) як вхідний контекст команди (`battleOpen`), а не звернення до store.

Тести (без Pinia, у стилі `command-test-context.ts`): кожна команда на кожній гілці `plan*`, застарілий `revision`, подвійне виконання тієї ж команди, атомарність (предмет рівно в одному місці), незмінність вхідного стану, відповідність результатів командам старих `plan*` (регресія).

Приймання: engine-тести зелені; web ще не викликає команди.

**Старт чату:** «Фаза I2 з docs/INVENTORY-ENGINE-MIGRATION-PLAN.md (команди переміщення). Створи схеми, обробники й події за шаблоном KNOWLEDGE і рецептом hexoflat-engine. Web не чіпай.»

### I3. Підбір, споживання, руки, бій

Мета: прибрати `IInventoryPort` і всі прямі виклики `putToInventory`/`takeFromInventory`.

Кроки:

1. `GRANT_ITEM` / `CONSUME_ITEM` як команди та правила `planGrant` (вага, злиття, вільна клітинка за D4) і `planConsume` (віднімання зі стеків, порожній стек зникає, порожній слот руки → `null`).
2. Фінішери TAKE/USE (`registry/action-finishers-registry.ts`) створюють ці команди/події замість виклику порту; `IActionContext.inventory` видалити, `world-map-store.ts` більше не збирає порт; `apps/api/.../server-action-context.ts` без заглушки.
3. Портал: ціна й витрата сувою через селектор `countItem(state, key)` і `CONSUME_ITEM` у тій же транзакції, що й відкриття порталу (`use-portal.ts`); перевірити сумісність з `OPEN_PORTAL`.
4. Бій: старт бою читає руки й торбу зі `state.inventory` (замість `squadLoadoutSource()` із payload web), `closeOut` споживає предмети подією; `set-hands` змінює `equip` у стані; правило `HANDS_LOCKED` замінює `bindInventoryHandsGate`.
5. Оплата скрині монетами вже чиста; підключити до `UNLOCK_STASH_CHEST` у web разом із I4.

Тести: підбір (вага, злиття, повна торба, відсутність місця), витрата (недостатньо, рівно, частково), порт видалений (компіляція), бій (руки, `set-hands`, споживання), портал.

Приймання: engine і web unit зелені; Олег проганяє e2e `hero`, `combat`, `camp`, `board`.

**Старт чату:** «Фаза I3 з docs/INVENTORY-ENGINE-MIGRATION-PLAN.md. Прибери IInventoryPort, переведи TAKE/USE, портал і бій на стан engine. Спершу покажи мені список змінюваних файлів і ризики для e2e.»

### I4. Web як read model

Кроки:

1. `inventory-controller.ts` (`dispatchInventory`) і `transactInventory` (Web Locks) за зразком знань; хост будує `HexEngineState` із `inventory` і викликає `applyCommand`.
2. `hero-inventory-store` / `hero-stash-store` перестають містити правила й записують лише результат транзакції; геттери ті самі (див. §3.4) — 28 споживачів без змін.
3. `moveItemToSlot`, `putToInventory`, `takeFromInventory` стають тонкими обгортками команд або видаляються; `stash-transfer.ts` — диспетчер; `use-inventory-drag.ts` викликає `MOVE_ITEM`.
4. Тест-хуки e2e: `E2E_REPLACE_INVENTORY` (D6) і реалізація `setBag/getBag/setStash/getStash/setStashChests/getStashChests/grantInventoryItem` через неї, сигнатури хуків не змінюються.
5. Відхилення команд показуються тим самим банером героя; тексти `stash.error.*` та `inventory`-повідомлення без змін.

Тести: усі наявні web-тести (інвентар, схованка, drag, tile click, портал) мають пройти без правок очікувань; нові — транзакція між двома вкладками (мок Web Locks), застарілий `revision`, відкат при відхиленні.

Приймання: unit зелені; відсутні дубльовані правила в `apps/web/src/stores` і `services/inventory`; Олег проганяє e2e `hero`, `combat`.

**Старт чату:** «Фаза I4 з docs/INVENTORY-ENGINE-MIGRATION-PLAN.md. Переведи web на read model над станом engine, UI не змінюй, хуки e2e збережи.»

### I5. Збереження і синхронізація

Кроки: інвентар зберігається разом зі станом героя через `transactInventory` (одна точка запису); localStorage-ключі `hexoflat.hero.inventory.v1` і `hexoflat.hero.stash.v2` видаляються після успішної міграції (D5); `serializeState`/`deserializeState` включають `inventory`; `apps/api` приймає ті ж команди (`HEX_ENGINE_COMMAND_SCHEMAS`), інвентар зберігається на сервері або в знімку, WebSocket передає події `INVENTORY_CHANGED` та спеціальні; реплей відтворює переміщення детерміновано (id з `idSeq`).

Тести: туди-назад знімок, реплей послідовності команд, відхилення на сервері, міграція ключів, `logout` скидає інвентар героя.

Приймання: engine, web і api тести зелені; ручна перевірка: перезавантаження зберігає інвентар і схованку.

### I6. Прибирання і закриття

Кроки: видалити порт, адаптери-дублі, мертвий код і застарілі ключі локалізації/тестів; ESLint-ratchet не піднімати; оновити скіли (`hexoflat-engine`, `hexoflat-web-state`, `hexoflat-e2e`), `CLAUDE.md` (зняти застереження про виняток із правила №1), `docs/stash/stash-board-spec-doc-ref.md`; записати `[DONE — дата]` у §9.

Приймання: `pnpm lint`, `pnpm typecheck`, `pnpm test` без піднятих порогів; жодного прямого запису в стан інвентаря поза командами (grep-перевірка у цьому файлі).

---

## 6. Відомі розбіжності легасі та `plan*` (розв'язати в I0)

| Тема                  | Легасі `hero-inventory-store`           | `plan*` в engine                                               | Рекомендація                                                                |
| --------------------- | --------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Вага при переміщенні  | не перевіряється                        | зростання понад ліміт → `OVERWEIGHT`                           | залишити перевірку лише для переходів схованка → торба, як зараз у схованці |
| Сумісність зі слотом  | не перевіряється (лише UI `isDropSlot`) | `WRONG_SLOT` / `SWAP_WRONG_SLOT` (`resolveEquipCompatibility`) | залишити як у `plan*` (безпечніше)                                          |
| Заміна руки-заглушки  | видаляє `hand` і ставить предмет        | порожній слот = `null`                                         | адаптер на межі web                                                         |
| Місце нового предмета | випадкова вільна клітинка               | перша вільна (`placeInto`)                                     | D4                                                                          |
| Злиття                | лише в не-слот, `mergeItemStacks`       | те саме + повний стек → `STACK_FULL`                           | перевірити, що обмін повного стека не ламається                             |
| Бій                   | `handsGate` відкат після зміни          | немає                                                          | `HANDS_LOCKED` у I2/I3                                                      |

---

## 7. Наскрізний чекліст кожної фази

- [ ] Гілка під фазу, прочитані цей файл і скіли; нічого не змішано з іншою фазою.
- [ ] Характеризаційні тести написано **до** переносу.
- [ ] У `packages/engine/src` немає `Math.random`, `crypto`, `window`, `localStorage`, Vue, Pinia.
- [ ] Нові команди: схема, union, `HEX_ENGINE_COMMAND_SCHEMAS`, `case` в `applyCommand`, події, тест без Pinia.
- [ ] Адитивні поля мають `.default`; `CONTENT_VERSION` підвищено лише для ламкої зміни (і названо це явно).
- [ ] Ліміти ESLint engine/web не підняті (`max-lines` 371/528, `max-lines-per-function` 116/197): розбивати файли, не пороги.
- [ ] UI, стилі, `data-testid`, тексти `stash.*` без змін; e2e-специфікації не переписуються без потреби.
- [ ] `pnpm build` у `packages/engine` перед web-тестами; web/e2e читають `dist`.
- [ ] Запис прогресу в §9; повідомлення коміту запропоновано, коміт не зроблено.
- [ ] Олег запустив e2e потрібних груп (я їх не запускаю).

## 8. Ризики

| Ризик                                                                   | Захист                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Велике коло зачепленого (Inventory, бій, портал, лікування, збереження) | Малі фази; кожна лишає гру робочою; read model зберігає API store, тож споживачі не змінюються      |
| Регресії, яких не видно без e2e                                         | Олег проганяє групи після кожної фази; я готую список ризикових сценаріїв наперед                   |
| Втрата предметів при міграції збережень                                 | Міграція не видаляє старі ключі, доки новий запис не підтверджено; тести на порожні/пошкоджені дані |
| Зміна спільної схованки на «на героя» (D1)                              | Явне рішення в I0 і одноразова копія поточному герою                                                |
| Детермінізм (id, місце предмета)                                        | `idSeq` у стані, без `crypto`/`Math.random`; тест реплею                                            |
| Конфлікти між вкладками                                                 | Web Locks і `revision`, як у знань                                                                  |

## 9. Журнал прогресу

| Дата       | Фаза | Стан      | Нотатки                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ---- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-08 | План | написаний | код не змінювався                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-11-09 | I0   | готово    | Передумова виконана (`packages/engine/src/inventory/` є в гілці `inventory-stash-migration`). Додано `apps/web/src/stores/hero-inventory-store.legacy.test.ts` (14 тестів: `applyMoveToSlot`, `putToInventory`, виселення з клітинки Волі, руки-заглушки); продукт не змінено. Нова розбіжність: `putToInventory` з невідомим ключем **кидає виняток** (`Unknown Hexobject key`), а не повертає `{ ok: false }`; `GRANT_ITEM` має відхиляти. Єдині споживачі порту: `action-finishers-registry.ts` (TAKE), `apply-portal.ts` (`takeFromInventory`), `squad-flow.ts`, `settings-overlay.vue` (dev-монети), `create-test-api.ts`, заглушка в `apps/api`. D1–D7 підтверджені за рекомендаціями (§4). Далі: I1.                                     |
| 2026-11-09 | I1   | готово    | Гілка `inventory-engine-i1`. Engine: `inventory/bag-layout.ts` (сітка 12×7, 53 клітинки, `DEFAULT_CARRY_CAPACITY_KG`), `inventory-state.ts` (Zod `InventoryState`, `createInventoryState`, `mintItem` з id `<heroId>:<idSeq>`), `inventory-migration.ts` (`migrateLegacyInventory` → `{ state, overflow }`), `HexEngineState.inventory?` і знімок (адитивно, `CONTENT_VERSION` не змінено). Web: запасна місткість при читанні старого збереження 5 → 10 (D7), тест паритету `services/inventory/inventory-state-parity.test.ts` (нові стани читаються паралельно, store не перемкнуто). Тести: engine 807, web 2288, lint 0 помилок, typecheck зелений. Рішення: предмет, що не вміщається ніде, потрапляє в `overflow`, а не губиться мовчки. |
