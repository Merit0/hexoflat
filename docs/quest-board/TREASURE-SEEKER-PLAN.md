# Path of Will — Дошка квестів і квест «Шукач скарбів»: план реалізації для Claude Code

> **Статус:** концепція Олега, 08.11.2026, **v1 — пілот**.
> **Куди покласти:** `docs/TREASURE-SEEKER-PLAN.md`.
> **Пілот = фази Q0–Q7.** Після Q5 квест проходиться від дошки квестів до скрині. Засідка (Q6) підключається, коли готовий бій (`docs/BATTLE-SYSTEM-PLAN.md`, фаза B6).

---

## Старт — що вставити в Claude Code

1. Поклади цей файл у репозиторій: `docs/TREASURE-SEEKER-PLAN.md`.
2. Переключи гілку для задачі сам (Claude Code гілок не створює).
3. Відкрий **новий чат** Claude Code і встав промпт фази Q0 з §10. Після кожної фази — новий чат і промпт наступної фази.

Короткий промпт для першого запуску:

```text
Read docs/TREASURE-SEEKER-PLAN.md fully (§0–§12), then do Phase Q0 exactly as written in §10.
Work on the current branch; do not create branches. Do NOT run git commit.
If code contradicts the plan or the plan is ambiguous, stop and ask me.
```

---

## 0. Як працювати з цим документом (обов'язково прочитати)

1. **Одна фаза — один чат.** Фази Q0…Q7 у §9.
2. **Гілку не створюй.** Олег уже переключив потрібну гілку. Працюй на поточній.
3. **Ніколи не запускай `git commit`.** Олег комітить сам. Не питай про коміт.
4. **Скіли:** `hexoflat-phase` — завжди; `hexoflat-engine` — для `packages/engine`; `hexoflat-web-state` — для сторів/композаблів; `hexoflat-render` — для PixiJS-шарів; `hexoflat-e2e` — для Playwright; `hexoflat-mechanics` — коли сумніваєшся в правилі.
5. **Правила квесту живуть тільки в `packages/engine`.** Web відправляє команди, тримає проєкцію й анімує події.
6. **Усі числа — контент** (Zod, `CONTENT_VERSION` +1), не константи в коді правил (§4).
7. **Фізична гра.** Кожне правило має бути відтворюване за столом. Кожен рівень квесту має поле `tableRule` (§3.12).
8. **Якщо код суперечить плану** або план неоднозначний — зупинись і запитай.
9. Наприкінці фази — рядок у журнал §12.

---

## 1. Квест за 12 правил (коротко)

1. У кемпінгу стоїть **Дошка квестів**. На ній картки квестів. Картка показує: **ціну входу, кількість кроків сліду, ціну кроку у Волі**. Скільки Волі потрібно разом, гравець **рахує сам**.
2. **START** списує ціну входу і відкриває **нову згенеровану мапу в тумані**. Герой стоїть збоку біля вхідних воріт. Кожен запуск — нова мапа (новий сід).
3. Кожен гекс у тумані має **число**. Число видно, коли гекс відкривається: відкриваються **сусідні гекси героя** (кільце 1).
4. Від воріт до скрині прихований **слід** — послідовність чисел за правилом рівня (1, 2, 3… або 6, 12, 18… або 1, 7, 19, 37…).
5. Серед сусідів героя **рівно один** гекс має наступне число сліду. Решта — **пастки**: числа, на яких помиляються саме в математиці (на 1 більше/менше, пропущений крок, інша дія).
6. **Перші H кроків — підказка:** правильний гекс підсвічено золотом, щоб показати правило. Далі підсвітки немає, герой обирає сам.
7. **Крок уперед** на будь-який відкритий сусідній гекс коштує `stepCost` Волі.
8. **Пройдені гекси лишаються відкритими з числами** — герой бачить увесь свій слід і може перевірити роботу.
9. **Помилка не видна одразу.** Після неправильного гекса слід продовжується **за тим самим правилом уже від неправильного числа** — це **фальшивий слід**. Він виглядає «правильно» і на останньому кроці веде в **засідку**.
10. **Крок назад** (на гекс, з якого прийшов) коштує **втричі дорожче** (`stepCost × 3`). Так можна повернутися до місця помилки й піти правильно — тоді засідки не буде.
11. **Кінець Волі = кінець квесту.** Якщо Волі не вистачає на жоден крок — герой застряг, квест провалено, герой повертається в кемп. Окремої перевірки «чи вистачить» немає: межу виправлень задає запас Волі, який гравець порахував перед стартом.
12. **Фінал:** правильний слід → **скриня**, з якої падає здобич. Фальшивий слід → **засідка** (нерівний бій). Перемога в засідці → **зменшена скриня**. Поразка → смерть за правилами бою → кемп.

---

## 2. Словник

| Термін (укр.)  | Термін у коді / UI    | Значення                                                     |
| -------------- | --------------------- | ------------------------------------------------------------ |
| Дошка квестів  | `QuestBoard` / QUESTS | об'єкт у кемпінгу зі списком карток квестів                  |
| Картка квесту  | `QuestOffer`          | рівень, ціна входу, кроки, ціна кроку, нагорода              |
| Рівень         | `seekerTier`          | 1…15, визначає тип правила й числа (§4.1)                    |
| Слід           | `trail`               | істинний шлях від воріт до скрині: `L` гексів і `L` чисел    |
| Член сліду     | `term[i]`             | число на i-му гексі сліду (i = 1…L)                          |
| Правило        | `SequenceRule`        | чиста функція, що генерує члени (§3.2)                       |
| Пастка         | `decoy`               | число на сусідньому гексі, яке не є наступним членом         |
| Фальшивий слід | `falseTrail`          | продовження правила від неправильного числа, веде в засідку  |
| Відхилення     | `deviation`           | кожен крок на гекс, що не є наступним членом поточного сліду |
| Підказка       | `hintSteps`           | скільки перших кроків підсвічено                             |
| Крок назад     | `STEP_BACK`           | повернення на попередній гекс власного шляху, ціна ×3        |
| Застряг        | `STRANDED`            | Волі менше за ціну будь-якого кроку                          |
| Засідка        | `ambush`              | бій на кінці фальшивого сліду (через систему загонів бою)    |

