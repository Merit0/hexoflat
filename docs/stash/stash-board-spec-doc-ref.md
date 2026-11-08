# Stash — вкладка «Схованка» в кемпі (специфікація для Claude Code)

Макет (інтерактивний): https://claude.ai/artifact/Jp4DK2CAgwAZWJnbUR9Nif
Гілку створює Олег. **Не комітити** — Олег комітить сам. Скіли, які треба прочитати перед роботою: `hexoflat-phase`, `hexoflat-engine`, `hexoflat-web-state`, `hexoflat-e2e`.

---

## 0. Що будуємо — одним абзацом

Коли герой у стані **Camping**, у правій панелі з'являється вкладка **STASH** (між INVENTORY і SKILLS). Панель під вкладками поділена на дві рівні половини:

- **верх — BAG**: компактний інвентар героя (рядок EQUIPPED + сітка CARRIED), зі своїм вертикальним скролом;
- **низ — STASH**: сітка схованки кемпу зі своїм скролом, фільтрами й кнопками «Store resources» / «Sort».

Між половинами — **розділювач**, який тягнеться (25–75%). Предмети перетягуються між будь-якими клітинками так само, як зараз в Inventory board. Предмети в схованці **нічого не важать**; у сумці діє ліміт ваги.

Фізична гра: схованка = окрема картка-дошка «Скриня кемпу» з такою ж сіткою; правила переміщення (стек, розділення, вага) відтворюються руками.

---

## 1. Розвідка перед кодом (обов'язково, ~15 хв)

Перед першою правкою прочитай і коротко запиши в чат, як зараз влаштовано:

1. `apps/web/src/stores/hero-inventory-store.ts` — форма стану сумки (масив клітинок? `Record`?), розмір, де живуть `equip`-слоти, як рахується `carriedWeightKg / carryCapacityKg`.
2. Як зараз виконується переміщення в Inventory board: store action чи engine command? Знайди `use-inventory-drag`, `inventory-token.vue`, `equip-token.vue`, `hero-equip-board.vue`.
3. `resolveInventoryView` у `packages/engine` — що вже є з правил стеків (`maxStack`/`amount`), ваги, сумісності зі слотами (`equipSlot`).
4. Як визначається стан Camping і поточна локація героя (`heroLocation`).
5. `services/persistence/*-storage.ts` — як зберігається інвентар.

**Правило вибору шляху:** якщо переміщення в інвентарі вже йде через `applyCommand` — додаємо stash як нові команди (розд. 3.3). Якщо через store action з викликом чистих функцій — робимо так само, але **правила в будь-якому разі в `packages/engine`** (чисті функції), store лише викликає їх і застосовує результат. Не дублювати правила в компонентах.

---

## 2. Модель даних

### 2.1 Адреса клітинки (engine, `packages/engine/src/inventory/item-location.ts`)

```ts
export type TItemContainer = 'bag' | 'stash' | 'equip';
export type TItemLocation =
  | { container: 'bag'; index: number }
  | { container: 'stash'; index: number }
  | { container: 'equip'; slot: TEquipSlot };
```

Якщо в інвентарі вже є власний тип адреси — розширити його, а не створювати паралельний.

### 2.2 Стан схованки

```ts
export interface IStashState {
  cells: (IInventoryItem | null)[]; // той самий тип предмета, що й у сумці
  capacity: number; // STASH_CAPACITY
}
```

- Константи в engine (`packages/engine/src/inventory/stash-constants.ts`): `STASH_CAPACITY = 64`, `STASH_COLUMNS = 8`.
- Сумка в цьому UI теж рендериться **по 8 колонок**. Кількість клітинок сумки береться з наявного стану, вигадувати нову не треба.
- Схованка належить **профілю гравця/героя на рівні кампанії**, а не мапі: дошка генерується заново на кожен прогін, а схованка має переживати прогони.

### 2.3 Збереження

- `apps/web/src/services/persistence/stash-storage.ts`: окремий ключ (за зразком storage інвентаря), Zod-схема на читання, порожня схованка, якщо даних немає або вони биті.
- Це **адитивна** зміна: `CONTENT_VERSION` **не піднімати**, сейви мап не чіпати.

---

## 3. Правила (engine, чисті функції + тести)

Файл: `packages/engine/src/inventory/item-transfer.ts` (+ `item-transfer.test.ts`). Усі функції чисті й нічого не мутують, а повертають новий стан або помилку.

```ts
export interface IInventoryAggregate { bag: Cells; equip: Record<TEquipSlot, Item|null>; stash: Cells; }

export type TTransferResult =
  | { ok: true; next: IInventoryAggregate; kind: 'move'|'swap'|'merge'|'split'|'equip'|'auto' }
  | { ok: false; reason: TTransferError };

export type TTransferError =
  | 'WRONG_SLOT'          // предмет не підходить у слот
  | 'SWAP_WRONG_SLOT'     // обмін повернув би в слот несумісний предмет
  | 'STACK_FULL'
  | 'SPLIT_TARGET_TAKEN'  // розділення лише на порожню клітинку або той самий стек
  | 'OVERWEIGHT'          // сумка+спорядження > capacity і вага зростає
  | 'CONTAINER_FULL'
  | 'STASH_LOCKED';       // герой не в кемпі

planItemMove(agg, from, to, opts: { split: boolean; capacityKg: number; stashOpen: boolean }): TTransferResult
planItemAutoPlace(agg, from, toContainer: 'bag'|'stash', opts): TTransferResult
planStoreResources(agg, opts): TTransferResult      // усі resource+consumable з bag → stash
planSortStash(agg): TTransferResult                 // злиття стеків + сортування
carriedWeightKg(agg): number                        // bag + equip; stash не рахується
```

