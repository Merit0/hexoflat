# Аудит дошки квестів (Phase A) — hexoflat / Path of Will

> Дата: 2026-11-14. Гілка: `quest-board-implementation`. Режим: лише читання, змінено один файл — цей.
> Кожна знахідка має `шлях:рядок`. «not found» = шукав і не знайшов.

## 0. Відхилення від вхідних даних

| Що просили                                        | Що є насправді                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Скіли `hexoflat-feature-audit`, `hexoflat-quests` | **not found** (немає в `.claude/skills/`, `Skill` каже «Unknown skill»). Завантажено лише `hexoflat-engine`, `hexoflat-web-state`, `hexoflat-e2e`. Правила квестів узято з розділів «Quest …» цих скілів і з `CLAUDE.md`.                                           |
| `docs/features/treasure-seeker-plan.md`           | `docs/quest-board/more-detailed-treasure-seeker-plan.md` (v3: Частина А = рядки 67–236, Частина Б = 238–712; §4 = 278–381, §7 = 471–505, §8 = 507–546). Є також v1 `docs/quest-board/TREASURE-SEEKER-PLAN.md` (замінений v3, його `REQ-TQS-*` не використовуються). |
| `docs/ui/quest-board-spec.md`                     | `docs/design/quest-board-spec.md` (v1) **і** `docs/design/updates-for-quest-board-spec.md` (v2, «темне золото») — вони суперечать одне одному (див. питання Q1).                                                                                                    |
| `docs/features/loot-plan.md`                      | `docs/loot-plan.md` (§1.1 = рядки 23–39).                                                                                                                                                                                                                           |
| «Practice group»                                  | **not found** у жодному документі й коді (`grep -i practice` — лише побічні збіги в `CLAUDE.md`). Питання Q2.                                                                                                                                                       |

## 1. Інвентар файлів квестів

### 1.1 Engine — `packages/engine/src/`

| Файл                                                       | Рядків        | Що                                                                                                                                                           |
| ---------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `quests/quest-definition.ts`                               | 111           | Zod `QuestDefinition`, `Cost`(free/will/item), `Requirement`(questDone), `Reward`(item/will), `Objective`(count/expedition), `QUEST_SLOTS`, `QUEST_REFUSALS` |
| `quests/objectives.ts`                                     | 81            | реєстр `OBJECTIVES` (`count`, заглушка `expedition`), `handlerFor`, `describeQuest`                                                                          |
| `quests/quest-log-state.ts`                                | 22            | Zod `QuestLog { active[], done{} }`                                                                                                                          |
| `quests/quest-log.ts`                                      | 210           | чисті `planAccept/planAbandon/planClaim/applyQuestEvents`, `slotSurcharge`, `questBoardState`                                                                |
| `quests/quest-hook.ts`                                     | 13            | `foldQuestEvents` — підписка на події команд                                                                                                                 |
| `quests/quest-commands.ts`                                 | 27            | Zod `QUEST_ACCEPT/ABANDON/CLAIM`                                                                                                                             |
| `quests/quests.content.ts`                                 | 135           | `BOARD_QUESTS` (woodcutter, stonebreaker, scholar, bone-hunter), `QUESTS`, `questContentFailures` (R-Q-12)                                                   |
| `quests/all-quests.ts`                                     | 4             | `ALL_QUESTS` = дошка + «Шукач»                                                                                                                               |
| `quests/quest-fixture.ts`                                  | 28            | dev-фікстура `setQuests`                                                                                                                                     |
| `quests/seeker-content.ts`                                 | 192           | `TreasureSeekerParams`, `SEEKER_CARDS` I–III, `seekerCardFailures`                                                                                           |
| `quests/seeker-quests.ts`                                  | 23            | картки як `QuestDefinition`                                                                                                                                  |
| `quests/quest-state.ts`                                    | 95            | Zod `QuestRun` (прихований стан ходу), `positionOf`                                                                                                          |
| `quests/trail.ts`, `numbers.ts`, `treasure-field.ts`       | 126/175/33    | слід, числа кільця, поле радіуса 6                                                                                                                           |
| `quests/seeker-actions.ts`                                 | 339           | `enterQuest/seekerStep/StepBack/GiveUp/Return`                                                                                                               |
| `quests/seeker-chest.ts`, `seeker-result.ts`               | 208/47        | OPEN скрині, здобич, `QUEST_PICKUP`, `SEEKER_REFUSALS`                                                                                                       |
| `quests/seeker-commands.ts`                                | 163           | `QUEST_RUN_COMMAND_SCHEMAS`, `executeQuestRunCommand`, `QuestRunDoc`                                                                                         |
| `quests/projection.ts`                                     | 58            | `projectQuestForClient`                                                                                                                                      |
| `quests/sequences/{rules,alternatives,decoys,generate}.ts` | 162/154/86/78 | реєстр правил, каталог альтернатив, пастки, генератор                                                                                                        |
| `aggregates/{apply-quest-command,server-quest-context}.ts` | 61/8          | гравецькі команди дошки, `atBoard`                                                                                                                           |
| `aggregates/progress-state.ts:5,45,64`                     | —             | `progress.quests` (v8)                                                                                                                                       |
| тести                                                      | ~2 000        | `quests/*.test.ts`, `sequences/*.test.ts`, `aggregates/quest-commands.test.ts`                                                                               |