---

## 3. Правила детально (контракти для engine)

### 3.1 Дошка квестів і картка

- **R-QB-1.** Дошка квестів — об'єкт мапи кемпінгу (`questBoard`). Герой стає на сусідній гекс і натискає на неї → у панелі відкривається вкладка/поповер QUESTS зі списком карток. _(Фізично: справжня дошка з картками.)_
- **R-QB-2.** Картка (`QuestOffer`) показує: назву «Treasure Seeker», рівень, **ціну входу**, **кількість кроків `L`**, **ціну кроку `stepCost`**, ціну кроку назад (`stepCost × 3`), тип нагороди. **Сума потрібної Волі не показується** — це задача гравця.
- **R-QB-3.** Доступні рівні визначаються класом гравця (`minGrade` рівня ≤ клас гравця). Недоступні картки показано замкненими з причиною («Opens at grade 3»).
- **R-QB-4.** `START_QUEST { offerId }`: якщо Волі менше за ціну входу → `INSUFFICIENT_WILL` («Entry costs 20 Will, you have 15»). Інакше Воля списується, генерується мапа квесту, герой переходить на неї. **Достатність Волі на кроки не перевіряється** (R-WILL-Q-2).
- **R-QB-5.** Поки герой у квесті, інший квест почати не можна (`QUEST_IN_PROGRESS`).

### 3.2 Правила послідовностей

- **R-SEQ-1.** Правило — це дані + чиста функція: `{ kind, params }` → `term(i)` для i = 1…L. Види правил (`kind`):

| `kind`        | Параметри                                 | Приклад                                   | Тип         |
| ------------- | ----------------------------------------- | ----------------------------------------- | ----------- |
| `arith`       | `start, step` (step може бути < 0)        | 5, 10, 15… / 50, 47, 44…                  | рекурентне  |
| `geom`        | `start, ratio` (ratio 2 або ½, лише цілі) | 3, 6, 12, 24… / 96, 48, 24…               | рекурентне  |
| `alternating` | `start, steps[]`                          | 1, 3, 6, 8, 11… (+2, +3)                  | рекурентне  |
| `growingStep` | `start, step0, inc`                       | 1, 2, 4, 7, 11…                           | рекурентне  |
| `interleave`  | `a: rule, b: rule`                        | 1, 10, 2, 20, 3, 30…                      | складене    |
| `squares`     | `offset`                                  | 1, 4, 9, 16…                              | за індексом |
| `triangular`  | —                                         | 1, 3, 6, 10, 15…                          | за індексом |
| `centeredHex` | —                                         | 1, 7, 19, 37, 61…                         | за індексом |
| `fibonacci`   | `a, b`                                    | 1, 1, 2, 3, 5, 8…                         | рекурентне  |
| `affine`      | `start, mul, add`                         | 1, 3, 7, 15… (×2+1) / 1, 2, 5, 14… (×3−1) | рекурентне  |
| `primes`      | `fromIndex`                               | 2, 3, 5, 7, 11…                           | за індексом |
| `polynomial`  | `power, add`                              | 2, 5, 10, 17… (n²+1) / 1, 8, 27… (n³)     | за індексом |
| `lookAndSay`  | `seed`                                    | 1, 11, 21, 1211, 111221…                  | рекурентне  |

- **R-SEQ-2.** Параметри правила випадкові в межах діапазонів рівня (§4.1), з потоку RNG квесту.
- **R-SEQ-3.** Усі члени — цілі додатні числа з не більш ніж `maxDigits` цифр. Якщо параметри дають інше — перегенерувати.
- **R-SEQ-4. Продовження від неправильного числа** (`continueFrom(prefix, wrongValue)`) — потрібне для фальшивого сліду (R-FALSE):
  - **рекурентні** правила застосовують ту саму рекурентність до неправильного числа (`arith`: w + step; `geom`: w × ratio; `affine`: w × mul + add; `fibonacci`: наступний = w + попередній; `growingStep`, `alternating`: той самий наступний крок; `lookAndSay`: опис числа w);
  - правила **за індексом** зсувають решту послідовності на різницю: `false[j] = term[j] + (w − term[k])`;
  - `interleave` продовжує ту гілку, в якій сталося відхилення.
    Так людина, яка помилилася й далі рахує правильно, бачить слід, що «сходиться».

### 3.3 Однозначність — головне технічне правило генератора

- **R-AMB-1.** Гравець, який міркує правильно, **ніколи не повинен бути покараний.** Тому після перших `hintSteps` членів (те, що гравець бачить до самостійного вибору) наступний член має бути **однозначним**.
- **R-AMB-2.** Перевірка: перебрати **каталог альтернативних правил** (усі `kind` з §3.2 з малим перебором параметрів). Якщо якесь альтернативне правило збігається з видимим префіксом і дає інший наступний член — збільшити префікс (`hintSteps` +1, не більше `L − 2`) або перегенерувати параметри.
- **R-AMB-3.** Жодна пастка не може дорівнювати наступному члену **будь-якого** альтернативного правила, що збігається з тим, що гравець бачив на своєму шляху (включно з фальшивим слідом).
- **R-AMB-4.** Пастки (`decoy`) обираються зі шаблонів помилок: наступний ± 1, наступний ± 10, пропущений член (`term[k+2]`), інша дія (додав замість множення, крок `step+1`), повторення поточного числа. Усі пастки на одному кільці різні й ≠ правильному.

### 3.4 Мапа квесту і слід