### 3.1 `planItemMove`: порядок перевірок (як у макеті)

1. `from == to` → no-op (повернути `ok:false` не треба, UI просто нічого не робить: окремий `{ ok: true, next: agg, kind: 'move' }` без змін або `null`. Обери один варіант і задокументуй).
2. Якщо `from` або `to` = stash і `!stashOpen` → `STASH_LOCKED`.
3. `to` = equip і `item.equipSlot !== to.slot` → `WRONG_SLOT`. Інструменти (сокира, кайло) мають `equipSlot: 'weapon'`, як і зараз.
4. **Злиття**: ціль має той самий `hexobjectKey` **і ту саму рідкість**, предмет стековий → перенести `min(room, n)`; `room == 0` → `STACK_FULL`. Залишок лишається на місці.
5. **Розділення** (`split && amount > 1`): переноситься `floor(n/2)`, і лише на порожню клітинку (інакше `SPLIT_TARGET_TAKEN`; злиття з п.4 має пріоритет).
6. **Обмін**: ціль зайнята іншим предметом → поміняти місцями; якщо `from` = equip, а предмет-ціль не підходить у цей слот → `SWAP_WRONG_SLOT`.
7. **Переміщення** в порожню клітинку.
8. **Вага** (після будь-якої операції): якщо `carriedWeightKg(next) > capacityKg` **і** `> carriedWeightKg(agg)` → `OVERWEIGHT`. Операції, що зменшують вагу, дозволені навіть при перевантаженні.

### 3.2 `planItemAutoPlace` (кидок на панель, подвійний клік, ПКМ, Enter)

- Спершу доповнити наявні неповні стеки того самого ключа й рідкості в цільовому контейнері (по порядку індексів), потім покласти в перший `null`.
- Не влазить → `CONTAINER_FULL`. Далі перевірка ваги, як у п.8.
- З `split` переноситься половина стеку.

### 3.3 Команди (лише якщо інвентар уже в command pipeline, див. розд. 1)

`MOVE_ITEM { heroId, from, to, split }`, `AUTO_PLACE_ITEM { heroId, from, toContainer, split }`, `STORE_RESOURCES { heroId }`, `SORT_STASH { heroId }`.
Схема + union + `HEX_ENGINE_COMMAND_SCHEMAS` + case в `apply-command.ts`; case лише оркеструє `plan*`. Події: `ITEM_MOVED`, `ITEM_TRANSFER_REJECTED { reason }`, `STASH_SORTED`.

### 3.4 Сортування схованки

Порядок категорій: gear → tool → consumable → resource → quest. Далі рідкість (від найрідшої: God Executor → боси → моби), далі назва за i18n-ключем (стабільне сортування за ключем, **не** за перекладеним текстом, щоб результат не залежав від мови).

### 3.5 Тести (Vitest, без Pinia)

Кожна гілка з 3.1–3.4: злиття з залишком, повний стек, розділення непарного стеку (7 → 3 переноситься, 4 лишається), розділення на зайняту клітинку, обмін зі слотом (валідний/невалідний), перевантаження при взятті зі схованки, дозвіл зменшувати вагу при перевантаженні, auto-place у повну схованку, `STASH_LOCKED`, сортування стабільне й зливає стеки, предмети в stash не входять у `carriedWeightKg`.

---

## 4. Стан у `apps/web`

| Що                                                | Де                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Клітинки схованки (реактивний read model)         | новий `apps/web/src/stores/hero-stash-store.ts` (тримає `cells`, `open/close`, `apply(next)`; правил не містить) |
| Збереження                                        | `services/persistence/stash-storage.ts`                                                                          |
| Чи доступна вкладка                               | computed у composable з `hero-store` (Camping)                                                                   |
| Drag, hover, ціль, авто-скрол, підсвітка          | composable (розширити `use-inventory-drag`)                                                                      |
| Пропорція розділювача, згорнутий EQUIPPED, фільтр | composable `use-stash-layout.ts`; пропорція в `ui-settings-store` (там дозволений localStorage)                  |

- **Не чіпати `world-map-store.ts`.** Якщо здається, що треба, значить щось змодельовано неправильно.
- Застосування результату `plan*`: одна функція-оркестратор (у `services/` або в store як intent) записує `next.bag/equip` у `hero-inventory-store`, а `next.stash` у `hero-stash-store`. Обидва записи в одному синхронному кроці, щоб не було проміжного стану з дубльованим предметом.

---

## 5. UI — компоненти й файли

Папка: `apps/web/src/a-game-scenes/map-scene/components/stash/`

| Файл                    | Роль                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `stash-board.vue`       | уся вкладка: camp-плашка, `.split`-грід, футер з підказкою й легендою                    |
| `stash-bag-pane.vue`    | верхня панель: заголовок BAG + вага, loadbar, перемикач EQUIPPED, сітка CARRIED у скролі |
| `stash-chest-pane.vue`  | нижня панель: заголовок STASH + `N / 64`, 2 іконкові кнопки, фільтри, сітка в скролі     |
| `stash-splitter.vue`    | розділювач: `role="separator"`, pointer + клавіатура                                     |
| `stash-scroll-box.vue`  | обгортка скролу: затемнення країв + кнопка «N more items below»                          |
| `stash-camp-banner.vue` | плашка «Camp stash · Opens only while camping…» + чип Camping                            |