### 1.2 Контент і i18n

| Файл                                                                                                                                              | Що                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `content/constructions.content.ts:285`, `registry/hexobjects-registry.ts:35`, `content/boards/static/camping.ts:9`, `world/camp-facilities.ts:11` | об'єкт `quest-board` у кемпі                                        |
| `content/loot-tables.content.ts`                                                                                                                  | `seeker-1                                                           | 2   | 3-chest-loot` (таблиці скринь) |
| `apps/web/src/locales/{en,uk}/ui.json` `quest.*`                                                                                                  | усі тексти квестів; `content.json` — назва об'єкта дошки            |
| `apps/web/src/i18n/locale-keys.ts:116-130,182`                                                                                                    | `questLocaleKeys()` — реєстрація динамічних ключів для orphan-тесту |

### 1.3 API — `apps/api/src/`

| Файл                                               | Що                                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `quests/quest-run.service.ts` (234)                | виконання `QUEST_ENTER/STEP/…` в одній транзакції, журнал, реєстр предметів                                            |
| `player/player-command.service.ts:164-170,204-289` | `QUEST_ACCEPT/ABANDON/CLAIM` через загальний шлях гравецьких команд; dev `quest-fixture`                               |
| `player/player.gateway.ts:149-170`                 | сокет `quest:command` → `quest:result`                                                                                 |
| `player/player.controller.ts`                      | `GET /player/quest` (відновлення)                                                                                      |
| `world/world.service.ts:21,99,253,399,418`         | `foldWorldQuests`, відмова `QUEST_OPEN`                                                                                |
| `expedition/expedition-store.ts:55,66,178`         | `srv-quest` — серверний документ, браузеру не віддається                                                               |
| тести                                              | `player/quest.integration.spec.ts`, `quests/quest-run.integration.spec.ts`, шматок у `world/world.integration.spec.ts` |

### 1.4 Web — `apps/web/src/`