- **R-MAP-1.** Мапа квесту генерується наявним генератором дошок з **новим пресетом `treasure-field`**: туман на всій дошці, природний край, вхідні ворота біля краю, без ворогів і загонів. Розмір — у межах ліміту дошок Олега (не більше 18×17).
- **R-MAP-2. Істинний слід** генерується разом із мапою: шлях з `L` гексів від гекса біля воріт. Вимоги: кожен гекс сліду межує лише з попереднім і наступним гексом сліду («слід сам себе не торкається»); біля кожного гекса сліду є достатньо вільних гексів для фальшивих продовжень (≥ 2 невідкритих сусіди поза слідом); останній гекс — **скриня**.
- **R-MAP-3. Сід** = `questRunId` → перезавантаження дає ту саму мапу й ті самі числа.
- **R-MAP-4.** Герой стоїть на гексі старту біля воріт. Гекс старту не має числа. Його сусіди відкриті й мають числа: серед них `term[1]`.

### 3.5 Відкриття і числа

- **R-REV-1.** Коли герой стає на гекс, відкриваються всі його невідкриті сусіди. **Число гексу призначається в момент відкриття** і більше не змінюється. _(Фізично: Наглядач кладе картку з числом на щойно відкритий тайл.)_
- **R-REV-2.** Призначення чисел під час відкриття:
  - якщо герой на **істинному сліді** без відхилень → наступний гекс сліду отримує `term[k+1]`, решта — пастки;
  - якщо герой на **фальшивому сліді** → **один** із щойно відкритих гексів отримує наступний член фальшивого сліду (`falseTerm[k+1]`), решта — пастки;
  - гекси, вже відкриті раніше, зберігають свої числа.
- **R-REV-3.** Якщо на фальшивому сліді немає жодного невідкритого сусіда для продовження — засідка спрацьовує одразу на поточному гексі.
- **R-REV-4.** Призначення детерміноване: потік RNG `quest:<id>:reveal:<n>`, де `n` — порядковий номер відкриття.

### 3.6 Кроки, підказки, Воля

- **R-STEP-1.** `QUEST_STEP { hex }` — на відкритий сусідній гекс, крім гекса, з якого прийшов (туди — тільки `STEP_BACK`). Ціна `stepCost`. Непрохідні гекси (вода, скеля — якщо пресет їх має) і тріснуті гекси (R-BACK-3) відхиляються.
- **R-STEP-2.** Крок записується в шлях героя `path[]` з числом гекса. Пройдені гекси показані на дошці з числами (слід).
- **R-HINT-1.** Поки `path.length < hintSteps` і відхилень немає — правильний сусідній гекс підсвічено (`hint`). Після цього підсвітки немає ніколи.
- **R-WILL-Q-1.** Квест платиться **загальною Волею героя** (як кроки по мапі). Бій у засідці — **бойовою Волею на хід** (R-WILL-2 бойового плану), загальна Воля в бою не витрачається.
- **R-WILL-Q-2.** Перед стартом і під час кроків гра **не підказує**, чи вистачить Волі.
- **R-WILL-Q-3.** Відмова через брак Волі на крок — `INSUFFICIENT_WILL` з текстом («A step costs 2 Will, you have 1»).

### 3.7 Помилка і фальшивий слід

- **R-FALSE-1.** Відхилення = крок на гекс, число якого ≠ наступний член **поточного** сліду (істинного або фальшивого). Лічильник `deviations` +1.
- **R-FALSE-2.** Після відхилення поточним стає фальшивий слід: `continueFrom(пройдені члени, число цього гекса)` (R-SEQ-4). Його довжина закінчується на тому ж кроці `L`, що й істинний слід.
- **R-FALSE-3.** Відхилення на фальшивому сліді створює новий фальшивий слід від нового числа (`deviations` +1).
- **R-FALSE-4.** Гра **ніяк не повідомляє** про помилку. Гравець може знайти її лише перевіривши свій слід.
- **R-FALSE-5.** Коли герой стає на `L`-й гекс фальшивого сліду, там з'являється «скриня» → це **засідка** (§3.9).

### 3.8 Крок назад

- **R-BACK-1.** `STEP_BACK` — на попередній гекс власного шляху. Ціна `stepCost × backMultiplier` (3). Можна повторювати, йдучи назад власним слідом до самого старту.
- **R-BACK-2.** Крок назад прибирає останній гекс зі шляху. Якщо прибрано гекс відхилення — `deviations` −1 і поточним знову стає слід до цього відхилення.
- **R-BACK-3.** Гекс, з якого зробили крок назад, стає **тріснутим** (`cracked`): число видно, стати на нього не можна. _(Фізично: картку перевертають.)_ Так помилку не можна «повторити випадково».
- **R-BACK-4.** Підказка (R-HINT-1) після кроку назад не повертається.
- **R-BACK-5. На майбутнє (не в пілоті):** з фальшивого сліду можна буде повернутися на правильну стежку без кроку назад — ступити на гекс, число якого неправильне для фальшивого сліду, але правильне для істинного, бо гравець зрозумів, де була помилка. Див. §8.

### 3.9 Фінал: скриня, засідка, провал