Перевикористати (не копіювати): `inventory-token.vue` (клітинка з предметом, світіння рідкості, лічильник стеку), `equip-token.vue` (слот), іконки з `item-icons.ts`, тултіп `useItemTooltip()` / `item-tooltip.vue`, якщо вже реалізований (інакше лишити наявний hover).

`hero-board-panel.vue`: додати вкладку STASH між INVENTORY і SKILLS, видиму лише при Camping (`v-if`). Якщо герой виходить з Camping, поки вкладка відкрита: перемкнути на INVENTORY, а drag, що триває, скасувати.

### 5.1 Розкладка (точні значення з макета)

- Панель: ширина 560, фон `#191D20`; тіло `padding: 12px 16px`, `gap: 10px`, `display:flex; flex-direction:column; height:100%`.
- Вкладки: 5 колонок; активна `linear-gradient(#6A1234,#4E0C27)` + рамка `#8C1C47`; неактивна `#2A0E18`/`#3A1422`; Cinzel 11.5px, `letter-spacing .1em`, висота 42. У STASH іконка скрині 14px.
- `.split`: `display:grid; grid-template-rows: minmax(0, var(--a)) 22px minmax(0, var(--b))`, де `--a = ratio fr`, `--b = (1-ratio) fr`, `ratio ∈ [0.25, 0.75]`, типово 0.5.
- Панель (sec): фон `#262E33`, рамка `#36424A`, радіус 14, `padding 10px 12px`, `gap 8px`, `display:flex; flex-direction:column; min-height:0`.
- Сітки: 8 колонок, `gap 6px` (4px при ширині < 440), клітинка `aspect-ratio:1`, радіус 9.
  - порожня: `#161B1E`, рамка `#2A3338`, `inset 0 2px 8px rgba(0,0,0,.55)`;
  - з предметом: `#232B30`, рамка `#3A474E`, hover `#5A6B75`, `cursor: grab`, `touch-action: none`;
  - порожній слот спорядження: пунктирна рамка, тьмяна іконка слоту `#4C5A62` + підпис 9px uppercase.
- Скрол-бокс: `position:relative; flex:1; min-height:0`; всередині `position:absolute; inset:0; overflow-y:auto; overscroll-behavior:contain`; затемнення 26px зверху/знизу кольором панелі, показуються лише коли є що прокрутити.
- Кнопка «N more items below»: по центру знизу, `#1E2427`, рамка `#3A474E`, радіус 999. Клік прокручує на 80% висоти. Рахує предмети, чий верх нижче видимої межі. Під час drag ховається.
- Шкала ваги: 5px, трек `#0B0D0E`, заповнення `#CDB98E`, понад 85% `#E0A93F`; при `OVERWEIGHT` два блимання червоною рамкою (0.5s).
- Розділювач: лінії `#2E363A` по боках, у центрі «пігулка» `#121517` з двома рисками й текстом `DRAG TO RESIZE` (Cinzel 10.5px); hover/focus/drag дає золоту рамку `#E8D7A8`. `cursor: row-resize`.
- Футер `#111416`, радіус 12: підказка Cinzel 10.5px + легенда світіння (7 кольорів рідкості — з `RARITY_COLOR` нової системи realms, не хардкодити в компоненті).
- Шрифти: `var(--font-main)` (Cinzel) для заголовків; для тексту наявний основний шрифт. Кирилиці в Cinzel немає: для `uk` потрібен запасний шрифт, як у Hero spec.

### 5.2 Стани клітинок під час drag (CSS-класи)

| Клас                     | Коли                                                                 | Вигляд                                              |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------- |
| `is-lifted`              | джерело drag                                                         | `opacity .3`                                        |
| `is-fit`                 | слот спорядження, куди підходить предмет                             | рамка + inset `#4A8BE0`                             |
| `is-next`                | перша вільна клітинка в **іншому** контейнері (куди ляже auto-place) | пунктирна рамка `#7BD88F` 55%                       |
| `is-valid`               | ціль під курсором, `plan` ok                                         | рамка + inset 2px `#7BD88F` + glow                  |
| `is-invalid`             | ціль під курсором, `plan` помилка                                    | рамка + inset 2px `#F08A7A`                         |
| `is-dim`                 | у схованці не проходить фільтр                                       | вміст `opacity .18` (клітинка лишається drop-ціллю) |
| `is-landed` / `is-shake` | після успіху / відмови                                               | scale 1.12 → 1 за 0.28s / зсув ±3px за 0.3s         |

Панель як ціль (кидок не на клітинку): `zone-ok` / `zone-bad` дають зелену або червону рамку всієї панелі.

Привид предмета: `position:fixed`, 64px, `scale(1.1)`, `drop-shadow(0 10px 14px rgba(0,0,0,.7))`, `pointer-events:none`; під ним бейдж дії (`Move`, `Swap`, `Stack +3`, `Split 3`, `Equip`, `To bag`, `To stash`, червоний `Can't drop`). При Shift-drag привид показує половину стеку.

---

## 6. Взаємодія — повний список