| Файл                                                                                                                                                                                                                                          | Що                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stores/quest-store.ts` (15)                                                                                                                                                                                                                  | читає проєкції; без правил                                                                                                                                                                                                      |
| `services/quests/quest-projection.ts`, `quest-run-projection.ts`                                                                                                                                                                              | `shallowRef` проєкцій                                                                                                                                                                                                           |
| `services/quests/quest-commands.ts`, `quest-run-commands.ts`, `quest-run-transport.ts`                                                                                                                                                        | відправка команд (`crypto.randomUUID()` — `quest-run-transport.ts:25`)                                                                                                                                                          |
| `services/quests/quest-board-model.ts` (74)                                                                                                                                                                                                   | **категорія, спрайт, ліміт 5, причина — правила у web**                                                                                                                                                                         |
| `services/quests/quest-field-model.ts` (102), `quest-hex-tip.ts`, `quest-result.ts`                                                                                                                                                           | модель поля, підказки, картка результату                                                                                                                                                                                        |
| `composables/use-quest-view.ts` (108), `use-quest-board-view.ts` (92), `use-quest-row-actions.ts`, `use-quest-actions.ts`, `use-quest-details.ts`, `use-quest-run-view.ts`, `use-quest-run-actions.ts`, `quest-messages.ts`, `seeker-flag.ts` | view-моделі та дії                                                                                                                                                                                                              |
| `a-game-scenes/map-scene/components/quests/`                                                                                                                                                                                                  | `quest-board.vue` (342), `quest-row.vue` (338), `quest-details-popover.vue` (352), `quest-filter-chips.vue`, `quest-action-button.vue`, `quest-run-panel.vue`, `quest-reward-icon.vue`, `quest-reward-text.ts`, `quest-tip.vue` |
| `components/quest/quest-field-area.vue`, `quest-hex-tip.vue`; `render/quest/use-quest-board.ts`, `render/layers/quest-numbers-layer.ts`                                                                                                       | поле «Шукача» (Pixi)                                                                                                                                                                                                            |
| `a-game-scenes/map-scene/components/tool-hex-tile.vue:394`, `use-knowledge-panel.ts:4`, `use-book-reading.ts:16`, `hero-board-panel.vue:26`                                                                                                   | відкриття дошки з гекса (як Книга Волі)                                                                                                                                                                                         |
| `e2e/quest-hooks.ts`, `create-test-api.ts`                                                                                                                                                                                                    | хуки `getQuests/setQuests/getQuestField/…`                                                                                                                                                                                      |
| тести                                                                                                                                                                                                                                         | `quests/quest-board.test.ts`, `quest-board-seeker.test.ts`, `services/quests/*.test.ts`                                                                                                                                         |

### 1.5 E2E — `apps/playwright/`

`e2e/hero/quests.spec.ts` (4 тести), `e2e/hero/quest-seeker.spec.ts` (10), `src/features/world/quest-board.feature.ts`, `quest-run.feature.ts`, `src/components/quest-board.component.ts`, `quest-field.component.ts`, `src/pages/camping-map.page.ts`.

## 2. Таблиця розривів

Статуси: **present** · **partial** · **missing** · **different**. «Ризик» — Н/С/В.

### 2.1 REQ-QB-* (Частина А)

| REQ                                                    | Статус        | Де                                                                                                                                                                                                                     | Ризик |
| ------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| QB-001 ACCEPT списує + кожна відмова має код           | present       | `quest-log.ts:74-122`, тест `quest-log.test.ts:40,52,80`                                                                                                                                                               | Н     |
| QB-002 слоти 1/+5/+10, 4-й відмова                     | present       | `quest-log.ts:63-72`, `quest-definition.ts:92`, тест `:95,111`                                                                                                                                                         | Н     |
| QB-003 `count` + `where`                               | present       | `objectives.ts:28-33`, тест `quest-log.test.ts:122-140`, `quest-events.test.ts:16`                                                                                                                                     | Н     |
| QB-004 кап і один `QUEST_READY`                        | present       | `quest-log.ts:181-205`, тест `:150,165`                                                                                                                                                                                | Н     |
| QB-005 CLAIM через grant, `BAG_FULL`                   | present       | `quest-log.ts:139-190`, тест `:184-207`                                                                                                                                                                                | Н     |
| QB-006 once/repeatable                                 | present       | `quest-log.ts:57-61`, тест `:224`                                                                                                                                                                                      | Н     |
| QB-007 ABANDON                                         | present       | `quest-log.ts:124-137`, тест `:245`                                                                                                                                                                                    | Н     |
| QB-008 `questDone`                                     | present       | `quest-log.ts:53-55`, тест `:257`                                                                                                                                                                                      | Н     |
| QB-009 новий `count` лише даними                       | present       | `objectives.test.ts:8`                                                                                                                                                                                                 | Н     |
| QB-010 новий вид цілі = один запис реєстру             | **different** | тест `objectives.test.ts:50-53` обходить схему через `as unknown as QuestDefinition`; реальний квест нового виду не пройде Zod: `quest-definition.ts:74-78` (закритий `discriminatedUnion`). Контракт брехливий (П-D1) | **В** |
| QB-011 `QuestLog` переживає reload, повтор `commandId` | present       | `player/quest.integration.spec.ts:48,58`; у назві тесту **немає id** (CLAUDE.md стверджує протилежне)                                                                                                                  | Н     |
| QB-012 інваріант економіки                             | partial       | `quests.content.ts:107-135` лише в тесті `quests.content.test.ts:14`, за замовчуванням тільки `BOARD_QUESTS`; у `validateContent` не викликається (not found)                                                          | С     |
| QB-013 `tableRule`, назва й опис обома мовами          | partial       | engine: лише конвенція ключів `quests.content.test.ts:50`; присутність у uk/en — web-тест `ui-locale-completeness.test.ts`; `quest.unit.steps` відсутній в обох локалях (`objectives.ts:57`)                           | С     |

### 2.2 REQ-QST-* (Частина Б)

| REQ                                         | Статус                                            | Де                                                                                                                                                                            | Ризик |
| ------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| QST-001 види правил, перші 8 членів         | present                                           | `sequences/rules.test.ts:16`                                                                                                                                                  | Н     |
| QST-002 цілі додатні ≤ 3 цифр, 1000 сідів   | present                                           | `sequences/generate.test.ts:18`                                                                                                                                               | Н     |
| QST-003 однозначність                       | present                                           | `generate.test.ts:32,45,51`                                                                                                                                                   | Н     |
| QST-004 пастки                              | present                                           | `decoys.test.ts:31,69`                                                                                                                                                        | Н     |
| QST-005 `continueFrom`                      | present                                           | `rules.test.ts:31,42,48`                                                                                                                                                      | Н     |
| QST-006 слід і скриня на реальних дошках    | present                                           | `trail.test.ts:8` (синтетична), `seeker-commands.test.ts:18` (реальне поле, 300 сідів)                                                                                        | Н     |
| QST-007 одне «правильне» на кільці          | present                                           | `seeker-actions.test.ts:34`                                                                                                                                                   | Н     |
| QST-008 START платить лише вхід, суми немає | present                                           | `seeker-actions.test.ts:75`; UI: `quest-board-seeker.test.ts:49`, e2e `quest-seeker.spec.ts:24`                                                                               | Н     |
| QST-009 ємність Волі                        | present                                           | `seeker-content.test.ts:11,22`                                                                                                                                                | Н     |
| QST-010 крок / крок назад                   | present                                           | `seeker-actions.test.ts:117`                                                                                                                                                  | Н     |
| QST-011 підказка                            | present                                           | `projection.ts:30`, тест `:156`                                                                                                                                               | Н     |
| QST-012 крок на відхилення не відрізняється | present                                           | `seeker-actions.test.ts:187`                                                                                                                                                  | Н     |
| QST-013 крок назад, туман                   | present                                           | `seeker-actions.ts:261-323`, тест `:204`                                                                                                                                      | Н     |
| QST-014 фальшива скриня, `AMBUSH_SPRUNG`    | **partial**                                       | `seeker-actions.ts:185-192`, `seeker-chest.ts:127-141`; бою немає — з `ambush` виходить лише `QUEST_GIVE_UP` (`seeker-actions.ts:325-332`). Тест `seeker-actions.test.ts:243` | В     |
| QST-015 застряг                             | present                                           | `seeker-actions.ts:160` `strandedCheck`, тест `:306`                                                                                                                          | Н     |
| QST-016 GIVE UP                             | present                                           | `seeker-actions.ts:325`, тест `:328`                                                                                                                                          | Н     |
| QST-017 проєкція без секретів               | present (з застереженнями П-H1)                   | `projection.ts:28-56`, тест `seeker-secrets.test.ts:10`                                                                                                                       | С     |
| QST-018 `commandId`, чужий герой            | present                                           | `quest-run.service.ts:109-145`, тест `quest-run.integration.spec.ts:104,220,258`                                                                                              | Н     |
| QST-019 відновлення                         | present                                           | `GET /player/quest`, тест `:131,274`                                                                                                                                          | Н     |
| QST-020 тестове правило без змін коду       | present для **правил**, **missing** для **цілей** | `seeker-secrets.test.ts:48`, `rules.test.ts:52`; для objective див. QB-010                                                                                                    | С     |
| QST-021 `tableRule`                         | present                                           | `seeker-content.test.ts:28`                                                                                                                                                   | Н     |
| QST-022 цінність скрині > могил засідки     | partial                                           | скринева половина `seeker-chest-loot.test.ts:326`; половини засідки немає                                                                                                     | С     |
| QST-023 справжня скриня, віха               | present                                           | `quest-run.integration.spec.ts:195`, `seeker-chest-loot.test.ts:53`                                                                                                           | Н     |
| QST-024 засідка, бот 500 сідів              | **missing**                                       | `ambushTable` — not found; `questsEnabled` — not found                                                                                                                        | В     |
| QST-025 реплей                              | present                                           | `seeker-secrets.test.ts:83`                                                                                                                                                   | Н     |
| QST-026…033 (QC1)                           | present                                           | `seeker-chest-loot.test.ts:125,180,195,237,275,290,315,357`                                                                                                                   | Н     |
| QST-034 два одночасні OPEN → один успіх     | present, **id у тесті інший**                     | `quest-run.integration.spec.ts:220` названо `REQ-QST-018`                                                                                                                     | Н     |

### 2.3 REQ-QBU-* (UI-специфікація; дивись Q1 про версію специфікації)

| REQ                                                      | Статус                    | Де                                                                                                                                                                                  | Ризик |
| -------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| QBU-001 рядок однакової висоти                           | **different** + без тесту | код 64px (`quest-row.vue:201`), v1 каже 60, v2 — 64, `CLAUDE.md` — 60                                                                                                               | Н     |
| QBU-002 кнопка лише з ціною, 2 валюти                    | partial                   | лише Воля; монет у `Cost` немає (`quest-definition.ts:5-15`); тест «price only» `quest-board.test.ts:131`                                                                           | С     |
| QBU-003 `refusal` → disabled + title + плашка            | partial                   | причина виводиться у web (`quest-board-model.ts:57`), а не з проєкції; тексти для `INSUFFICIENT_COINS` немає                                                                        | С     |
| QBU-004 hover/focus/pin/Esc                              | present                   | `quest-details-popover.vue`, `use-quest-details.ts`, тест `quest-board.test.ts:138` (без id)                                                                                        | Н     |
| QBU-005 вирівнювання поп-апа за індексом                 | **different** (свідомо)   | клемп у в'юпорт замість правила «верх/низ за індексом» (CLAUDE.md, «Quest board redesign»)                                                                                          | Н     |
| QBU-006 фільтри й лічильники                             | present                   | `quest-filter-chips.vue`, `use-quest-board-view.ts:43-47`, тест `quest-board.test.ts:122`                                                                                           | Н     |
| QBU-007 порожній My quests / Locked не рендериться       | partial                   | порожній — `quest-board.test.ts:117`; група LOCKED **не існує взагалі**: `use-quest-board-view.ts:47` відфільтровує `locked`, у `quest-board.vue:68,83` лише `active` і `available` | С     |
| QBU-008 розписка ціни                                    | partial                   | `quest-details-popover.vue:64` (`-cost`), без тесту з монетами/«Free»                                                                                                               | С     |
| QBU-009 футер                                            | partial                   | `quest-board.vue:99` (`role="status"`), тесту на текст останньої події — not found                                                                                                  | Н     |
| QBU-010 i18n без сирих ключів                            | partial                   | `quest-board.test.ts:154` + `locale-orphaned-keys.test.ts`; прогалина `quest.unit.steps` (П-I1)                                                                                     | С     |
| QBU-020 `selectQuestBoard`                               | **missing**               | `selectQuestBoard`, `QuestBoardView`, `takeCost` — not found (grep по `packages`, `apps`)                                                                                           | В     |
| QBU-021 `QUEST_ACCEPT` Воля+монети, `INSUFFICIENT_COINS` | **missing**               | `INSUFFICIENT_COINS` — not found; монети в `accept` лише як `item coins` → відмова `INSUFFICIENT_ITEMS` (`quest-log.ts:97`)                                                         | В     |
| QBU-030 e2e взяти Woodcutter                             | partial                   | `quests.spec.ts:19` (повний цикл)                                                                                                                                                   | Н     |
| QBU-031 e2e 10 дерев → Claim                             | partial                   | тест ставить прогрес фікстурою `setQuests` (справжня рубка — лише API-тест `world.integration.spec.ts`), `quests.spec.ts:19`                                                        | Н     |
| QBU-032 e2e три квести → інші disabled з причиною слотів | partial                   | `quests.spec.ts:39` (доплата й відмова 4-го)                                                                                                                                        | Н     |
| QBU-033 e2e телефон: акордеон                            | **missing**               | у `components/quests/` немає media/breakpoint/шторки (not found)                                                                                                                    | С     |

Додатково з Частини А/спеки без REQ: `QuestDefinition.category/icon` (spec v1 §6, v2 §3) — missing (`quest-definition.ts:94-108`); `requires` показ замкнених карток з причиною (R-Q-1) — missing, див. QBU-007.

## 3. Проблеми

### П-R. Правила поза engine — **знайдено**

| #   | Де                                                         | Що                                                                                                                                                                                         |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `use-quest-view.ts:59-61`                                  | ціна взяття = `accept.amount + slotSurcharge(...)`, повторює `quest-log.ts:89`. Без `freeSlots`, тож точка розширення «навичка робить слот безплатним» (`quest-log.ts:63`) у UI не спрацює |
| R2  | `use-quest-view.ts:76`, `use-quest-board-view.ts:43-44,57` | `willShort`, `slotsFull`, `entry`, `reason` обчислюються у web                                                                                                                             |
| R3  | `quest-board-model.ts:9-15`                                | `categoryOf` виводиться з назви події (`BATTLE_CLOSED`→combat). Поле `category` у контенті відсутнє                                                                                        |
| R4  | `quest-board-model.ts:17-22,67`                            | `SPRITE_KEY_BY_ID` і `QUEST_BOARD_LIMIT = 5` — контент і правило «що показувати» у web                                                                                                     |
| R5  | `use-quest-view.ts:47`                                     | каталог квестів береться з engine-контенту прямо в клієнті, а не з серверної проєкції; `locked/finished` рахує `questBoardState(store.log, …)` у web                                       |
| R6  | `quest-field-model.ts:46-49,66-67,94-101`                  | які гекси досяжні, що є «назад», що блокує скриня — копія правил `seeker-actions.ts` (`seekerStep`, `seekerStepBack`)                                                                      |
| R7  | `seeker-flag.ts:2`                                         | прапор `VITE_SEEKER_QUESTS` лише у web; сервер приймає `QUEST_ENTER` завжди, `questsEnabled` у контенті — not found (v3 §10 вимагає прапор контенту)                                       |

### П-D. Дублі правил і типів — **знайдено**

| #   | Де                                                                                                                                                                                                                                  | Що                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `quest-definition.ts:74-78` ↔ `objectives.ts:62-65` ↔ `quest-board-model.ts:9-15`                                                                                                                                                   | вид цілі описано у трьох місцях; додати вид = змінити схему, реєстр і `categoryOf`                                                                    |
| D2  | `quest-log.ts:53-55`                                                                                                                                                                                                                | `unmetRequirements` читає `requirement.questId` без розгалуження за `kind`; новий вид `Requirement` мовчки трактуватиметься як `questDone`            |
| D3  | `quests.content.ts:94` `QUESTS` ↔ `all-quests.ts:4` `ALL_QUESTS`                                                                                                                                                                    | `QUESTS` використовує лише `quest-fixture.ts:18`, тому `setQuests` не вміє виставляти «Шукача»                                                        |
| D4  | `quest-definition.ts:35-48` `QUEST_REFUSALS` ↔ `seeker-result.ts` `SEEKER_REFUSALS` (`seeker-result.ts:6`) ↔ рядки `'WRONG_HERO'`, `'INVENTORY_STALE'` без типу (`apply-quest-command.ts:44-45`) ↔ мапа текстів `quest-messages.ts` | три переліки відмов, спільного `Refusal` (DM1) немає                                                                                                  |
| D5  | `seeker-commands.ts:148-161`                                                                                                                                                                                                        | ланцюжок тернарників «тип команди → функція»; `chestTableOf` (`:105-108`) і `createTreasureField` (`:121,145`) жорстко прив'язані до `treasureSeeker` |
| D6  | `quest-run.service.ts:109-145` ↔ `player-command.service.ts` (журнал/replay)                                                                                                                                                        | два окремі шляхи виконання з однаковою логікою журналу                                                                                                |

### П-I. Ідемпотентність за `commandId`

- **Сервер: не знайдено порушень.** Гравецькі `QUEST_*` — загальний журнал (`player-command.service.ts:164-170`, тест `quest.integration.spec.ts:58`); ходи «Шукача» — `quest-run.service.ts:109-145` у транзакції під `lockExpedition` (`:101`), тест двох одночасних OPEN `quest-run.integration.spec.ts:220`; квести через світові команди не рахуються двічі, бо `replayed` повертає журнал без повторного `foldQuestEvents` (`world.service.ts:188`).
- **Ризик 1 (низький):** повтор відповідає _поточним_ документом і агрегатами, а не збереженими на момент команди (`quest-run.service.ts:135-144`).
- **Ризик 2 (середній):** клієнт на кожну команду генерує новий id (`quest-run-transport.ts:25`) і не повторює її з тим самим id після обриву; запасний шлях — `GET /player/quest` (`:46`).

### П-H. Приховані дані «Шукача» в клієнтських проєкціях

**Прямих витоків не знайдено**: `projection.ts:28-56` віддає лише `offerId, phase, outcome, start, position, path, opened(лише відкриті), hintHex, chest{hex,empty}, collect, stepCost, backCost`; `seed`, `trail`, `rule`, `lines`, `firstDeviation`, `chest.kind`, числа закритих гексів туди не потрапляють; документ `srv-quest` недоступний браузеру (`expedition-store.ts:55,66,178`). Залишкові застереження (за дизайном, але варто знати):

1. `CHEST_APPEARED` для фальшивої скрині може прийти раніше кроку `L`, коли на хибному сліді немає вільного гекса (`seeker-actions.ts:253-254`, R-REV-4) — це непрямий сигнал про помилку.
2. `phase` стає `ambush` одразу після OPEN (`seeker-chest.ts:127-141`) — після OPEN це дозволено.
3. Події завершення несуть `recap.firstDeviation` і `QUEST_SUMMARY.deviationsTotal` (`seeker-actions.ts:142,149-157`) — лише після кінця (R-END-10).
4. Пули правил карток `params.rulePool` лежать у клієнтському бандлі (`use-quest-view.ts:47` імпортує `SEEKER_QUESTS`); це контент, не секрет.
5. Тест секретів працює на `projectQuestForClient`, а не на JSON відповіді API (`seeker-secrets.test.ts:10`); API-тест перевіряє приховання лише для здобичі (`quest-run.integration.spec.ts:195`). Прогалина тесту.

### П-L. Сирі та відсутні i18n-ключі

- Сирого `QUEST.SEEKER-1.NAME` у коді **not found**: цей рядок лише приклад у `docs/design/quest-board-spec.md:14`. Реальні ключі — `quest.seeker-N.name|desc|table` (`seeker-content.ts:50-99`), присутні в uk і en (перевірено скриптом по `ui.json`).
- **Знайдено:** `quest.unit.steps` відсутній в обох локалях, а `objectives.ts:57` повертає його з `describe` для expedition. Зараз web його не читає, тож на екрані не видно, але `questLocaleKeys()` реєструє `unitKey` лише для `count` (`locale-keys.ts:130`) і orphan-тест цього не зловить.
- Дубль `data-testid="quest-message"` у двох компонентах (`quest-board.vue:98`, `quest-run-panel.vue:80`) і умовний `quest-start-*` (`quest-row.vue:95,112`) — ризик неоднозначного локатора.

### П-T. Відсутні тести

| Чого немає                                                            | Де очікувалось      |
| --------------------------------------------------------------------- | ------------------- |
| тест на `INSUFFICIENT_COINS` / монети в `accept`                      | REQ-QBU-021         |
| тест `selectQuestBoard`                                               | REQ-QBU-020         |
| тест REQ-QST-024, половини засідки QST-014/022                        | немає `ambushTable` |
| API-тест, що JSON відповіді `quest:result` не містить секретів        | П-H5                |
| тест, що `validateContent` падає на поганій картці квесту             | П-QB-012            |
| тест вдруге-ходу проти stale replay                                   | П-I Ризик 1         |
| id `REQ-QB-011`, `REQ-QST-034`, `REQ-QBU-001…010` у назвах тестів     | відповідні файли    |
| тест фонової розкладки phone/tablet                                   | QBU-033             |
| спільний «guard» проти розгалуження за `objective.kind` поза реєстром | нова вимога (§4)    |

### П-X. Мертвий або майже мертвий код

| Де                                                               | Що                                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `quests.content.ts:94` `QUESTS`                                  | один споживач — `quest-fixture.ts:18` (див. D3)                                                                |
| `objectives.ts:53-60` `expeditionHandler`                        | `onEvent` завжди повертає `progress`, `isComplete` завжди `false`; його `describe` повертає ключ без перекладу |
| `seeker-quests.ts:23` `SEEKER_CATALOGUE`                         | лише тести (`seeker-test-setup.ts`)                                                                            |
| `use-quest-view.ts` `readyCount` + `quest-store.ts` `readyCount` | не відображається ніде після прибирання вкладки QUESTS (Q4); споживачів не знайдено                            |
| `questContentFailures`, `seekerCardFailures`                     | викликаються лише з тестів                                                                                     |
| `quest-run-transport.ts:46` `restoreQuestRun`                    | живий, але єдиний шлях відновлення, не помилка                                                                 |

## 4. Цільова архітектура

### 4.1 Engine

```
packages/engine/src/quests/
  definition/            quest-definition.ts (QuestDefinition без жорсткого union), cost.ts, requirement.ts, reward.ts, refusal.ts (єдиний перелік)
  log/                   quest-log-state.ts, quest-log.ts (plan*), quest-hook.ts
  objectives/
    types.ts             інтерфейс ObjectiveKind (нижче)
    registry.ts          OBJECTIVES = { count, expedition, reach, use }; buildObjectiveSchema(registry)
    count.ts reach.ts use.ts expedition-seeker.ts
  board/
    select-quest-board.ts  selectQuestBoard(progress, inventory, content, ctx): QuestBoardView
    board-view.ts          Zod/типи QuestBoardView, QuestRowView, CostView
  expeditions/
    registry.ts          EXPEDITIONS = { treasureSeeker: { enter, commands, project } }
    treasure-seeker/     (поточні seeker-*.ts, trail.ts, numbers.ts, sequences/, treasure-field.ts, projection.ts)
  content/               quests.content.ts, seeker-content.ts, validate-quests.ts (викликається з validateContent)
```

Інтерфейс цілі:

```ts
interface ObjectiveKind<S extends z.ZodTypeAny, P = number> {
  kind: string;
  schema: S; // Zod лише для поля objective цього виду
  init(objective: z.infer<S>): P; // початковий прогрес (зараз завжди 0)
  onEvent(objective: z.infer<S>, progress: P, event: DomainEvent): P;
  isComplete(objective: z.infer<S>, progress: P): boolean;
  describe(objective: z.infer<S>): { unitKey: string; target: number };
  category?: 'gather' | 'combat' | 'learn' | 'exp'; // значення за замовчуванням для QuestDefinition.category
  enter?(ctx: EnterCtx, objective: z.infer<S>): EnterOutcome; // лише експедиції
  commands?: Record<string, { schema: z.ZodTypeAny; run(ctx, payload): CommandOutcome }>;
}
```

`QuestDefinitionSchema.objective` будується з реєстру (`superRefine` за `registry[kind].schema`), тож додавання виду не чіпає `quest-definition.ts`, `quest-log.ts`, `categoryOf` (D1 зникає). `Requirement` отримує такий самий реєстр `REQUIREMENTS[kind].isMet` (D2). `seeker-commands.ts` переходить на `EXPEDITIONS[objective.expedition].commands[type]` (D5).

### 4.2 Потік

```
UI (hover/click) ─ intent ─▶ web service (commandId = uuid, повтор з тим самим id після обриву)
   ─▶ socket player:command | quest:command ─▶ API (журнал commandId, lockExpedition, revision)
   ─▶ engine: plan*/EXPEDITIONS.commands → { state, events }      ← єдине місце правил і цін
   ─▶ events → foldQuestEvents (лічильники) → progress.quests / srv-quest
   ◀─ відповідь: { events, aggregates.progress, questBoard: QuestBoardView, quest: QuestProjection|null }
   ─▶ web: проєкція (shallowRef) → use-quest-board-view (лише форма/фільтр/відкритість) → компоненти