- **R-END-Q-1. Скриня.** Герой стає на `L`-й гекс істинного сліду → `CHEST_REVEALED`. `OPEN_CHEST` (безкоштовно) → здобич з таблиці `fullLoot` рівня → `QUEST_COMPLETED { outcome: 'treasure' }` → герой повертається до воріт кемпінгу (безкоштовно).
- **R-END-Q-2. Засідка.** Кінець фальшивого сліду → `AMBUSH_TRIGGERED { deviations }` → `BATTLE_REQUESTED { encounterId, ambush: true }` через систему загонів бою (R-ENC-6, R-FIELD бойового плану). Склад загону — з таблиці `ambushTable` рівня за кількістю відхилень (§4.3): **майже завжди нерівний бій**, і що більше помилок, то сильніший.
- **R-END-Q-3. Перемога в засідці** → повернення на гекс засідки, там скриня з таблиці `reducedLoot` → `OPEN_CHEST` → `QUEST_COMPLETED { outcome: 'ambush-won' }` → кемп.
- **R-END-Q-4. Поразка в засідці** → наявна смерть і повернення в кемп; `QUEST_FAILED { reason: 'DEATH' }`.
- **R-END-Q-5. Застряг.** Після будь-якого кроку, якщо Воля < `stepCost` (найдешевший можливий крок) → `QUEST_FAILED { reason: 'STRANDED' }` → герой повертається в кемп. Ціна входу не повертається.
- **R-END-Q-6. Сувій повернення** працює як завжди (5 Волі, з мапи квесту — односторонньо, як з підземелля) → `QUEST_FAILED { reason: 'LEFT' }`.
- **R-END-Q-7.** Мапа квесту після завершення видаляється. Наступний запуск — нова мапа.

### 3.10 Поки бою немає (до фази B6 бойового плану)

- **R-PILOT-1.** Якщо система загонів ще не готова, засідка розв'язується заглушкою: «скриня» виявляється порожньою, повідомлення «Ambush! (battle not connected yet)», `QUEST_FAILED { reason: 'AMBUSH_PENDING' }`. Перемикач — прапорець контенту `ambushBattleEnabled`.

### 3.11 Кооп

- **R-COOP-1.** Пілот — квест для одного героя. Проєкція й детермінізм готові до мультиплеєра, кооп-квести — окремим планом.

### 3.12 Фізична версія (для `tableRule`)

- Тайли мапи лежать сорочкою догори (туман). Наглядач має **картку сліду**: позиції гексів сліду на мапі й правило рівня.
- Коли герой стає на тайл, Наглядач перевертає сусідні тайли й кладе на них картки з числами: наступний член (за карткою сліду або від неправильного числа за правилом), решта — числа з картки пасток рівня.
- Перші H кроків Наглядач кладе на правильний тайл золотий жетон-підказку.
- Воля — трекер; крок назад — 3 кроки на трекері; тріснутий тайл — картку перевернуто.
- Скриня / засідка — тайл-скриня і, для засідки, жетони загону з `ambushTable`.

---

## 4. Числа (усе — контент, Zod, `CONTENT_VERSION` +1)

### 4.1 Рівні «Шукача скарбів» (стартові значення, тюнити після playtest)

| Рівень | `kind` (діапазони параметрів)         | Приклад           | `L` | `stepCost` | `hintSteps` | `maxDigits` | `minGrade` |
| ------ | ------------------------------------- | ----------------- | --- | ---------- | ----------- | ----------- | ---------- |
| 1      | `arith` start 1, step 1               | 1, 2, 3… 10       | 10  | 1          | 4           | 2           | 1          |
| 2      | `arith` start 0–10, step 2 / 5 / 10   | 5, 10, 15…        | 10  | 1          | 3           | 3           | 2          |
| 3      | `arith` start 30–100, step −1…−5      | 50, 47, 44…       | 10  | 1          | 3           | 3           | 2          |
| 4      | `arith` step 3–9 / 25 (лічба групами) | 6, 12, 18…        | 12  | 1          | 3           | 3           | 3          |
| 5      | `alternating` 2 кроки з 1–5           | 1, 3, 6, 8, 11…   | 12  | 2          | 4           | 3           | 3          |
| 6      | `geom` ratio 2 / ½                    | 3, 6, 12, 24…     | 8   | 2          | 3           | 3           | 3          |
| 7      | `growingStep` step0 1–3, inc 1        | 1, 2, 4, 7, 11…   | 10  | 2          | 4           | 3           | 4          |
| 8      | `interleave` двох `arith`             | 1, 10, 2, 20…     | 10  | 2          | 4           | 3           | 4          |
| 9      | `squares` / `triangular`              | 1, 4, 9, 16…      | 10  | 2          | 4           | 3           | 5          |
| 10     | `centeredHex`                         | 1, 7, 19, 37, 61… | 7   | 2          | 3           | 3           | 5          |
| 11     | `fibonacci` a, b 1–3                  | 1, 1, 2, 3, 5, 8… | 10  | 2          | 4           | 3           | 5          |
| 12     | `affine` ×2+1 / ×3−1                  | 1, 3, 7, 15…      | 7   | 3          | 4           | 4           | 6          |
| 13     | `primes`                              | 2, 3, 5, 7, 11…   | 10  | 3          | 5           | 2           | 6          |
| 14     | `polynomial` n²+c / n³                | 2, 5, 10, 17…     | 8   | 3          | 4           | 4           | 7+         |
| 15     | `lookAndSay`                          | 1, 11, 21, 1211…  | 6   | 3          | 4           | 6           | дорослі    |

- Ціна входу (`entryCost`): 20 для всіх рівнів у пілоті.
- `backMultiplier`: 3.
- Мінімум Волі для чистого проходу = `entryCost + L × stepCost` (рівень 1: 20 + 10 × 1 = 30). Запас понад це — бюджет на виправлення.
- `minGrade` — прив'язка до класу гравця. Цільовий гравець зараз — 4 клас (задачі 2–4 класу). Рівні 13–15 — для старших і для батьків.

### 4.2 Нагорода