1. **Drag** починається після зсуву ≥ 5px від `pointerdown` (клік без руху не стартує drag). Pointer Events, тож працює мишею й дотиком.
2. Під час руху: `elementFromPoint` → клітинка `[data-cell]` або панель `[data-zone]`. `plan*` викликається **лише при зміні цілі** (кешувати за ключем), а не на кожен `pointermove`.
3. **Авто-скрол**: щокадру (`requestAnimationFrame`), якщо курсор у межах 40px від верхнього/нижнього краю скрол-боксу (по X усередині панелі), прокручувати зі швидкістю `ceil(відстань/4)`, максимум 14px за кадр. Після прокрутки ціль перераховується.
4. **Drop**: ok → застосувати `next`, анімація `is-landed` на цілі; помилка → тост з причиною + `is-shake`, а для `OVERWEIGHT` ще й блимання шкали ваги.
5. **Esc** або `pointercancel` скасовує drag без змін.
6. **Shift** у момент `pointerdown` вмикає режим розділення.
7. **Подвійний клік / ПКМ / Enter** на предметі: `planItemAutoPlace` в інший контейнер (stash ↔ bag; equip іде в stash) + зелений тост «Stored in stash» / «Taken to bag».
8. **Store resources**: `planStoreResources`, тост «Stored N stacks in the stash.» або «No resources or consumables in the bag.»
9. **Sort**: `planSortStash`, скрол схованки на верх, тост.
10. **Фільтри** All / Gear / Tools / Resources / Consumables лише притемнюють, позиції не змінюються (інакше drag у відфільтрованій сітці ламає індекси).
11. **Розділювач**: drag змінює `ratio`; подвійний клік повертає 0.5; ↑/↓ змінюють на 0.05; `aria-valuenow` = відсоток. Значення зберігається в `ui-settings-store`.
12. **EQUIPPED ▾** згортає рядок спорядження; у згорнутому стані поруч 8 міні-квадратиків (заповнений = слот зайнятий).
13. **Тултіп**: на hover/focus клітинки з предметом, ліворуч від клітинки (якщо не влазить — праворуч); під час drag прихований. Рядок підказки: «Double-click: store in stash / take to bag».
14. Інші вкладки в мокапі неактивні, у грі вони працюють як зараз.

---

## 7. i18n

`src/locales/{uk,en}/…` (ui-ключі, не content):

```
stash.tab                 STASH / СХОВАНКА
stash.campTitle           Camp stash / Схованка кемпу
stash.campHint            Opens only while camping. Stored items weigh nothing. / Відкривається лише в кемпі. Предмети тут нічого не важать.
stash.bag / stash.equipped / stash.carried / stash.title
stash.resize              Drag to resize / Тягни, щоб змінити розмір
stash.moreBelow           {n} more item below | {n} more items below
stash.filter.{all,gear,tool,resource,consumable}
stash.action.store / stash.action.sort
stash.hint.idle / stash.hint.drag / stash.hint.split
stash.drop.{move,swap,merge,split,equip,toBag,toStash,cant}
stash.toast.{stored,taken,storedMany,nothingToStore,sorted}
stash.error.{WRONG_SLOT,SWAP_WRONG_SLOT,STACK_FULL,SPLIT_TARGET_TAKEN,OVERWEIGHT,CONTAINER_FULL,STASH_LOCKED}
```

Engine повертає **коди** помилок, а текст підставляє UI через `t('stash.error.' + reason, { … })`.

---

## 8. `data-testid` і Playwright

Нові testid:
`hero-tab-stash`, `stash-board`, `stash-bag-pane`, `stash-chest-pane`, `stash-splitter`, `stash-load-value`, `stash-count`, `stash-equip-toggle`, `stash-cell-<index>`, `stash-bag-cell-<index>`, `stash-equip-<slot>`, `stash-filter-<id>`, `stash-store-resources`, `stash-sort`, `stash-more-bag`, `stash-more-chest`, `stash-toast`.
Кожна клітинка має `data-item-key`, `data-item-amount`, `data-rarity` (порожня — без них).

Тест-хук (`apps/web/src/e2e/create-test-api.ts`, гард `VITE_E2E_HOOKS` інлайн): `getStash()`, `getBag()`, `setStash(cells)`, `setBag(cells)`, `setCamping(true|false)`. Тести не перераховують правила, а питають застосунок.

Шари (скіл `hexoflat-e2e`):

- Component `apps/playwright/src/components/stash-board.component.ts`: `dragBagToStash(i, j)`, `dragStashToBag(j, i)`, `dragToPane(from, pane)`, `shiftDrag(...)`, `doubleClickCell(...)`, `resizeSplit(ratio)`, `verifyCell(...)`, `verifyLoad(...)`, `verifyToast(code)`. Drag — через `mouse.down/move(steps)/up`, не `dragTo` (HTML5 DnD тут не використовується).
- Feature `stash.feature.ts` (кожен метод у `this.step`).
- Spec `apps/playwright/e2e/stash.spec.ts`, сценарії:
  1. вкладка видима лише при Camping;
  2. перенести дерево з сумки в схованку → вага зменшилась, у схованці стек;
  3. злиття стеку із залишком;
  4. Shift-drag ділить 7 → 3/4;
  5. взяти важку броню при майже повній сумці → `OVERWEIGHT`, стан без змін;
  6. drop на панель кладе в першу вільну клітинку, навіть коли вона за межами видимої області;
  7. Store resources + Sort;
  8. стан схованки переживає перезавантаження сторінки (debounce ~750мс: перевіряти після стабілізації, не через `expect.poll` на перше значення).

---

## 9. Порядок робіт (фази, кожна закінчується зеленими тестами)

1. **S1 — engine**: типи адрес, `stash-constants`, `item-transfer.ts` + тести. Без UI.
2. **S2 — стан**: `hero-stash-store`, `stash-storage`, оркестратор застосування результату, тест-хук.
3. **S3 — розкладка**: вкладка, `stash-board` і дві панелі зі скролом, розділювач, рендер предметів через наявні токени. Поки без drag.
4. **S4 — взаємодія**: розширити `use-inventory-drag` (ціль-панель, авто-скрол, `is-next`, бейдж дії), подвійний клік / ПКМ / Enter, тости, анімації.
5. **S5 — дії схованки**: фільтри, Store resources, Sort, «N more below».
6. **S6 — e2e + i18n**: сценарії з розд. 8, переклади uk/en.