```

Web більше не імпортує каталог квестів і не рахує ціну/причину/категорію/досяжність: усе приходить з `QuestBoardView` і з `QuestProjection.steps[]` (легальні ходи з цінами, рахує engine).

### 4.3 Web

`services/quests/` (проєкції, команди), `stores/quest-store.ts` (читає), `composables/use-quest-board-view.ts` (лише фільтр, групи, закріплення), компоненти `quests/` без змін структури + нові `quest-board-accordion.vue` (телефон). Прибрати: `quest-board-model.ts` (крім `matchesFilter`, `filterCounts`), `reasonOf`, `categoryOf`, `SPRITE_KEY_BY_ID` (→ `QuestDefinition.icon`).

## 5. План змін (одна фаза = один чат)

Спільне: гілка поточна, `git commit` не запускати, `CONTENT_VERSION` не підіймати без Олега, після фази — оновити `CLAUDE.md` і скіли (workflow rule).

| Фаза                                | Що                                                                                                                                                                                                                                                                                                                                                                | Файли                                                                                                                                         | Розмір                     | Тести                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **B1 — Контракт цілей**             | реєстр цілей будує схему; `init`; `REQUIREMENTS` за `kind`; прибрати cast з тесту; guard проти `objective.kind ===` поза `objectives/`                                                                                                                                                                                                                            | `quest-definition.ts`, `objectives.ts`→`objectives/*`, `quest-log.ts:53-55`, `quest-fixture.ts`, `objectives.test.ts`                         | M (~8 файлів, ~300 рядків) | **`objective-extension.test.ts` з `dummyCounter`** (нижче); REQ-QB-010 переписати без cast                                           |
| **B2 — Модель дошки в engine**      | `category`, `icon`; `Cost` з монетами + `INSUFFICIENT_COINS`; `selectQuestBoard`/`QuestBoardView` (`takeCost`, `costBreakdown`, `refusal`, locked-рядки з причиною); єдиний `Refusal`; `quest.unit.steps`                                                                                                                                                         | `quest-definition.ts`, `quest-log.ts`, нові `board/*`, `quests.content.ts`, ui.json uk/en, `locale-keys.ts`                                   | L (~12 файлів)             | REQ-QBU-020, 021; `quests.content.test.ts` + перевірка, що `questContentFailures(ALL_QUESTS)` порожній                               |
| **B3 — Сервер і контент-валідація** | `questBoard` у відповіді; `questsEnabled` у контенті й перевірка на сервері; `validateContent` викликає `questContentFailures`/`seekerCardFailures`; `EXPEDITIONS` реєстр замість тернарників; replay віддає збережений результат                                                                                                                                 | `seeker-commands.ts`, `expeditions/registry.ts`, `quest-run.service.ts`, `player-command.service.ts`, `validate-*.ts`                         | M                          | API: JSON-відповідь без секретів (П-H5), stale replay, `QUEST_ENTER` при вимкненому прапорі; id `REQ-QB-011`, `REQ-QST-034` у назвах |
| **B4 — Web на проєкції**            | видалити R1–R6; `QuestProjection.steps[]` замість `quest-field-model` правил; група LOCKED; кнопка з монетами; footer-тест                                                                                                                                                                                                                                        | `use-quest-view.ts` (видалити), `use-quest-board-view.ts`, `quest-board-model.ts`, `quest-field-model.ts`, `quest-board.vue`, `quest-row.vue` | L                          | REQ-QBU-001…010 з id; поле «Шукача» тести без правил у web                                                                           |
| **B5 — Practice + `reach` + `use`** | група Practice (визначення — питання Q2); види цілей через реєстр; нові події: `LOCATION_ENTERED` (з `world/travel.ts:145` `WORLD_TRAVELLED`, payload не перевірено) і `ITEM_USED_IN_WORLD` (бо `HEX_ACTION_STARTED` не має ключа предмета — `commands/apply-command.ts:313`; `ITEM_USED` існує лише в бою — `battle/items.ts:56`; `HERO_ARRIVED` — dev-фікстура) | `objectives/reach.ts`, `use.ts`, `apply-command.ts`, `world/travel.ts`, `quests.content.ts`, i18n                                             | M                          | `reach`/`use` повний цикл лише даними + подія; економічний інваріант для нових нагород                                               |
| **B6 — Планшет і телефон + e2e**    | шторка 85%, акордеон під рядком, довідка на дотик; REQ-QBU-030…033 через `QuestBoardFeature`                                                                                                                                                                                                                                                                      | `quest-board.vue`, нові `quest-board-sheet.vue`, `quest-board-accordion.vue`, e2e `quests.spec.ts`, `quest-board.component.ts`                | M                          | REQ-QBU-033 e2e на 390×844                                                                                                           |
| **B7 — Засідка (Q5 за планом)**     | `ambushTable`, бій, REQ-QST-014/022/024 — окрема фаза, залежності L3a виконані (CLAUDE.md, L3a/L3b done)                                                                                                                                                                                                                                                          | `seeker-chest.ts`, `world/battle-world.ts`, контент                                                                                           | L                          | бот-герой 500 сідів                                                                                                                  |

### Доказ контракту розширення — `dummyCounter` (фаза B1)

`packages/engine/src/quests/objective-extension.test.ts`, без редагування `quest-definition.ts`, `quest-log.ts`, `categoryOf`:

1. Реєстр `{ ...OBJECTIVES, dummyCounter: { schema: z.object({ kind: z.literal('dummyCounter'), event: z.string(), target: z.number().int() }).strict(), init: () => 0, onEvent: (o, p, e) => (e.type === o.event ? p + 1 : p), isComplete: (o, p) => p >= o.target, describe: (o) => ({ unitKey: 'quest.unit.dummy', target: o.target }) } }`.
2. Рядок контенту `{ id: 'dummy', objective: { kind: 'dummyCounter', event: 'DUMMY_TICK', target: 3 }, … }` **проходить `QuestDefinitionSchema` з цим реєстром** (без `as unknown as`).
3. Повний цикл: `planAccept` → 3× `applyQuestEvents(DUMMY_TICK)` → `QUEST_READY` рівно один раз → `planClaim` видає нагороду; без цього реєстру той самий рядок **відхиляється** Zod-ом.
4. `selectQuestBoard(..., registry)` повертає рядок із `unit`/`target` від `describe`.
5. Guard-тест: сканує `packages/engine/src` і `apps/web/src`, падає, якщо `objective.kind ===` або `.objective.kind` зустрічається поза `quests/objectives/` (D1/R3).

## 6. Питання до Олега

1. **Q1.** Яка специфікація UI еталонна: `quest-board-spec.md` (v1, Cinzel, 60px) чи `updates-for-quest-board-spec.md` (v2, «темне золото», 64px)? Код тепер на 64px, `CLAUDE.md` каже 60px.
2. **Q2.** Що таке «Practice group»: нова категорія фільтра (поряд з Gathering/Combat/Learning/Expedition), група в списку чи окремий тип квестів? У документах не згадується.
3. **Q3.** Для цілей `reach`/`use`: що саме рахуємо — вхід у локацію (`WORLD_TRAVELLED`), крок на гекс певного об'єкта, застосування предмета в світі? Для `use` потрібна нова подія з ключем предмета.
4. **Q4.** Показувати замкнені квести (група LOCKED за спекою та R-Q-1) чи лишити поточну поведінку «замкнена картка II прихована» (тест `quest-board-seeker.test.ts:60`)?
5. **Q5.** Монетні ціни взяття потрібні в цьому релізі (спека, питання 4), чи фаза B2 може обмежитись підтримкою в моделі без контенту?
6. **Q6.** Серверний прапор `questsEnabled` (v3 §10) замість web-прапора `VITE_SEEKER_QUESTS` — підтверджуєте?
7. **Q7.** Фаза B7 (засідка) йде після B6 чи раніше за B4–B6?
8. Скіли `hexoflat-feature-audit` і `hexoflat-quests` — вони існують на вашій машині? Тут їх немає.