| Поле          | Значення                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fullLoot`    | таблиця здобичі скрині рівня (конкретні предмети з вагами, як у R2 rarity-плану)                                                                                  |
| `reducedLoot` | менша таблиця: менше предметів, без найкращих                                                                                                                     |
| Рідкість      | за системою трьох світів (`{ kind, boss }`); `locationType` мапи квесту — контент пресету. Чи може повна скриня давати «бос»-колір — вирішити в Q0 разом з Олегом |

### 4.3 Засідка (`ambushTable`, якщо `ambushBattleEnabled`)

| Відхилень | Склад (пілот, з загонів бою)       | Відчуття                  |
| --------- | ---------------------------------- | ------------------------- |
| 1         | `skeleton-pack` (2 воїни + лучник) | важкий, але можна виграти |
| 2         | `skeleton-pack` + воїн             | дуже важкий               |
| 3+        | `bone-court` (король + 2 воїни)    | майже безнадійний         |

Завжди з перевагою засідки (вороги ближче й на флангах, перевага ініціативи в раунді 1). Числа тюнити ботом після бою (REQ-TQS-014).

---

## 5. UI (стиль Олега = правило)

### 5.1 Стиль — бери з наявного коду

Ті самі токени, що у вкладках `hero-board-panel.vue`, Hero tab v2 і бойовому плані (§5.1 BATTLE-SYSTEM-PLAN): фон `#191D20`, картки `#262E33` / рамка `#36424A`, золото `#E8D7A8`, смужка Волі `#5B3FE0 → #9A6BFF`, Cinzel для заголовків і чисел, Alegreya Sans для тексту. Підписи UI — англійською через i18n.

### 5.2 Дошка квестів (поповер / вкладка QUESTS)

```
┌──────────────────────── QUEST BOARD ────────────────────────┐
│ ┌───────────────────────────────────────────────────────┐   │
│ │ TREASURE SEEKER · I                                   │   │
│ │ Follow the numbers through the fog to the chest.      │   │
│ │ Entry 20 Will · 10 steps · step 1 Will · back 3 Will  │   │
│ │ Reward: chest                          [   START   ]  │   │
│ └───────────────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ TREASURE SEEKER · V                                   │   │
│ │ Entry 20 Will · 12 steps · step 2 Will · back 6 Will  │   │
│ │ Reward: chest                          [   START   ]  │   │
│ └───────────────────────────────────────────────────────┘   │
│ ┌ TREASURE SEEKER · IX ─────────────── 🔒 Opens at grade 5 ┐ │
│ Your Will: 47                                               │
└─────────────────────────────────────────────────────────────┘
```

- **Суми потрібної Волі на картці немає** (R-QB-2).

### 5.3 Мапа квесту

- Туман як у підземеллі. Відкриті гекси показують **число** в центрі (Cinzel, великим, читабельно на мобільному).
- Підказка: золоте світіння правильного гекса в перші H кроків.
- Досяжні гекси: синя рамка + ціна (`1`); гекс, з якого прийшов: рамка й ціна кроку назад (`↩ 3`).
- **Пройдений слід:** гекси шляху з числами й тонкою лінією, що їх з'єднує, — щоб було легко перевірити послідовність. Гекс відхилення **нічим не відрізняється** (R-FALSE-4).
- Тріснутий гекс: число видно, тріщина, приглушено.
- Банер угорі: `TREASURE SEEKER · I | Step 6 / 10 | 14 Will`.
- Скриня: жетон скрині на `L`-му гексі; засідка — та сама скриня, потім жетони загону виринають з неї (анімація) → картка розстановки бою.

### 5.4 Панель під час квесту

- Картка квесту (ті самі числа, що на дошці) + рядок «Your trail: 1 · 2 · 3 · 4 · 5» — числа пройденого сліду в рядок, щоб їх легко було переглянути.
- Кнопка **STEP BACK · 3 Will** (активна, якщо є куди й вистачає Волі).
- Кнопка сувою повернення, якщо він у руці (як завжди).

### 5.5 data-testid

`quest-board`, `quest-offer-<tier>`, `quest-offer-start-<tier>`, `quest-offer-locked-<tier>`, `quest-banner`, `quest-trail-row`, `quest-step-back`, `quest-hex-number-<q>_<r>`, `quest-chest`, `quest-result`.

---

## 6. Архітектура

### 6.1 Engine (`packages/engine/src/quests/`)

```
quests/
  quest-content.ts        Zod: QuestOffer, seeker tiers (§4.1), loot/ambush tables, prices
  quest-state.ts          Zod: QuestRun (у снапшоті гри, адитивно)
  sequences/
    rules.ts              SequenceRule kinds + term(i) (R-SEQ-1)
    continue-from.ts      continueFrom для фальшивого сліду (R-SEQ-4)
    alternatives.ts       каталог альтернативних правил + перевірка однозначності (R-AMB)
    decoys.ts             шаблони пасток (R-AMB-4)
  trail.ts                генерація істинного сліду на мапі (R-MAP-2)
  reveal.ts               призначення чисел при відкритті (R-REV)
  quest-actions.ts        START_QUEST, QUEST_STEP, STEP_BACK, OPEN_CHEST, ambush/stranded/end
  projection.ts           projectQuestForViewer — без істинного сліду й без позначки відхилень
```

**`QuestRun`** (скорочено): `id`, `offerId`, `tier`, `seed`, `rule`, `trail[] { hex, term }`, `path[] { hex, number }`, `currentTrail: 'true' | { deviationAt, values[] }`, `deviations`, `revealed{ hex → number }`, `cracked[]`, `revealCount`, `hintSteps`, `phase: 'walking' | 'chest' | 'ambush' | 'ended'`, `outcome?`.

**Команди:** `START_QUEST { offerId }`, `QUEST_STEP { hex }`, `STEP_BACK`, `OPEN_CHEST`, `ABANDON_QUEST` (через сувій). Відмови: `INSUFFICIENT_WILL`, `QUEST_IN_PROGRESS`, `TIER_LOCKED`, `NOT_ADJACENT`, `HEX_CRACKED`, `HEX_BLOCKED`, `NOTHING_TO_STEP_BACK`, `NO_CHEST`.

**Події:** `QUEST_STARTED`, `HEXES_REVEALED { numbers }`, `QUEST_STEPPED`, `QUEST_STEPPED_BACK`, `HEX_CRACKED`, `CHEST_REVEALED`, `CHEST_OPENED { items }`, `AMBUSH_TRIGGERED { deviations }`, `QUEST_COMPLETED { outcome }`, `QUEST_FAILED { reason }`.