Після кожної фази записати прогрес у цей документ (секція «Прогрес» нижче) і зупинитися: Олег перевіряє й комітить.

## 10. Чекліст приймання

- [ ] Правила тільки в `packages/engine`, тести без Pinia; у компонентах і stores логіки переміщення немає
- [ ] `world-map-store.ts` не змінений; нових циклів імпорту немає; пороги ESLint не піднімались
- [ ] `CONTENT_VERSION` не змінений
- [ ] Обидві панелі скроляться незалежно; drop у невидиму клітинку працює через авто-скрол і через кидок на панель
- [ ] Вага: схованка не рахується; перевантаження блокує лише операції, що збільшують вагу
- [ ] Стан схованки зберігається між прогонами мапи й перезавантаженнями
- [ ] Працює мишею, дотиком (pointer events) і з клавіатури (Tab / Enter / Esc / ↑↓ на розділювачі)
- [ ] Вигляд збігається з макетом при 560px і при ширині телефона

## Прогрес

_(заповнює Claude Code після кожної фази)_

### Рішення Олега (2026-11-08), що замінюють розд. 5–6 цього документа

Дошка відкривається дією OPEN рукою по Stash Chest і **замінює вміст правої панелі** (як Книга Волі), без нової вкладки і без умови «Camping»; зверху нова компактна BAG, знизу STASH; вигляд береться з нашого CSS, а не з макета; існуючий Inventory і зображення предметів не змінюються; скриня стає робочою (integrity > 0, без заглушки «broken»). Схема, правила й engine зі специфікації лишаються в силі.

### S1 — engine [DONE — 2026-11-08]

Файли `packages/engine/src/inventory/`: `item-location.ts`, `stash-constants.ts` (64 / 8), `stash-state.ts` (`IStashState`, `emptyStash`), `transfer-types.ts`, `item-queries.ts`, `placement.ts`, `plan-item-move.ts`, `plan-auto-place.ts`, `plan-stash-actions.ts`, `item-transfer.ts` (публічний вхід). 5 тестових файлів, 39 тестів, без Pinia. Engine: 770 тестів зелені, tsc, eslint, `pnpm build` чисті. `CONTENT_VERSION` не змінений, команд у pipeline не додано (переміщення йдуть через store, див. розд. 1).

Відхилення і уточнення від тексту специфікації:

- Тип предмета — наявний `InventoryItem`. Поля `slotKey` і `isNew` належать адаптеру в web (S2): правила їх не читають і не переписують. Порожній слот спорядження в агрегаті це `null`; адаптер перетворює «руку-заглушку» `hand` на `null` і назад.
- Поки герой «не в кемпі» замінено прапорцем `stashOpen` (його вмикає відкрита дошка); `STASH_LOCKED` повертається, коли він `false`.
- Додано коди `EMPTY_SOURCE` та `INVALID_LOCATION`, види результату `store`, `sort`, `noop` і поле `moved` (одиниці для move/merge/split/auto, стеки для store). Скидання на ту саму клітинку це `ok: true, kind: 'noop'` з тим самим об'єктом `next`.
- Сумісність зі слотом бере наявне `resolveEquipCompatibility`: у слот руки, як і зараз, іде будь-який придатний предмет (інструмент, зілля), у решту слотів лише спорядження зі своїм слотом.
- Злиття: однаковий `stackKey` і стековий предмет; рідкість задана на ключ у контенті, тож окремої перевірки не потрібно. Злиття в слот спорядження заборонено (як у store).
- `planItemAutoPlace` і `planStoreResources` працюють за принципом «все або нічого» для кожного стеку; нові ідентифікатори розділених стеків дає параметр `newId` (engine не викликає `crypto`).
- Порядок сортування: категорія (gear, tool, consumable, resource, quest), далі рідкість `god-executor, spark-boss, gloom-boss, idol-boss, spark, gloom, idol`, предмети без рідкості в кінці, далі `hexobjectKey`. Порядок босів між царствами мій вибір, його легко змінити в `TONE_SORT_ORDER`. Категорія «consumable» це LOOT із `usePrice`, решта LOOT це «resource»; «quest» поки порожня.
- Вага: `carriedWeightKg` = сумка + спорядження, схованка не рахується; зростання понад ліміт дає `OVERWEIGHT`, зменшення дозволене завжди.

### S2 — стан [DONE — 2026-11-08]

Web, без UI дошки (вона в S3):

- `services/persistence/stash-storage.ts` (+ тест): ключ `hexoflat.hero.stash.v1`, Zod на читання, биті/невідомі/дубльовані клітинки стають порожніми, завжди повертає 64 клітинки, версія контенту не збігається значить «нічого не збережено».
- `stores/hero-stash-store.ts` (+ тест): `cells`, `isOpen`, `hydrate/open/close/replaceCells`; правил немає.
- `services/inventory/inventory-aggregate.ts` (+ тест): адаптер нашої сітки `rXcY` (53 клітини: 12×7 без центру під спорядження і без слота Волі) до плоских клітинок engine і назад. Порожня «рука-заглушка» стає `null` і лишається на місці, якщо слот не зайнятий; предмет на незнайомій клітинці не губиться.
- `services/inventory/stash-transfer.ts` (+ тест на справжніх store): `moveItem`, `autoPlaceItem`, `storeResources`, `sortStash`, `readInventoryAggregate`. Результат `plan*` застосовується одним синхронним кроком: спершу `items` інвентаря, потім клітинки схованки, обидва зберігаються. Відмова не змінює жодного store.
- `composables/use-stash-board.ts`: `openStashBoard()` відкриває store і праву панель, `closeStashBoard()`.
- `tool-hex-tile.vue`: OPEN рукою по `stash-chest` відкриває схованку (як Книга Волі, до `executeHexAction`). Ціна 0 Волі, як у контенті.
- Скриня робоча: `integrity: 1000` у контенті, а в `build-hex-info` stash-скриня ніколи не «Broken» (збережені мапи тримають старе значення 0). Інша скриня (LOOT) і заглушка «chest is broken» у стартері OPEN не чіпались: це інша функція.
- Тест-хуки `getStash/getBag/setStash/setBag` у `e2e/stash-hooks.ts`. Хук `setCamping` не потрібен: умови «Camping» немає.
- E2E: очікування в `hex-info-tooltip.spec.ts` для stash-скрині змінено на «interactable» (не запускалось).