**Приховане:** проєкція **не** містить `trail`, `currentTrail`, `deviations` і числа невідкритих гексів. Тест: зміна істинного сліду за межами відкритого не змінює проєкції.

**Детермінізм:** потоки RNG `quest:<id>:rule`, `quest:<id>:trail`, `quest:<id>:reveal:<n>`. Той самий сід + команди → ті самі події.

**Генератор:** новий пресет `treasure-field` (§3.4). Розширити наявний генератор — не переписувати.

### 6.2 Web (`apps/web`)

- `stores/quest-store.ts` — команди + проєкція + черга подій. Без правил.
- `composables/use-quest-view.ts` — view-model картки, банера, рядка сліду, кнопок.
- Компоненти `apps/web/src/a-game-scenes/map-scene/components/quests/`: `quest-board-panel.vue`, `quest-offer-card.vue`, `quest-run-card.vue`, `quest-result-card.vue`.
- Рендер: `render/layers/quest-numbers-layer.ts` — числа на гексах, підказка, лінія сліду, тріснуті гекси, ціни кроків, скриня.

---

## 7. Контракти (тест на кожен, назва тесту = ID)

| ID          | Контракт                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| REQ-TQS-001 | кожен `kind` з §3.2 дає правильні перші 8 членів для фіксованих параметрів (таблиця прикладів §4.1)                                                    |
| REQ-TQS-002 | параметри рівня завжди дають цілі додатні члени ≤ `maxDigits` (1000 сидів на рівень)                                                                   |
| REQ-TQS-003 | однозначність: на 1000 сидів на рівень жодне альтернативне правило з каталогу не збігається з видимим префіксом і не дає іншого наступного члена       |
| REQ-TQS-004 | пастки: різні, ≠ правильному, ≠ наступному члену будь-якого збіжного альтернативного правила                                                           |
| REQ-TQS-005 | слід: `L` гексів, сам себе не торкається, останній — скриня, біля кожного ≥ 2 вільних невідкритих сусіди; той самий сід → та сама мапа                 |
| REQ-TQS-006 | відкриття: на кожному кільці рівно один гекс з наступним членом поточного сліду; число не змінюється після відкриття                                   |
| REQ-TQS-007 | START: ціна входу списується; брак → `INSUFFICIENT_WILL`; достатність на кроки не перевіряється                                                        |
| REQ-TQS-008 | крок `stepCost`, крок назад `stepCost × 3`; брак → `INSUFFICIENT_WILL`                                                                                 |
| REQ-TQS-009 | підказка лише в перші `hintSteps` кроків і лише без відхилень; після кроку назад не повертається                                                       |
| REQ-TQS-010 | відхилення → фальшивий слід за `continueFrom`; на кроці `L` фальшивого сліду → `AMBUSH_TRIGGERED { deviations }`                                       |
| REQ-TQS-011 | крок назад через гекс відхилення прибирає відхилення; після цього правильний шлях веде до скрині без засідки; покинутий гекс тріснутий                 |
| REQ-TQS-012 | Воля < `stepCost` → `QUEST_FAILED STRANDED` → кемп; ціна входу не повертається                                                                         |
| REQ-TQS-013 | скриня істинного сліду → `fullLoot`; перемога в засідці → `reducedLoot`; поразка → смерть → кемп                                                       |
| REQ-TQS-014 | засідка: склад за `ambushTable` і відхиленнями; бот-герой виграє засідку з 1 відхиленням 30–50%, з 3+ ≤ 10% (після бойового B3; тюнити числа контенту) |
| REQ-TQS-015 | проєкція не містить істинного сліду, `currentTrail`, `deviations`, чисел невідкритих гексів                                                            |
| REQ-TQS-016 | реплей: той самий сід + команди → ті самі події й ті самі числа                                                                                        |
| REQ-TQS-017 | кожен рівень має `tableRule`                                                                                                                           |

---

## 8. Чого НЕ робимо в цьому плані

- **Повернення з фальшивого сліду на правильну стежку без кроку назад** (R-BACK-5) — наступна версія. Ідея Олега: гравець відповідає «неправильно» для фальшивого сліду, але рухається правильним напрямком, бо зрозумів, де помилився. Потребує, щоб на фальшивому сліді серед сусідів був і гекс з істинним продовженням.
- Слідів, де число залежить від **напрямку** кроку.
- Розвилки «два сліди» біля воріт (простий → мала скриня, складний → рідкісна).
- Фінального «замка» скрині (назвати наступне число без гексів).
- Інших квестів з дошки (Додаток А) — окремі плани на тому самому каркасі `quests/`.
- Кооп-квестів.
- Обмеження «скільки разів на день» — вирішити після playtest.
- Росту характеристик героя від успіху в темі.

---

## 9. Фази

| Фаза                   | Що                                                                                                                                                                                                               | Межі                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Q0 — Аудит**         | туман/відкриття, генератор (пресети, сіди, ворота), загальна Воля, скрині/здобич, смерть/повернення в кемп, сувій повернення, де в кемпінгу стане дошка, стан бойового плану (B-фази); `docs/quests/Q0-AUDIT.md` | без змін поведінки                 |
| **Q1 — Послідовності** | `sequences/` — правила, `continueFrom`, каталог альтернатив, однозначність, пастки; контент рівнів §4.1                                                                                                          | лише engine                        |
| **Q2 — Ядро квесту**   | `quest-state`, `trail`, `reveal`, дії, фальшивий слід, крок назад, застряг, скриня, проєкція; засідка — подія + заглушка R-PILOT-1                                                                               | engine                             |
| **Q3 — Мапа квесту**   | пресет `treasure-field` у генераторі; підключення до `trail.ts`                                                                                                                                                  | генератор + engine                 |
| **Q4 — Дошка квестів** | об'єкт `questBoard` у кемпінгу, `quest-store`, `use-quest-view`, картки, START, перехід на мапу квесту й назад                                                                                                   | `apps/web`                         |
| **Q5 — Рендер квесту** | `quest-numbers-layer`: числа, підказка, лінія сліду, тріснуті, ціни, банер, скриня, панель під час квесту                                                                                                        | `apps/web/src/render` + `apps/web` |
| **Q6 — Засідка**       | після бойового B6: `ambushTable`, `BATTLE_REQUESTED` з квесту, повернення на мапу квесту, `reducedLoot`; прапорець `ambushBattleEnabled`                                                                         | engine + web                       |
| **Q7 — E2E**           | Playwright-сценарії                                                                                                                                                                                              | `apps/playwright`                  |