Поки немає S3, дія OPEN лише ставить `isOpen = true` і відкриває праву панель, видимої дошки ще нема. Автозакриття (відхід героя, початок бою) і кнопка закриття входять в S3 разом з дошкою.

### S3 — розкладка [DONE — 2026-11-08]

Дошка видима, без взаємодії (drag, подвійний клік тощо в S4). Файли в `apps/web/src/a-game-scenes/map-scene/components/stash/`: `stash-board.vue`, `stash-bag-pane.vue`, `stash-chest-pane.vue`, `stash-splitter.vue`, `stash-scroll-box.vue`, `stash-cell.vue`, `stash-item-token.vue` (+ тест дошки). Допоміжні: `composables/use-stash-board-data.ts`, `use-stash-session.ts`, `stash-split.ts`.

- **Вигляд з нашого CSS:** рамка, заголовок small-caps `#ffe98a`, орнамент-розділювач і шрифт взяті з Книги Волі (вона так само замінює панель); клітинки, бейдж кількості, світіння рідкості й тултіп з Inventory; панелі `rgba(0,0,0,.35)` з рамкою `rgba(255,255,255,.1)` як `center-hole` та hint. Кольорів і шрифтів зі специфікації немає.
- **Замість вмісту панелі:** `hero-board-panel.vue` показує `<stash-board v-if="stashStore.isOpen">` перед Книгою Волі; мобільне накладання (`.is-knowledge`) діє й для схованки.
- **Розкладка:** нагорі скриня і назва, потім BAG (вага, шкала, рядок EQUIPPED на 8 слотів зі згортанням, сітка CARRIED з 53 клітинок у скролі), розділювач, STASH (лічильник, 64 клітинки у скролі), підказка внизу. Сітки по 8 колонок, клітинки квадратні (`aspect-ratio`), затемнення країв скролу через `mask-image`.
- **Розділювач:** `role="separator"`, перетягування вказівником, ↑/↓ на 5 %, подвійний клік повертає 50 %, межі 25–75 %, значення в `ui-settings-store` (`stashSplitRatio`, зберігається).
- **Закриття (`use-stash-session.ts`):** кнопка ×, Esc, відхід героя на інший гекс, зміна локації, початок бою, відкриття Книги Волі.
- **Тултіп** предмета з схованки працює (`use-item-tooltip` шукає й у схованці). Існуючі компоненти Inventory не змінені, `inventory-token.vue` не перевикористано: він прив'язаний до store інвентаря та drag, тому зроблено окремий показовий токен з тими ж спрайтами; в S4 його, ймовірно, варто об'єднати з перетягуванням.
- **Заплановано на потім:** «N more below» і фільтри (S5), `data-testid` для решти (`stash-filter-*`, `stash-store-resources`, `stash-sort`, `stash-toast`) разом із діями (S4–S5). Уже є: `stash-board`, `stash-bag-pane`, `stash-chest-pane`, `stash-splitter`, `stash-load-value`, `stash-count`, `stash-equip-toggle`, `stash-close`, `stash-cell-<i>`, `stash-bag-cell-<i>`, `stash-equip-<slot>` з `data-item-key`, `data-item-amount`, `data-rarity`.

### S4 — взаємодія [DONE — 2026-11-08]

- **Окремий drag для схованки, а не розширення `use-inventory-drag`** (відхилення від розд. 4–5 специфікації): так перетягування в Inventory гарантовано не змінилось. Модулі в `composables/`: `stash-drag-state.ts` (реактивний стан, ефекти, `locationKey`), `use-stash-drag.ts` (контролер), `stash-drop-target.ts` (чиста функція `resolveDropTarget`: клітинка або панель під вказівником), `stash-drop-label.ts` (підпис дії на привиді), `stash-messages.ts` (тексти помилок і підписів, ключі літеральні для тесту локалей), `use-stash-toast.ts`, `use-stash-zone-class.ts`. Сервіс `stash-transfer.ts` отримав `previewMove` / `previewAutoPlace`.
- **Drag:** починається після зсуву понад 5 px (Pointer Events, мишею й дотиком); Shift при натисканні вмикає розділення; план (`plan*`) рахується лише при зміні цілі (кеш за ключем); привид 64 px зі значком дії (`Move`, `Swap`, `Stack +n`, `Split n`, `Equip`, `To bag`, `To stash`, червоний `Can't drop`); авто-скролла біля краю скрол-боксу (40 px, до 14 px за кадр, `requestAnimationFrame`) з перерахунком цілі; Esc, `pointercancel` і закриття схованки скасовують drag без змін.
- **Стани клітинок:** `is-lifted`, `is-fit` (слот спорядження, куди предмет підходить), `is-next` (куди ляже авторозміщення), `is-valid`, `is-invalid`, `is-landed`, `is-shake`; панель світиться зеленим або червоним (`zone-ok`, `zone-bad`), коли вказівник між клітинками. Нова клітинка-ціль позначена атрибутами `data-drop-container`, `data-drop-index` / `data-drop-slot`.
- **Швидке переміщення:** подвійний клік, права кнопка, Enter на предметі (Shift розділяє): bag → stash, stash → bag, спорядження → stash; зелений тост «Stored in the stash» / «Taken to the bag».
- **Відмови:** тост із причиною (`stash.error.*`, 9 кодів), `is-shake` на клітинці, а для `OVERWEIGHT` ще й двічі блимає шкала ваги.
- **Інше:** підказка внизу змінюється (`stash.hint.idle|drag|split`), Esc під час drag лише скасовує drag, а не закриває схованку; тултіп вимкнений під час drag.
- **Не входить у S4:** фільтри, Store resources, Sort, «N more below» (S5), e2e (S6).
- **Відомо:** бюджет `Hex world map chunk` у `size-limit` (100 KB) перевищено ще до схованки (134 KB на чистій базі), схованка додає близько 3.6 KB; бюджет не змінював.