---

## 10. Промпти фаз (копіюй у новий чат Claude Code)

Спільне для всіх: _працюй на поточній гілці, не створюй гілок, **не запускай `git commit`**; якщо код суперечить плану — зупинись і запитай; наприкінці додай рядок у журнал §12 і зупинись._

### Q0 — Аудит

```text
Phase Q0 of docs/TREASURE-SEEKER-PLAN.md (hexoflat / Path of Will). Work on the current branch; do not create branches. Do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine, hexoflat-web-state.
Read the whole plan first (§0–§12).

Goal: know exactly what the quest needs from existing code. No behaviour change.
1. Find: fog/reveal logic and where it lives (engine or web); board generator presets, seeds, gates/exits (docs/BOARD-GENERATOR-PLAN.md); how map Will is charged per step; chests/loot/pickup; death → camp respawn; return scroll one-way exit from generated maps; camping map objects and how a clickable object opens a panel; player grade/level (knowledge module); state of docs/BATTLE-SYSTEM-PLAN.md phases (is the encounter/ambush API available?).
2. Write docs/quests/Q0-AUDIT.md: extension points for quests/, the `treasure-field` preset and the `questBoard` camp object; every conflict with plan §3–§6 (e.g. reveal radius, where numbers on hexes can render, rarity of quest loot).
Acceptance: workspace green; game unchanged. Journal row, stop.
```

### Q1 — Послідовності

```text
Phase Q1 of docs/TREASURE-SEEKER-PLAN.md. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine.
Read: plan §3.2, §3.3, §4.1, §6.1, §7; Q0 audit; journal.

Build packages/engine/src/quests/sequences/ and quest-content.ts:
1. rules.ts: every kind of §3.2 as data + pure term(i); parameter ranges per tier from content (§4.1, CONTENT_VERSION +1).
2. continue-from.ts per R-SEQ-4 (recurrent kinds re-apply the recurrence to the wrong value; index kinds shift by the difference; interleave continues its own branch).
3. alternatives.ts: catalogue of alternative rules (all kinds, small parameter search) + isUnambiguous(prefix, intendedNext); generator raises hintSteps (max L−2) or re-rolls parameters (R-AMB-2).
4. decoys.ts: mistake templates (R-AMB-4) filtered by R-AMB-3.
5. Tests REQ-TQS-001…004 (1000 seeds per tier for 002–004).
Acceptance: engine green; no web changes. Journal row, stop.
```

### Q2 — Ядро квесту

```text
Phase Q2 of docs/TREASURE-SEEKER-PLAN.md. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine.
Read: plan §3.1, §3.4–§3.11, §6.1, §7; Q0 audit; journal.

1. quest-state.ts (Zod, additive snapshot change), trail.ts (R-MAP-2 on an abstract hex set; real preset in Q3), reveal.ts (R-REV, RNG stream per reveal).
2. quest-actions.ts: START_QUEST (entry cost only, R-QB-4), QUEST_STEP, STEP_BACK (×3, cracked hexes, deviation removal), false trail via continueFrom, ambush event on step L of a false trail, STRANDED check after every step, OPEN_CHEST with fullLoot, return to camp gates.
3. Ambush placeholder R-PILOT-1 behind content flag ambushBattleEnabled=false.
4. projection.ts hides trail, currentTrail, deviations, unrevealed numbers.
5. Tests REQ-TQS-005 (abstract board), 006–013 (013 without the battle part), 015, 016.
Acceptance: engine green. Journal row, stop.
```

### Q3 — Мапа квесту

```text
Phase Q3 of docs/TREASURE-SEEKER-PLAN.md. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine.
Read: plan §3.4, §6.1; Q0 audit (generator extension points); journal.

1. Generator preset `treasure-field`: fog everywhere, natural edge, entrance gates on the edge, no enemies, size within the 18×17 limit. Extend the generator, do not rewrite it.
2. Wire trail.ts to the generated board; trail requirements of R-MAP-2 hold on 200 seeds per tier (REQ-TQS-005 on real boards).
Acceptance: engine/generator tests green; dev route shows a quest map for a fixed seed. Journal row, stop.
```

### Q4 — Дошка квестів

```text
Phase Q4 of docs/TREASURE-SEEKER-PLAN.md. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-web-state.
Read: plan §3.1, §5.1–§5.2, §5.4–§5.5, §6.2. The existing UI design (side panel, tabs, Hero tab v2 tokens) is the rule.

1. Camp map object `questBoard` (sprite placeholder ok); adjacent hero + tap opens the QUEST BOARD panel.
2. quest-store.ts and use-quest-view.ts (no rules). Offer cards exactly as §5.2 — no total-Will sum anywhere; locked tiers with reason.
3. START → quest map; quest run card in the panel with the trail row and STEP BACK; result card on end; back to camp.
4. i18n for every label; data-testids from §5.5.
Acceptance: store/view-model tests; manual: start tier I, walk, step back, finish; workspace green. Journal row, stop.
```

### Q5 — Рендер квесту