### Зміна дизайну після S4 (2026-11-08, Олег) [DONE]

Замінює розд. 2.2, 5.1 і частину 6 специфікації:

- **Клітинки як в Inventory.** Сітки сумки й схованки мають 7 колонок і той самий розмір клітинки, що й Inventory: база 76 px (64 при ширині вікна до 1100, 56 до 900), а екранний розмір рахується тим самим вписуванням `min(ширина, висота)`, що в `useFitToWidth` (`composables/use-inventory-cell-size.ts`, значення передаються змінними `--stash-cell`, `--stash-gap`, `--stash-pad`). Висоту вкладок (46 px) і підказки (22 px) Inventory береться константами, тож збіг із Inventory точний до пікселя-двох. Дошка без власної рамки й відступів, горизонтальний відступ панелей дорівнює відступу сітки Inventory, щоб 7 колонок займали ту саму ширину.
- **Схованка це до 5 скринь по 42 клітинки (6 рядків × 7 колонок), без скролу.** Вкладки «Chest 1…5». Усього 210 клітинок. `STASH_COLUMNS = 7`, `STASH_ROWS = 6`, `STASH_CHEST_CELLS = 42`, `STASH_MAX_CHESTS = 5`.
- **Купівля скринь (engine `planBuyStashChest`, ціни в `STASH_CHEST_PRICES`).** Спершу порожньо: перша скриня за 100 монет, кожна наступна за 1000, лише по порядку. Платять монети з сумки (монети у схованці й руках не рахуються). Кнопка «Buy for N coins» вимагає другого кліку для підтвердження (3 с). Невідкриті вкладки видно із замком, вкладка далі за наступну показує «Buy Chest N first».
- **Авторозміщення спершу в видиму скриню** (`stashPreferred` у `ITransferOptions`), далі в інші; Sort і Store resources (S5) діятимуть на всі куплені. Без жодної скрині: `NO_CHEST` («Buy a chest first.»).
- **Прибрано:** розділювач 25–75 % (і `stashSplitRatio`), рядок EQUIPPED (спорядження лишається в Inventory; engine усе ще вміє переміщення в слоти), підсвітка `is-fit`.
- **Сховище v2:** ключ `hexoflat.hero.stash.v2`, `{ chests, cells }`; старий v1 з розробки ігнорується (не було релізу). Предмети в некуплених скринях при читанні відкидаються.
- **Тест-хуки:** `getStash`/`setStash` працюють з куплених клітинок, додано `getStashChests`/`setStashChests`.
- **Порядок блоків (2026-11-08):** зверху STASH (вкладки скринь і сітка 6×7), під ним BAG (решта висоти, скрол).
- **Повідомлення героя (2026-11-08):** усі застереження схованки (9+3 коди помилок, не вистачає монет) йдуть через наявний `heroToolStore.setActionMessage` і смугу `action-alert-banner` над картою, як в усій грі. Власного тосту нема (`stash-toast.vue`, `use-stash-toast.ts` і ключі `stash.toast.*` видалено). Повідомлень про успіх (покладено, взято, куплено) теж нема: результат видно на дошці, як в Inventory.

### Оплата скринь монетами з руки (2026-11-08, Олег) [DONE]

Замінює «купівлю кнопкою з сумки»:

- **Кнопки купівлі нема.** Вкладка нерозблокованої скрині показує скриню і блок «ціна + спрайт монети» (100 для першої, 1000 для кожної наступної, лише по порядку). Наведення на блок показує повідомлення героя (банер `action-alert-banner`, тон `info`): покласти монети в руку й піднести до скрині.
- **Оплата дією «Unlock» (Відімкнути).** Монети в слоті руки стали інструментом (`coins` у `THeroToolKey`, `toolKeyOfItem`, `equip-token` дозволяє USE). Коли такий інструмент над гексом `stash-chest` і є незаплачена скриня, у гексі інструмента з'являється «Unlock» (пріоритет 95, як в OPEN, тому автоперемикання не перебиває ваш вибір між Hand і монетами). Клік: `unlockNextChest` (engine `planUnlockStashChest`) списує рівно ціну зі стеку в руці, решта лишається в руці (порожній слот дає порожню руку), скриня відкривається, вкладка перемикається на неї. Монети в сумці й схованці не рахуються. Дошка при цьому може бути закрита.
- **Повідомлення:** `Not enough coins to pay` з ціною й спрайтом монети (тон `warn`), `You unlock the stash chest` (тон `success`, без червоного «!»). Для цього `setActionMessage` отримав іконку `coins` і необов'язковий тон (`warn`, `info`, `success`).
- **Видалено:** engine `planBuyStashChest`, `coinsInBag`, кнопка з другим кліком, ключі `stash.buy.button|confirm|confirmShort`, `stash.error.NOT_ENOUGH_COINS|MAX_CHESTS`.
- **Відомі обмеження:** екіпірувати монети можна лише цілим стеком (в Inventory немає розділення на довільну кількість); щоб накопичити ціну, стеки зливають перетягуванням. Якщо в обох руках монети, береться більший стек.
- **Лічильник-чіп (2026-11-08):** усі стековані предмети мають чіп із кількістю, як у Волі, навіть при кількості 1: у сітці Inventory (раніше лише при понад 1), у слотах руки (`equip-token`, внизу посередині, протиповернуто до нахилу токена) і в клітинках схованки. Правило в одному місці: `composables/item-counter.ts` (`showsCounter`, стековане за контентом).

### S5 — дії схованки [DONE — 2026-11-08]

- **Фільтри** `All / Gear / Tools / Resources / Consumables` під вкладками скринь (лише коли видима скриня куплена): фільтр тільки притемнює (`is-dim`, вміст до 18 %), позиції не змінюються, порожні клітинки лишаються ціллю. Логіка в `composables/stash-filter.ts` (`isDimmed`, категорії з engine `categoryOf`), стан у `hero-stash-store.filter` (не зберігається).
- **Дві іконкові кнопки в шапці STASH:** «Store resources» (`stash-store-resources`) кладе ресурси й витратне з сумки у схованку, спершу у видиму скриню, далі в інші (`stashPreferred` у `planStoreResources`); «Sort» (`stash-sort`) зливає стеки й сортує по всіх куплених скринях. Без скрині обидві кажуть «Buy a chest first.», порожній Store каже «No resources or consumables in the bag.» (тон `info`). Усі повідомлення через банер героя.
- **«N more below»** у BAG (`stash-more-bag`): кількість предметів, що лежать нижче видимої області, клік прокручує на 80 % висоти, під час перетягування ховається. Скрол-бокс отримав пропси `moreSelector` / `moreTestid`; без розкладки (нульова висота) нічого не рахує.
- Нові ключі: `stash.filter.*`, `stash.action.store|sort`, `stash.moreBelow`, `stash.nothingToStore`. Нова іконка `sort`.
- **Лишилось (S6):** e2e-специфікації за розд. 8 і решта testid; перевірка в e2e, що в BAG `scrollWidth` не більший за `clientWidth`.

### Анімація відкриття і кнопка закриття (2026-11-08)

- Поки дошка схованки відкрита, плитка інструмента руки стоїть на гексі скрині й «працює» (клас `doing`, та сама анімація, що на Книзі Волі), без кнопки дії й без таймера; після закриття інструмент зупиняється. Логіка в `composables/use-stash-opening.ts` за зразком `use-book-reading.ts`, підключена в `tool-hex-tile.vue`.
- Кнопка закриття має ті самі розмір і положення, що в Книги Волі: 50×50 px, `top: 10px; right: 10px`, шрифт 1.7rem. Шапку дошки підняв до 54 px, щоб кнопка не заходила на орнамент.
- **Кнопка закриття (уточнення):** точна копія кнопки Книги Волі, включно зі скошеними кутами, сталевою рамкою, гранню з градієнтом, ховером і фокусом. Спільний компонент `components/gui/board/board-close-button.vue` (проп `testid`, `label`, подія `close`). Книга Волі теж використовує цей компонент (її власний дубль стилів кнопки закриття видалено), тож дві дошки мають одну кнопку з одного джерела; `data-testid="knowledge-close"` не змінився.

### S6 — e2e та решта testid [DONE — 2026-11-08]

Специфікації написані, але **не запускались** (їх запускає Олег на pre-push).

- **Шари:** компонент `src/components/stash-board.component.ts` (єдине місце з локаторами; стан читає через хуки `getStash/getBag/getStashChests`, перетягування через справжні події миші, Shift для розділення), Feature `stash-board.feature.ts` і `unlock-stash-chest.feature.ts`, спек `e2e/hero/stash.spec.ts` (@hero, 15 тестів).
- **Сценарії:** відкриття OPEN рукою (п'ять заблокованих вкладок, перша скриня за 100, кнопки купівлі нема); підказка на блоці ціни через банер героя; закриття зупиняє працюючий інструмент; перетягування в клітинку; злиття стеків із залишком; Shift-розділення 7 на 3 і 4; відмова при перевантаженні без змін; кидок на панель у першу вільну клітинку видимої скрині; подвійний клік і права кнопка; чіп-лічильник для однієї монети; Store resources; Sort; фільтр; збереження після перезавантаження; оплата 140 монетами з руки (платить 100, лишається 40); 90 монет дають попередження з ціною; друга скриня за 1000.
- **Старий `e2e/hero/open-chest.spec.ts` видалено:** він перевіряв заглушку «chest is broken», якої більше нема; його сценарій покриває перший тест нового спека.
- **Impact map:** файли схованки додані до коренів групи `hero` (`impact-map.ts`); `pnpm run e2e:map:check` проходить.
- **Не робилось:** `stash-more-chest` (скриня не гортається), e2e-перевірка, що в BAG `scrollWidth` не більший за `clientWidth`.
- **Локалізація:** усі ключі `stash.*` є в `en` і `uk`, тести локалей зелені.