```text
Phase Q5 of docs/TREASURE-SEEKER-PLAN.md. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-render.
Read: plan §5.3; journal.

1. render/layers/quest-numbers-layer.ts from the quest projection: numbers on revealed hexes (large, readable on mobile), gold hint glow, walked-trail line through visited hexes, cracked hexes, step prices (forward / ↩ back), chest token.
2. Banner TREASURE SEEKER · <tier> | Step k / L | <Will> Will.
3. The deviation hex must look exactly like any other walked hex.
Acceptance: render tests; manual check on desktop and mobile width; workspace green. Journal row, stop.
```

### Q6 — Засідка

```text
Phase Q6 of docs/TREASURE-SEEKER-PLAN.md. Only after BATTLE-SYSTEM-PLAN B6 is done. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-engine, hexoflat-web-state.
Read: plan §3.9, §4.3, §7; BATTLE-SYSTEM-PLAN §3.1, §3.1b, §3.15.

1. ambushTable content; AMBUSH_TRIGGERED → BATTLE_REQUESTED { ambush: true } with the composition for the deviation count.
2. Victory → back to the ambush hex on the quest map, chest with reducedLoot → OPEN_CHEST → camp. Defeat → existing death → camp, QUEST_FAILED DEATH.
3. ambushBattleEnabled=true. Chest-to-ambush animation (enemies rise from the chest).
4. Tests REQ-TQS-013 (battle part), 014 with the battle hero bot.
Acceptance: workspace green. Journal row with balance numbers, stop.
```

### Q7 — E2E

```text
Phase Q7 of docs/TREASURE-SEEKER-PLAN.md. Current branch, no new branches, do NOT run git commit.
Load skills: hexoflat-phase, hexoflat-e2e.

1. Test hook via window.__HEXOFLAT_TEST__: fixed quest seed.
2. Specs: offer card shows entry/steps/step price and no total; START with too little Will for entry is refused; tier I clean run → chest → loot → camp; hint glow only in the first steps; one wrong step then follow the false trail → ambush (or placeholder); one wrong step, step back ×3 price, cracked hex, correct path → chest; run out of Will → STRANDED → camp; reload mid-quest restores the same numbers.
Acceptance: workspace green incl. e2e. Journal row, stop.
```

---

## 11. Відкриті питання для Олега (не блокують Q0–Q2)

1. Чи знижують **виправлені** помилки (з кроком назад) скриню, чи достатньо того, що крок назад коштує ×3? _(План: не знижують.)_
2. Чи може повна скриня давати предмет «бос»-кольору? _(План: вирішити в Q0.)_
3. Де стоїть дошка квестів: об'єкт у кемпінгу чи окрема вкладка QUESTS? _(План: об'єкт у кемпінгу, як фізична дошка.)_
4. Ліміт запусків на день проти фарму луту. _(План: після playtest.)_

---

## 12. Журнал

| Дата       | Фаза | Результат                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 08.11.2026 | —    | План v1 створено: дошка квестів + «Шукач скарбів», 15 рівнів, фальшивий слід → засідка, крок назад ×3                                                                                                                                                                                                                                                                                     |
| 12.11.2026 | Q0   | Аудит без змін коду: [`Q0-AUDIT.md`](./Q0-AUDIT.md). Світ, бій і Воля вже серверні → `QuestRun` у `ServerWorld`, одна команда `WORLD_QUEST`; бій готовий, заглушка засідки не потрібна; `gates: entry` потребує стін (нова деталь `edge-entry`); класу гравця немає; сувій лише з `a_teleport`; таблиць дропу в грі ще немає. 12 конфліктів K1–K12 і 6 питань до Олега в §13, §15 аудиту. |

---

## Додаток А. Інші квести для дошки (довідка, не реалізовувати в цьому плані)

Каркас `quests/` (картка → START → мапа → фінал) розрахований і на ці квести. Кожен — окремий план пізніше.

| Квест                   | Математика                            | Механіка на гексах                                                | Клас |
| ----------------------- | ------------------------------------- | ----------------------------------------------------------------- | ---- |
| Міст через прірву       | розклад числа, складання до 10/20/100 | на проваля з числом кладуть камені-фішки, що разом дають це число | 2–3  |
| Рівно стільки Волі      | додавання/віднімання, маршрут         | дійти до воріт з рівно K Волі; тайли з різною ціною               | 2–3  |
| Пиріг алхіміка          | дроби (½, ⅓, ⅙)                       | гекс-котел з 6 трикутних секторів; наповнити, напр., 5/6          | 3–4  |
| Кільця скарбу           | множення на 6, відстань               | «скарб у кільці з 18 гексів» → кільце 3; копати коштує Волю       | 3    |
| Валун і сила            | порівняння, суми                      | які валуни зсунути за хід, якщо сила 12 (вага проти сили)         | 2–3  |
| Скриня з розрядами      | розряди до 1000                       | три кільця замка: сотні, десятки, одиниці                         | 2–3  |
| Торговець на роздоріжжі | гроші, решта                          | монети 1/10/100; торговець «помиляється» з рештою                 | 2–3  |
| Чесний поділ здобичі    | ділення, остача                       | розкласти кристали порівну по мішках союзників                    | 3–4  |
| Годинник старої вежі    | час, тривалість                       | стрілка через сторони гекса (1 сторона = 2 год)                   | 2–3  |
| Дзеркальна зала         | симетрія                              | розставити фішки симетрично відносно однієї з 6 осей              | 3–4  |
| Огорожа табору          | периметр і площа                      | обгородити N гексів M жердинами                                   | 3–4  |
| Квітка семи каменів     | суми, логіка                          | числа 1–7 у квітці з 7 гексів, однакова сума на 3 прямих          | 3–4  |
| Розповідь мандрівника   | текстові задачі, бар-модель           | дві смуги з гекс-фішок, мітка-різниця                             | 3–4  |
| Карта з напрямками      | положення і рух                       | «3 кроки ↗, 2 →»; зворотна задача — найкоротший шлях              | 3–4  |
