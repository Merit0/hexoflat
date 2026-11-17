# Path of Will — фабрика токенів предметів (план і специфікація для Claude Code)

> Гра: **Path of Will** (репозиторій `hexoflat`). Версія 2, переписано 2026-11-17 за рішеннями Олега.
> Межі: **лише схема об'єктів предметів і фабрика, що їх створює**, плюс заміна наявних ручних предметів на нові. Таблиці здобичі, шанси випадіння, магазин, бойові ефекти атрибутів — інші плани.
> Пов'язані: `docs/loot-plan.md` (розкладання здобичі), `docs/RARITY-REALMS-PLAN.md` (рідкість; світло боса **замінено** цим планом, §2), `docs/architecture/domain-model-plan.md` (файлу немає, LG0). Цей план: `docs/architecture/loot-generator-plan.md`.
> Назви файлів і типів — цільові; фаза **LG0** звіряє їх з кодом. Гілку створює Олег. **Не комітити.** Одна фаза = один чат.

---

## 0. Мета

Два способи створити предмет, один формат результату:

|             | **Базовий токен** (`base`)     | **Унікальний токен** (`unique`)       |
| ----------- | ------------------------------ | ------------------------------------- |
| Хто створює | фабрика за правилами           | Creator, вручну в контенті            |
| Назва       | генерується зі слів            | фіксована                             |
| Спрайт      | випадковий з пулу теки         | свій, неповторний                     |
| Атрибути    | RNG                            | фіксовані (+ за бажанням згенеровані) |
| Навички     | порожньо (поле готове)         | задає Creator                         |
| Ціна        | випадкова в діапазоні рідкості | задає Creator                         |
| Повтори     | так                            | один на героя                         |

Навіщо: гравець бачить різні речі, а не той самий меч усюди; Creator не пише прототип для кожного шаблонного предмета; контент не росте. Додати спрайт, тип зброї, атрибут, слово чи мову = додати дані, **без змін коду і без поломок**.

## 1. Структура токена (одна для обох видів)

```ts
interface ItemToken {
  id: ItemTokenId;
  origin: 'base' | 'unique';
  uniqueKey?: UniqueKey; // лише для unique
  type: ItemTypeKey; // 'sword' | 'shield' | 'axe' | 'pickaxe' | ...
  rarity: ERarityKind; // 'gloom' | 'idol' | 'spark' | 'god-executor'
  name: TokenName; // ключі, не рядок (§4)
  description: DescriptionLine[]; // ключ + параметри (§6)
  attributes: { key: AttributeKey; value: number }[];
  skills: SkillKey[];
  price: number; // у монетах
  sprite: SpriteKey; // ім'я файлу, не індекс
  mapTier: 1 | 2 | 3; // рівень мапи, де створено
  generatorVersion: number;
  ext: TokenExtensions; // заглушки на майбутнє, усі null/[] зараз
}
interface TokenExtensions {
  aspects: AspectKey[]; // особливі правила
  heroGrade: number | null; // ступінь героя як параметр генерації
  durability: number | null;
  setKey: string | null; // набори предметів
  sockets: number | null;
}
type TokenName =
  | { kind: 'generated'; prefix: WordKey; noun: ItemTypeKey; suffix: WordKey }
  | { kind: 'authored'; nameKey: I18nKey };
```

Токен зберігає **результат**, не сід. Зміна пулів не змінює токени, що вже лежать у сумках.

## 2. Рідкість і світло

Рідкість — це світ. Колір світла за предметом = світ + вид токена.

| Рідкість                   | Світ          | Базовий                      | Унікальний                      |
| -------------------------- | ------------- | ---------------------------- | ------------------------------- |
| `gloom` (Морок)            | підземелля    | синій `blue-light.png`       | фіолетовий `violet-light.png`   |
| `idol` (Кумир)             | земля         | білий/сірий `gray-light.png` | зелений `green-light.png`       |
| `spark` (Іскра)            | небо          | жовтий `yellow-light.png`    | помаранчевий `orange-light.png` |
| `god-executor` (Кат Богів) | будь-який бос | —                            | червоний `red-light.png`        |

Файли світла лежать у `apps/web/public/hex-assets/hex-frames/` (усі сім є, LG0 §C).

`lightTone(token) = token.origin === 'base' ? '<realm>-base' : '<realm>-unique'`; God Executor буває лише унікальним. Поле `boss` з плану рідкості зникає: бос дає базовий токен свого світу плюс шанс на унікальний (шанс задає об'єкт-носій, поза цим планом).

## 3. Типи предметів

```ts
interface ItemTypeDefinition {
  key: ItemTypeKey;
  slot: 'hand'; // інші слоти — пізніше
  strike: number; // сила удару в пів-серцях; рука = 0.5
  block?: { sides: number }; // щит
  tool: { action: 'chop' | 'mine' } | null; // інструмент збирання; бити можна все одно
  nounKey: WordKey;
  realms: ERarityKind[]; // у яких світах може згенеруватися
}
```

Початковий набір — типи, для яких уже є спрайти: `sword`, `shield`, `axe` (`tool: chop`, удар 0.5), `pickaxe` (`tool: mine`, удар 0.5). Числа — контент. Новий тип (кинджал, булава, спис, лук…) = рядок даних + тека спрайтів.

**Сила удару належить лише типу.** Жоден атрибут її не змінює (рішення Олега 2026-11-17).

## 4. Назва

- Генератор вибирає **ключі** слів: `prefix` + іменник типу + `suffix`. Префікс і суфікс є завжди.
- Кожен ключ має запис у кожній мові; кожна мова має свій шаблон. Мова гравця лише показує ті самі ключі.

| Мова | Шаблон                     | Приклад (`ash` + `sword` + `warden`) |
| ---- | -------------------------- | ------------------------------------ |
| en   | `{prefix} {noun} {suffix}` | Ashen Sword of the Warden            |
| uk   | `{noun} {prefix} {suffix}` | Меч Попелу Вартового                 |

- Українські префікси й суфікси — іменники в родовому відмінку, тож рід іменника не важить.
- Назва може не відповідати атрибутам (рішення Олега: базові речі швидко продаються).
- Пули: ≥ 32 префікси й ≥ 32 суфікси на старті; слово може мати тег світу (`realms`), тоді воно трапляється лише в ньому. Усі слова оригінальні.
- Нова мова = новий стовпчик словника + шаблон.

## 5. Атрибути

```ts
interface AttributeDefinition {
  key: AttributeKey; // 'heart' | 'shield' | 'force' | 'mass' | 'will' | 'fog' | 'bag'
  valueByTier: Record<1 | 2 | 3, number>; // напр. heart: {1: 0.5, 2: 0.5, 3: 1}
  weight: number;
  allowedTypes?: ItemTypeKey[]; // порожньо = будь-який тип
  implemented: boolean; // false = заглушка, не потрапляє в реальну генерацію
}
```

- Кількість: RNG, 0–2, рівні ваги, без повторів.
- Значення: за рівнем мапи з `valueByTier`.
- `implemented` ставить LG0 за кодом: `true` лише якщо герой або бій справді читає атрибут.
- Атрибута «damage» немає: сила удару — властивість типу (§3).
- Ступінь героя як параметр — заглушка `ext.heroGrade`, генератор його поки не читає.

## 6. Опис

Коротко й сухо, як підписи на кресленні. Складається з даних, тож завжди правдивий:

```
en:  Sword · Gloom
     Strike 0.5 · Hearts +0.5 · Shield +1
     Tier 2
uk:  Меч · Морок
     Удар 0.5 · Серця +0.5 · Щит +1
     Рівень 2
```

Зберігається як `DescriptionLine { key: I18nKey; params }[]`. Інструмент додає рядок «Рубка» / «Видобуток». Унікальний може мати один свій рядок `descriptionKey` перед автоматичними.

## 7. Спрайти

- Базові: `apps/web/public/hex-assets/items/base/<realm>-<type>/<realm>-<type>-<NN>.png`, приклад `items/base/idol-sword/idol-sword-01.png`.
- Унікальні: `items/unique/unique-<uniqueKey>.png`.
- Усі спрайти однакового розміру й формату (розмір фіксує LG0 за наявними).
- Скрипт збирання створює **маніфест** спрайтів, який читає engine (engine не бачить файлової системи).
- Тест: кожен файл відповідає шаблону й розміру; маніфест збігається з теками.
- Якщо для пари світ+тип ще немає спрайта: беремо будь-який спрайт цього типу, інакше `items/base/_placeholder.png`. Відсутній спрайт — попередження в звіті тесту, не падіння.
- Наявні спрайти меча, щита, сокири й кайла переносяться в нову схему.

## 8. Ціна

- Базовий: випадкова ціна в діапазоні рідкості `priceRange: Record<realm, [min, max]>` (контент).
- Унікальний: ціну задає Creator.
- Торговець рахує відсоток від ціни токена — це план магазину, не цей.

## 9. Унікальні токени

```ts
interface UniqueTokenDefinition {
  key: UniqueKey;
  type: ItemTypeKey;
  rarity: ERarityKind;
  nameKey: I18nKey;
  descriptionKey?: I18nKey;
  sprite: SpriteKey;
  attributes: { key: AttributeKey; value: number }[];
  skills: SkillKey[];
  price: number;
  rolled?: { attributes?: number }; // скільки додати генератором
  revision: number;
}
```

- Один унікальний на героя: `progress.ownedUniques: UniqueKey[]` + чиста функція `isUniqueAvailable(progress, key)`.
- Шанс отримати унікальний задає об'єкт-носій (бос, скриня, квест) — модель `UniqueDropRule { uniqueKey; chance }` оголошується тут, використовується в плані здобичі.
- Навички — реєстр `SkillKey` із заглушками; базові токени отримують `[]`.

## 10. Архітектура (ООП, SOLID)

```
TokenFactory (фасад)
 ├─ createBase(ctx: GenerationContext): ItemToken
 └─ createUnique(def, ctx): ItemToken
    залежності через конструктор (інтерфейси):
    INameGenerator        → WordPoolNameGenerator
    ISpriteResolver       → ManifestSpriteResolver
    IAttributeGenerator   → WeightedAttributeGenerator
    ISkillGenerator       → EmptySkillGenerator (null object)
    IPriceGenerator       → RangePriceGenerator
    IDescriptionBuilder   → SpecSheetDescriptionBuilder
    ITokenValidator       → ZodTokenValidator
    реєстри (лише дані): TypeRegistry, AttributeRegistry, WordPool, SpriteManifest, SkillRegistry, UniqueRegistry
GenerationContext { realm, mapTier, type?, rng, heroGrade? }
```

- **S:** кожен генератор робить одне. **O:** новий тип / атрибут / слово / мова / спрайт — дані, не код. **L:** будь-яка реалізація інтерфейсу підставляється в тестах. **I:** малі інтерфейси по одному методу. **D:** фабрика знає лише інтерфейси.
- Випадковість лише з переданого сідованого RNG, окремий потік на кожен генератор (`token:<id>:name`, `:attr`, `:sprite`, `:price`). `Math.random` заборонено.
- Генератори без змінного стану; на виході простий серіалізований об'єкт, який проходить Zod.
- Код живе в `packages/engine`; web лише рендерить токен; сервер створює токени.

## 11. Тести й приймання

| ID    | Перевірка                                                                                                                        | Рівень            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| TG-1  | 500 ітерацій (сіди 1–500, змішані світ × рівень × тип): кожен токен проходить Zod                                                | engine Vitest     |
| TG-2  | У кожному з 500: 0–2 атрибути без повторів, лише `implemented`, значення = `valueByTier`                                         | engine Vitest     |
| TG-3  | Спрайт є в маніфесті або це placeholder; світло відповідає §2                                                                    | engine Vitest     |
| TG-4  | Назва й опис рендеряться непорожніми в en і uk; усі ключі i18n існують                                                           | engine/web Vitest |
| TG-5  | Ціна в діапазоні рідкості; `skills` порожні; `ext` за замовчуванням                                                              | engine Vitest     |
| TG-6  | Детермінізм: той самий сід і контекст → глибоко рівний токен                                                                     | engine Vitest     |
| TG-7  | Різноманіття: у 500 змішаних — ≥ 90% різних назв і жодна не трапляється > 3 разів; у 500 для однієї пари світ+тип — ≥ 75% різних | engine Vitest     |
| TG-8  | Контент: префікси × суфікси ≥ 1 000 на кожну пару світ+тип                                                                       | content test      |
| TG-9  | Розширення: фікстура додає тип, атрибут, слово, мову й спрайт — фабрика працює без змін коду                                     | engine Vitest     |
| TG-10 | Спрайти: кожен файл відповідає шаблону й розміру; маніфест = теки                                                                | web/script test   |
| TG-11 | Унікальний: фіксовані поля збігаються з визначенням; `rolled` дотримується TG-2; другий той самий для героя недоступний          | engine Vitest     |
| TG-12 | Збережений токен після перезавантаження має ту саму назву, спрайт, атрибути                                                      | API інтеграція    |

Додатково: `pnpm tokens:sample` друкує 20 токенів en/uk для перевірки очима.

## 12. Фази

| Фаза                                       | Що                                                                                                                                                                                                                                                                                 | Межі                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| **LG0 — Звірка**                           | дані з коду для §13; заповнити «Результати LG0»                                                                                                                                                                                                                                    | без змін коду       |
| **LG1 — Схема й дані** [DONE — 2026-11-17] | Zod `ItemToken`, реєстри, рідкість/світло, словник en/uk, ціни, атрибути з `implemented`; TG-8                                                                                                                                                                                     | engine, нові файли  |
| **LG2 — Спрайти** [DONE — 2026-11-17]      | нова структура тек, перенос наявних спрайтів, скрипт маніфесту, placeholder; TG-10                                                                                                                                                                                                 | web assets + script |
| **LG3 — Фабрика** [DONE — 2026-11-17]      | класи §10, `createBase`; TG-1…TG-7, TG-9                                                                                                                                                                                                                                           | engine              |
| **LG4 — Унікальні** [DONE — 2026-11-17]    | `UniqueTokenDefinition`, `createUnique`, `ownedUniques`, `UniqueDropRule`, 1 приклад; TG-11                                                                                                                                                                                        | engine + контент    |
| **LG5 — Заміна**                           | видалити ручне спорядження; усі місця, що створюють предмет, викликають фабрику; рендер назви, опису, світла, спрайта з токена; збереження токенів; підняття `CONTENT_VERSION` (дозволено Олегом 2026-11-17 — старі предмети переробляються); TG-12; e2e лише зачеплених сценаріїв | engine + api + web  |

Поза планом: таблиці здобичі й шанси, відсоток торговця, ефекти атрибутів у бою, аспекти, ступінь героя.

## 13. LG0 — що з'ясувати

A. Нинішня модель предмета: типи, Zod-схема, де оголошене кожне ручне спорядження (меч, щит, сокира, кайло, рука) і всі посилання на їхні ключі.
B. Чи має предмет у сумці власні дані чи лише ключ прототипу; що зберігається в агрегаті `inventory`.
C. Рідкість: стан R1/R3, `IItemRarity`, `rarityTone`, файли світла (які є, яких бракує для §2).
D. Наявні спрайти предметів: шляхи, розміри, формат; як ключ спрайта зіставляється з файлом.
E. RNG: API, приклад потоку, де береться сід на сервері.
F. Атрибути: які з §5 реально читають герой і бій (серця, щит, сила, маса, Воля, туман, сумка) — для `implemented`; де береться сила удару предмета.
G. Навички: реєстр, ключі; чи можна прив'язати навичку до предмета.
H. Інструменти: як зараз сокира й кайло рубають / видобувають і як це прив'язано до ключа предмета.
I. i18n: структура локалей, де назви предметів, як рендерити шаблон.
J. Ціни: де ціна предмета, хто її читає.
K. Усі місця, де створюється предмет (скриня, могила, квест, магазин, стартові дані, dev-панель).
L. Стиль engine: класи чи функції; чи не суперечить ООП-фабрика правилам скіла `hexoflat-engine`.
M. Версії: `CONTENT_VERSION`, наслідки підняття.
N. Конфлікти з цим планом і питання до Олега.

## 14. Рішення після LG0 (2026-11-17) — мають пріоритет над §1–§13

| #   | Тема                  | Рішення                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Зберігання            | Клітинка контейнера — union `ItemTokenEntry` з двома гілками: `{ kind: 'stack', itemKey, amount }` (нинішня форма) для монет, зілля, ресурсів, сувоїв і `{ kind: 'token', token: ItemToken }` для спорядження. Токен зберігається повністю, як value object. Окремої таблиці чи реєстру токенів немає, посилань `tokenId` немає (відповідь на N-5). Гексоб'єкт на карті з токеном несе токен і не відновлюється з прототипу. Схема гілки `token` — strict. |
| D2  | Id токена             | `ItemTokenId = <sourceId>:<n>`. `sourceId` — id джерела (скриня, могила, квест, слот торговця). `n` — номер предмета в кидку. Потоки RNG: `token:<sourceId>:<n>:<step>`. Id не змінюється, коли предмет переходить у сумку.                                                                                                                                                                                                                                |
| D3  | Інструменти           | Рубка й видобуток перевіряють `type.tool.action`, а не ключ предмета. Значення — наявні `EHexActionType.CUT` / `EHexActionType.MINE`. Зміна — у LG5, після характеризаційних тестів (`action-starters-registry.ts:75-79, 129`).                                                                                                                                                                                                                            |
| D4  | Ціна                  | Токен: `token.price`. Стос: `coinPriceOf(key)`, як зараз. Одна функція `priceOf(entry)` обирає джерело. Діапазони: `gloom` [60, 800], `idol` [40, 600], `spark` [100, 1200]. `idol` містить нинішню ціну меча (500), тож економічні тести зберігають мету. `god-executor` діапазону не має: це лише унікальні предмети з ручною ціною. Інваріант «продаж < купівля» лишається. Якщо R-Q-12 ламається в LG5 — зупинитись і спитати Олега.                   |
| D5  | Версія                | Стирання збережень не потрібне. LG5 додає upcaster `inventory` v1 → v2: старі ключі спорядження стають `idol` base-токенами того ж типу (детерміновано з `heroId` + слот). Застаріла карта замінюється свіжою замість помилки (`world.service.ts:117`).                                                                                                                                                                                                    |
| D6  | Одиниці               | Усі серця й удари — цілі числа в пів-серцях. Меч 2 (каталог `power`), рука 1 (`unarmedPower`). Щит, сокира, кайло — 1, як рука. Щит: `block.sides` = 2 (`shieldCapacity`). Тест: `type.strike` = значення каталогу. Бій і далі читає каталог; перехід бою на тип — поза цим планом.                                                                                                                                                                        |
| D7  | Слот                  | `slot: 'weapon' \| 'shield'`, як у коді.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D8  | Атрибути              | Значення — цілі пів-серця. `heart: { 1: 1, 2: 1, 3: 2, 4: 2 }`. Читач максимуму сердець перестає округлювати вниз (LG5, з тестом). Лише `heart` має `implemented: true`.                                                                                                                                                                                                                                                                                   |
| D9  | Заглушки              | Свідомий виняток із правила `hexoflat-engine` («schema only when a near-term consumer exists»): Олег прямо вимагає заглушки. Лишаються `ext.aspects: []`, `ext.heroGrade: null` і 6 атрибутів з `implemented: false` у контенті. Прибрано: `durability`, `setKey`, `sockets`.                                                                                                                                                                              |
| D10 | Межі LG1              | LG1 може змінювати `locales/*/content.json`, `locale-keys.ts`, а також `validate-content.ts` і `index.ts` — лише щоб зареєструвати й експортувати нові схеми та контент.                                                                                                                                                                                                                                                                                   |
| D11 | Рівень мапи           | `mapTier` = `tier` дошки, 1–4. Дошка без `tier` = 1. `SkillKey` → наявний `SkillId`. Усі 7 світел є. Шаблон перевірки спрайтів: 512×512 PNG RGBA.                                                                                                                                                                                                                                                                                                          |
| D12 | Назви                 | `god-executor`, `ERarityKind`. Шлях плану: `docs/architecture/loot-generator-plan.md`.                                                                                                                                                                                                                                                                                                                                                                     |
| D13 | Назви інструментів    | Предмет-інструмент (`type.tool !== null`: сокира, кайло, у майбутньому молот) має сталу назву — лише назву типу, без префікса й суфікса: `name: { kind: 'noun', noun: type }`. Правило читає `hasGeneratedName(type)` (за полем `tool`, не за ключем). TG-8 (≥ 1 000 назв) стосується лише типів з генерованою назвою. Атрибути, ціна й спрайт інструмента генеруються як звичайно. Рішення Олега 2026-11-17.                                              |
| D14 | Ключ спрайта          | Скрізь без `.png`: токен зберігає ключ маніфесту (`idol-sword-01`), шлях до файлу дає маніфест. `spriteKeySchema` і `sampleToken` виправляє LG3. Рішення Олега 2026-11-17.                                                                                                                                                                                                                                                                                 |
| D15 | Спрайти унікальних    | Пошук спрайта унікального токена за `uniqueKey` робить LG4; до того `spritesFor('unique', …)` повертає placeholder. Рішення Олега 2026-11-17.                                                                                                                                                                                                                                                                                                              |
| D16 | tsx                   | `tsx` для `pnpm tokens:manifest` оголосити явно в `apps/web/package.json` з версією, що вже є в lockfile (зараз приходить через peer `vite`). Не нова залежність; перший крок LG3. Рішення Олега 2026-11-17.                                                                                                                                                                                                                                               |
| D17 | Запас назв            | Перший крок LG4: 48 префіксів і 48 суфіксів (2 304 назви на пару світ+тип; ≈ 90% різних на одну пару, ≈ 95% у змішаному наборі TG-7). Нові слова оригінальні, з текстами en/uk, теми за потреби. Рішення Олега 2026-11-17.                                                                                                                                                                                                                                 |
| D18 | Одиниці атрибутів     | `unit: 'half-heart'` лише в `heart`. `force` і `mass` (правило поштовху) — цілі очки; `shield` — кількість сторін; `will` — очки; `fog` — гекси; `bag` — кг. Решта атрибутів лишаються без `unit` (= очки). Рішення Олега 2026-11-17.                                                                                                                                                                                                                      |
| D19 | Зважений вибір        | Три копії (`loot/roll-loot.ts`, `trade/roll-goods.ts`, `utils/weighted-pick.ts`) звести в одну окремим коротким завданням після LG5, з характеризаційними тестами здобичі й торгівлі. У цьому плані не чіпати. Рішення Олега 2026-11-17.                                                                                                                                                                                                                   |
| D20 | Спрайти Gloom і Spark | Малює Олег. До того fallback бере спрайти Idol того ж типу; це не помилка. Рішення Олега 2026-11-17.                                                                                                                                                                                                                                                                                                                                                       |

## Результати LG0

Виконано 2026-11-17 на гілці `tokens-generator-component`, без змін коду. Шляхи engine — відносно `packages/engine/src/`, web — відносно `apps/web/src/`, api — відносно `apps/api/src/`, якщо не сказано інше. Документи: `docs/RARITY-REALMS-PLAN.md` (R1, R3 прочитано), `docs/loot-plan.md` («Результати L0» прочитано), `docs/features/` — **missing** (каталогу немає), `docs/architecture/domain-model-plan.md` — **missing**.

### A. Модель предмета зараз

- Предмет = **гексобʼєкт-прототип за ключем**. Ключі: `HEXOBJECT_KEYS` (engine `registry/hexobjects-registry.ts:1`; `AXE` :14, `HAND` :15, `PICKAXE` :16, `SWORD` :17, `SHIELD` :18). Тип прототипу: `THexobjectPrototype` (engine `abstraction/hexobject-abstraction.ts:142-155`), групи `EHexobjectGroup` (:169-176).
- Zod: `ContentDefinitionSchema` — discriminated union за `groupType` (engine `content/content-schema.ts:233-240`); інструмент `toolSchema` (:146-164), спорядження `equipmentSchema` (:180-194) + `weaponSchema` (:173-178), лут `lootSchema` (:115-126), рідкість `raritySchema` (:110-113), `coinPrice` (:93), `equip.slot` (:87).
- Реєстрація: `CONTENT` = злиття шести словників, `satisfies Record<THexobjectKey, TContentDefinition>` (engine `content/content-map.ts:11-18`). Доступ: `getPrototype` кидає `Unknown Hexobject key` (engine `content/content-accessors.ts:9-11`).
- Ручні визначення:
  - меч `sword`: engine `content/equipment.content.ts:17-41` (`title: 'Guard Sword'`, `coinPrice: 500`, `weapon.damageMin/Max 1`, `radius 1`, `equip.slot: 'weapon'`, вага 1.8);
  - щит `shield`: `content/equipment.content.ts:43-64` (`shields: 1`, `hearts: 1`, `defense 2.4`, `equip.slot: 'shield'`, `coinPrice 40`);
  - сокира `axe`: `content/tools.content.ts:9-28` (`canCut`, `canAttack`, `coinPrice 60`);
  - кайло `pickaxe`: `content/tools.content.ts:30-49` (`canMine`, `canAttack`, `coinPrice 60`);
  - рука `hand`: `content/tools.content.ts:51-77` (без `coinPrice`, вага 0, усі `can*`).
- Посилання на ключі — таблиця «Крок 3» нижче.

### B. Що лежить у сумці і в агрегаті `inventory`

- Предмет у сумці — **лише ключ + кількість**, власних даних немає: `inventoryItemSchema = { id, key, type, stackKey?, amount }` (engine `inventory/inventory-state.ts:14-20`); `key` мусить бути з `HEXOBJECT_KEYS` (:12, :16).
- Агрегат: `{ heroId, revision, capacityKg, bag[53], equip{8 слотів}, stash{chests, cells[210]}, idSeq }` (engine `inventory/inventory-state.ts:38-56`). Обидві схеми — звичайний `z.object` без `.strict()`: **невідомі поля мовчки відкидаються** під час parse (:14, :38).
- Ідентифікатор народжується лише при вході в інвентар: `nextItemId` = `<heroId>:<idSeq>` (:67-69), `mintItem` (:71).
- Збереження: таблиця `hero_aggregates` (`kind`, `revision`, `schema_version`, `content_version`, `state jsonb`, `server_state`) (api `db/schema.ts:102-116`); визначення агрегату `inventory` `schemaVersion: 1`, `upcasters: {}` (engine `aggregates/registry.ts:29-33`).
- Поза сумкою предмет теж лише ключ: гексобʼєкт на карті відновлюється з прототипу + вибрані поля (engine `map/models/hex-map-model.ts:297`, для спорядження лише `damageMin/Max`, `durability` :325-334); вміст контейнера `LootDrop { itemKey, amount }` (engine `containers/create-container.ts:20`); предмети поля бою `itemKey` (engine `battle/battle-state.ts:121`); земля квесту `itemKey` (engine `quests/quest-state.ts:19`, :26); товари й викуп торговця `key` (engine `trade/trade-state.ts:7`, :18); власні лоти `key` (engine `trade/listing-state.ts:9`); нагороди квестів `itemKey` (engine `quests/quest-definition.ts:12`, :28); журнал `item_ledger.item_key` + `balance_after` за ключем, `item_instance_id uuid` (api `db/schema.ts:171-188`; заповнюється без instance id, api `player/item-ledger.ts:28-55`).

### C. Рідкість (R1/R3)

- R1 зроблено: `ERarityKind { GLOOM='gloom', IDOL='idol', SPARK='spark', GOD_EXECUTOR='god-executor' }` і `IItemRarity { kind, boss }` (engine `abstraction/hexobject-abstraction.ts:178-188`); поле `rarity?` на `ILoot` (:69), `ITool` (:96), `IEquipment` (:132); Zod `raritySchema` (engine `content/content-schema.ts:110-113`).
- `DEFAULT_RARITY = idol/false`, `TRarityTone` (7 тонів `gloom|gloom-boss|idol|idol-boss|spark|spark-boss|god-executor`), `RARITY_TONES`, `rarityTone()` (engine `content/rarity-rules.ts:3-22`).
- R3 зроблено: `RARITY_FRAME_URLS` і `RARITY_COLOR` за тоном (web `render/rarity.ts:13-31`), `getObjectRarity` (:40-48), `getObjectRarityTone` (:50-54), `rarityFrameUrlForKey(key)` (:56-59). Читачі: web `render/layers/tiles-layer.ts:104`, `inventory-scene/components/inventory-token.vue:83`, `hero-equip-board.vue:141`, `map-scene/components/stash/stash-item-token.vue:41`, `stash/stash-cell.vue:58`, `shop/shop-trade-cell.vue:121`, `composables/use-hero-details.ts:143`, `services/hex-info/build-hex-info.ts:316`, :335; engine `utils/inventory/item-tooltip.ts:88-97` (`rarityOf`).
- Файли світла: див. D. **Для §2 не бракує жодного**: потрібні 7 (`blue`, `violet`, `gray`, `green`, `yellow`, `orange`, `red`) — усі 7 є.

### D. Спрайти предметів і світла

Ключ → файл: поле `spritePath` прототипу (повний URL від `public/`); інвентар бере його через `resolveInventoryView(key).iconPath` (engine `utils/inventory/traits-resolver.ts:28`, :130), карта — `tile.hexobject.spritePath` (web `render/layers/tiles-layer.ts:162-169`), бойові руки — `getPrototype(toolKey).spritePath` (web `render/layers/battle-fx-layer.ts:84`, `battle/battle-creature-row.vue:86`). Окремого «ключа спрайта» немає.

| Предмет / світло          | Шлях (від `apps/web/public/`)                                            | Розмір, формат      | Оголошено                                     |
| ------------------------- | ------------------------------------------------------------------------ | ------------------- | --------------------------------------------- |
| sword                     | `hex-assets/hex-loot/sword-hex.png`                                      | 512×512 PNG RGBA    | engine `content/equipment.content.ts:26`      |
| shield                    | `hex-assets/hex-equipment/hex-weapons/hex-shield/shield-token-image.png` | 512×512 PNG RGBA    | engine `content/equipment.content.ts:52`      |
| axe                       | `hex-assets/hex-loot/axe-token.png`                                      | 512×512 PNG RGBA    | engine `content/tools.content.ts:19`          |
| pickaxe                   | `hex-assets/hex-tools/pickaxe-token-image.png`                           | 512×512 PNG RGBA    | engine `content/tools.content.ts:40`          |
| hand                      | `hex-assets/hex-tools/hand-hex.png`                                      | 512×512 PNG RGBA    | engine `content/tools.content.ts:59`          |
| coins                     | `hex-assets/hex-loot/coins-hex.png`                                      | 512×512 PNG         | engine `content/loot.content.ts` (spritePath) |
| health/energy/mana bottle | `hex-assets/hex-loot/{health,energy,mana}-bottle-token-image.png`        | 512×512 PNG         | engine `content/loot.content.ts`              |
| return-scroll             | `hex-assets/hex-loot/teleport-scroll-token.png`                          | 512×512 PNG         | engine `content/loot.content.ts`              |
| bone-charm                | `hex-assets/hex-loot/bone-charm-token.svg`                               | SVG viewBox 256×256 | engine `content/loot.content.ts`              |
| crown-shard               | `enemy-assets/boss-hex-images/emitter-token-image.png` (плейсхолдер)     | 1000×1000 PNG       | engine `content/loot.content.ts:160-161`      |
| (не використовується)     | `hex-assets/hex-equipment/hex-weapons/hex-sword/guard-sword-token.png`   | 1000×1000 PNG       | ніде (grep `guard-sword-token` — 0)           |
| (не використовується)     | `hex-assets/hex-tools/equipment-placeholder-hex.png`                     | 1226×1283 PNG       | ніде (grep `equipment-placeholder-hex` — 0)   |
| blue-light                | `hex-assets/hex-frames/blue-light.png`                                   | 512×512 PNG RGBA    | web `render/rarity.ts:14`                     |
| violet-light              | `hex-assets/hex-frames/violet-light.png`                                 | 512×512 PNG RGBA    | web `render/rarity.ts:15`                     |
| gray-light                | `hex-assets/hex-frames/gray-light.png`                                   | 512×512 PNG RGBA    | web `render/rarity.ts:16`                     |
| green-light               | `hex-assets/hex-frames/green-light.png`                                  | 512×512 PNG RGBA    | web `render/rarity.ts:17`                     |
| yellow-light              | `hex-assets/hex-frames/yellow-light.png`                                 | 512×512 PNG RGBA    | web `render/rarity.ts:18`                     |
| orange-light              | `hex-assets/hex-frames/orange-light.png`                                 | 512×512 PNG RGBA    | web `render/rarity.ts:19`                     |
| red-light                 | `hex-assets/hex-frames/red-light.png`                                    | 512×512 PNG RGBA    | web `render/rarity.ts:20`                     |

Висновок для §7: розмір спрайта предмета = **512×512 PNG RGBA** (усі чотири типи плану). Відсутніх світел для §2: **немає**. Теки `hex-assets/items/` немає.

### E. RNG

- Тип: `RandomNumberGenerator = () => number` у `[0,1)` (engine `utils/random.ts:12`); `pickRandom(items, random)` (:24).
- Сідований: `createSeededRandom(initial: RngState): SeededRandom` (engine `utils/random-seeded.ts:14`), `deriveStream(seed: string, label: string): SeededRandom` (:27-29, SHA-256 від `seed:label`, лічильник з 0).
- Приклад для копіювання (два незалежні потоки з одного сіда): `trade/trader-view.ts:24-25` — `rollGoods(def, deriveStream(rngSeed, label))` і `applyDiscounts(def, goods, deriveStream(rngSeed, \`${label}:deals\`))`. Для здобичі: `loot/roll-for.ts:15` (`deriveStream(source.seed, lootStreamLabel(sourceId, targetKey))`, мітка `loot:<sourceId>:<targetKey>`—`loot/roll-loot.ts:4-6`), викликається при створенні контейнера `containers/create-container.ts:20`.
- Сіди на сервері: експедиція `randomBytes(16)` (api `expedition/expedition-store.ts:43`) → `worldSeed = <expeditionSeed>:<mapId>` (engine `world/server-world.ts:92`); `progress.server_state.rngSeed` (api `player/aggregate-store.ts:42`, читає `player/player-command.service.ts:91-93`); квест — `<seed>:quest:<uuid>` (api `quests/quest-run.service.ts:218`).

### F. Атрибути (див. таблицю «Крок 5»)

Сила удару зараз: `power` бойового предмета в `BATTLE_ITEMS` (engine `battle/battle-catalogue.ts:67-80`; меч `power: 2`, :68), порожня рука `unarmedPower: 1` (engine `battle/battle-content.ts:40`), вибір предмета в руці `strikingItem` (engine `battle/strike.ts:90-98`), сума `strikePower` (:101-109). Гексобʼєкт → бойовий предмет лише через `BATTLE_ITEM_BY_HEXOBJECT` (`sword`→`sword`, `shield`→`wooden-shield`, `health-bottle`→`health-potion`, engine `battle/battle-catalogue.ts:135-139`); сокира й кайло там відсутні → у бою це порожня рука. `weapon.damageMin/Max` і `tool.attackMultiplier` читає лише підказка (engine `utils/inventory/item-tooltip.ts:103`, :112-113).

### G. Навички

- Реєстр навичок героя: `SKILL_IDS` (24 вузли дерева, engine `skills/skill-content.ts:5-30`), `SkillId` (:33), `skillDefinitionSchema` з `implemented` (:51-75), ефекти `none | stat(attack|defense) | portal` (:37-48), `SKILLS` (:154).
- Привʼязки навички до предмета **немає**: жодне поле контенту предмета не посилається на `SkillId` (grep `SkillId` у `content/*.content.ts` — 0). Підказка лише показує ціну Волі за навичкою (`TooltipWillUse.skillId`, engine `utils/inventory/item-tooltip.ts:50`).

### H. Інструменти

- CUT: стартер бере `requiredTool` з дії ресурсу, типово `AXE` (engine `registry/action-starters-registry.ts:75`), відмовляє, якщо **ключ** активного інструмента ≠ `requiredTool` (:79), потім перевіряє `canCut` (:83-84). Ресурс дерева задає `requiredTool: HEXOBJECT_KEYS.AXE` (engine `content/resources.content.ts:26`).
- MINE: те саме з `PICKAXE` (engine `registry/action-starters-registry.ts:129`; `content/resources.content.ts:49`, :74).
- Меню дій: `getToolCapabilities(toolKey)` (engine `game-resolvers/interactions-resolver.ts:35`), CUT при `cap.canCut` (:97), MINE при `cap.canMine` (:113), USE/OPEN порівнюють `requiredTool === toolKey` (:162, :174).
- Тип ключа інструмента: `THeroToolKey` (engine `content/equipment.content.ts:8-14`), `TToolKeys` (`content/tools.content.ts:5-6`), `HeroToolType` (engine `enums/hero-tool-type.ts`).
- Знос: клієнтська підказка `client.tool.durability` (engine `world/server-ports.ts:27`, :44, :60-62).
- Отже прив'язка «рубка ↔ предмет» = **рівність ключа `axe`/`pickaxe`**, а не тип чи здатність.

### I. i18n

- Локалі: `apps/web/src/locales/{en,uk}/content.json` (корінь `content`) і `ui.json`; vue-i18n `createI18n` (web `i18n/index.ts:1`).
- Назви меча/щита/сокири/кайла/руки — **літеральні англійські рядки** в контенті (`'Guard Sword'` engine `content/equipment.content.ts:21`, `'Axe'` `content/tools.content.ts:13`); ключів `content.sword.*` немає (у `content.json` є лише `content.battle.sword` для бою, en `content.json:61`). Колекція ключів бере лише поля з префіксом `content.` (web `i18n/locale-keys.ts:35-49`). Компоненти показують `te(title) ? t(title) : title` (web `stash/stash-cell.vue:64`, `shop/shop-trade-cell.vue:128`, `composables/use-shop-card.ts:52`, `composables/shop-messages.ts:87`).
- Тести, що зачеплять словник LG1: `i18n/content-locale-completeness.test.ts`, `locale-orphaned-keys.test.ts`, `locale-placeholder-consistency.test.ts` (однакові плейсхолдери en/uk — шаблон `{prefix} {noun} {suffix}` проти `{noun} {prefix} {suffix}` його проходить, бо набір той самий), `pseudo-locale.test.ts`.
- Шаблон назви рендериться як звичайний іменований ICU-плейсхолдер vue-i18n (той самий механізм, що `quest.<id>.rule` з параметрами, див. CLAUDE.md «Quest details card»).

### J. Ціни

- Поле: `coinPrice` (int > 0) у контенті (engine `content/content-schema.ts:93`), читання лише `coinPriceOf(key)` (engine `content/content-accessors.ts:96-100`).
- Хто читає: engine `trade/trader-view.ts:45-47` (`sellUnitPrice`), `trade/plan-buy.ts:77`, `trade/plan-listing.ts:42`, `trade/plan-deal.ts:43`, `trade/discount-math.ts:10`, `trade/trader-fixture.ts:34`, `content/validate-content.ts:62`, `content/validate-loot.ts:100`; web `services/trade/trade-preview.ts:45`, `shop/shop-board-trade-kit.ts:41-42`.
- Тести, що пришпилюють ціни за ключем: engine `content/coin-price.test.ts` (таблиця, кратність 20), `content/loot-economy.test.ts` (`LOOT_ECONOMY_TARGET.gearKey = SWORD`, engine `content/loot-tables.content.ts:19-24`), квестовий інваріант R-Q-12 через `sellUnitPrice` (engine `quests/quests.content.ts:107`, `questContentFailures`).

### K. Усі місця, де предмет створюється

| Місце                                          | Файл:рядок                                                                                                                                                                                                                                                                 | Як                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Вхід в інвентар (будь-який)                    | engine `inventory/inventory-state.ts:71` (`mintItem`), `inventory/apply-stock.ts:76` (`grantToDraft`), `inventory/plan-stock.ts:49` (`planGrant`)                                                                                                                          | ключ + кількість              |
| Перша скриня кемпу                             | engine `aggregates/claim-camp-chest.ts:36-38`, список `CAMP_CHEST_ITEMS` = sword, axe, shield, pickaxe (`inventory/stash-constants.ts:17-22`)                                                                                                                              | `mintItem(seq, key, 1)`       |
| Підбір TAKE                                    | engine `registry/action-finishers-registry.ts:108`                                                                                                                                                                                                                         | `grantToDraft(..., 'pickup')` |
| Скриня світу (вміст)                           | engine `containers/create-container.ts:20`, розкладання `chests/world-container-space.ts:76` (`HexObjectFactory.create`), у сумку `loot/apply-spread.ts:18`                                                                                                                | `LootDrop.itemKey`            |
| Могила (вміст, бій)                            | engine `containers/create-container.ts:20` (через `enterCollectPhase`), предмети на полі `battle/battle-state.ts:121`, підбір `loot/pickup-stack.ts:23`                                                                                                                    | `itemKey`                     |
| Скриня квесту                                  | engine `containers/create-container.ts:20` (через `seekerStep`), земля `quests/quest-state.ts:19-26`, підбір `loot/pickup-stack.ts:23`                                                                                                                                     | `itemKey`                     |
| Нагорода квесту                                | engine `quests/quest-log.ts:163`, зміст `quests/quests.content.ts:26` (axe ×5), :84 (shield)                                                                                                                                                                               | `grantToDraft(..., 'reward')` |
| Магазин: купівля, продаж (монети), зняття лоту | engine `trade/plan-buy.ts:42`, `trade/plan-sell.ts:41`, `trade/plan-listing.ts:71-72`, `trade/coin-purse.ts:16-17` (`freshPiece` → `mintItem`); товари `trade/trader-view.ts:24` (`rollGoods`), пул `content/traders.content.ts:20-23`                                     | ключ                          |
| Руки в бою (`set-hands`)                       | engine `world/battle-hands-sync.ts:31`                                                                                                                                                                                                                                     | `mintItem(inventory, key, 1)` |
| Статична карта (легасі)                        | engine `map/providers/map-tiles-schema-provider.ts:51-63` (`campingMapConfig`, axe/sword/pickaxe/shield), користувач `map/providers/hex-map-provider.ts:30` → api `game/scenario-state.service.ts:12`                                                                      | гексобʼєкт                    |
| e2e / dev фікстури                             | engine `world/world-fixtures.ts:49`; web `e2e/inventory-hooks.ts:5-9` (`grantInventoryItem`); web `services/inventory/inventory-sync.ts:193` (`DEV_GRANT_ITEM`); api `player/player-command.service.ts:324` (`grantItemServerSide`)                                        | ключ                          |
| Dev-панель                                     | web `components/overlays/settings-overlay.vue:117-120` (+500 coins); web `map-scene/components/static-board-editor-panel.vue:145` (усі `HEXOBJECT_KEYS` для редактора дошки); api `player/admin-tools.ts:15-27` (`SEED_PRESETS` sword/axe/shield/pickaxe, CLI `seed-hero`) | ключ                          |

### L. Стиль engine і ООП-фабрика

- Класи в engine є (17 файлів, напр. `HexObjectFactory` `factory/hex-object-factory.ts:16`, `HeroModel` `models/hero-model.ts:14`, `MapRegistry` `registry/world-map-registry.ts:67`); **ін'єкція через конструктор уже є**: `WorldGenerator` `constructor(private readonly generator: IWorldGenerator)` (`generators/world-generator.ts:10-11`). Більшість нових правил (trade, loot, quests, containers, battle) — чисті функції.
- Прямої заборони класів у скілі `hexoflat-engine` немає. Обмеження, які §10 мусить виконати (цитати): «**Pure functions for the actual rules**, in a domain folder … The `apply-command.ts` case should orchestrate, not compute.»; чекліст «Rules are pure functions; `apply-command.ts` only orchestrates»; «Never widen a rule's signature to call `Math.random()` internally … pass the generator in.» Класи без змінного стану з RNG у `GenerationContext` (§10) з цим **сумісні**.
- **Конфлікт є з іншим правилом того ж скіла** (див. N-9): «Write a schema only when a near-term consumer exists. A schema nobody reads is an unverified guess frozen into code.» і скіл `hexoflat-phase`: «**Refactoring with no consumer.** Reshaping code (or writing a schema) with no near-term user is speculative design.» Під нього потрапляють `TokenExtensions` (усі поля null/[]), `ISkillGenerator`/`SkillRegistry`-заглушки та атрибути з `implemented: false`.

### M. Версії

- `CONTENT_VERSION = 1` (engine `content/content-version.ts:7`).
- Хто перевіряє: документ світу `srv-world:*` — `contentVersion: z.literal(CONTENT_VERSION)` (engine `world/server-world.ts:36`, пише :54); локальний знімок `deserializeState` → `StaleSnapshotError` (engine `commands/snapshot.ts:76-77`); web пише в обслуговану карту (web `services/world/served-world.ts:67`); api `content/content.service.ts:14` (віддає версію).
- Хто лише пише: `hero_aggregates.content_version` (api `player/aggregate-store.ts:40`, :147; колонка `db/schema.ts:111`) — **ніде не читається**.
- Наслідки підняття: (1) кожен збережений `srv-world:*` падає на `serializedWorldSchema.parse`, а `deserializeWorld` викликається без обробки помилки (api `world/world.service.ts:117`, `quests/quest-run.service.ts:73`, `quests/reconcile-quest-world.ts:31`) → 500 на кожну команду світу, поки LG5 не додасть «застаріла карта → свіжа»; (2) агрегати `inventory`/`progress` **не скидаються** (версія не перевіряється) — старі ключі `sword/axe/...` лишаються в сумках, тож перетворення має бути upcaster'ом агрегату `inventory` (`schemaVersion` 1 → 2, engine `aggregates/registry.ts:31-33`) і, для `ownedUniques`, `progress` 9 → 10 (`aggregates/registry.ts:42-63`); (3) документ квесту `srv-quest` і стан бою лежать у тих самих документах і падають разом зі світом; (4) `item_ledger` зберігає `item_key`/`balance_after` за ключем (api `db/schema.ts:171-188`).

### N. Конфлікти з планом і питання до Олега

Не вирішено, лише записано.

1. **Назви рідкості.** План: `godExecutor`, тони `<realm>-base` / `<realm>-unique`; код: `'god-executor'` (engine `abstraction/hexobject-abstraction.ts:182`), тони `gloom`/`gloom-boss`… (`content/rarity-rules.ts:5-6`). У §1–§10 назву значення виправлено на `god-executor`; рішення «base/unique замість boss» лишається, але `IItemRarity.boss` носять і нетокенні предмети (зілля, сувій, монети, амулет, уламок, `content/loot.content.ts`). Питання: що з `boss` у нетокенних предметах?
2. **Одиниці удару.** §3: «сила удару в пів-серцях; рука = 0.5». Код: `unarmedPower: 1` пів-серце (engine `battle/battle-content.ts:40`), меч `power: 2` (`battle/battle-catalogue.ts:68`). У пів-серцях рука = 1, у серцях = 0.5. Питання: яка одиниця?
3. **Сила й щит живуть у бойовому каталозі, а не в предметі.** `BATTLE_ITEM_BY_HEXOBJECT` (engine `battle/battle-catalogue.ts:135-139`); місткість щита в бою `shieldCapacity: 2` (:70) проти `equipment.shields: 1` (`content/equipment.content.ts:57`). Токен має замінити цей мапінг (LG5).
4. **Слот.** §3 `slot: 'hand'`; код має два слоти рук `weapon`/`shield`, меч — лише в `weapon`, щит — лише в `shield`, інструменти — у будь-якій руці (engine `utils/inventory/equip-compatibility.ts:36-41`).
5. **Ідентичність предмета = ключ гексобʼєкта.** Не менше 10 місць перевіряють ключ проти `HEXOBJECT_KEYS` (engine `inventory/inventory-state.ts:12`, `inventory/plan-stock.ts:20`, `inventory/inventory-commands.ts:28`, `aggregates/player-commands.ts:42`, `aggregates/world-player-commands.ts:11`, `world/world-fixtures.ts:11`, `loot/loot-table.ts:4`, `content/content-schema.ts:19-20`, `trade/trade-state.ts:7`, `trade/listing-state.ts:9`). Схеми інвентаря нестрогі → поля токена **мовчки зникнуть** при parse (B). Гексобʼєкт на карті відновлюється з прототипу → токен на землі втратить дані (`map/models/hex-map-model.ts:297`). Питання: токен зберігається повністю в кожній клітинці/стосі чи як посилання `tokenId` на окремий реєстр?
6. **`id` токена і потоки RNG.** §10 потоки `token:<id>:…`, але `id` предмета народжується тільки при вході в сумку (`inventory/inventory-state.ts:67-69`), а вміст контейнера кидається при створенні контейнера, до будь-якого героя (`containers/create-container.ts:20`). `item_instance_id uuid` у журналі не заповнюється. Питання: звідки `ItemTokenId` для токена в скрині/могилі/товарах?
7. **Рубка й видобуток привʼязані до рівності ключа** `axe`/`pickaxe` (engine `registry/action-starters-registry.ts:75-79`, :129; `content/resources.content.ts:26`, :49, :74). §3 `tool: { action }` потребує перевірки за типом/дією.
8. **Половинні серця.** §5 приклад `heart: {1: 0.5, …}`; код: `equipment.hearts` — ціле (engine `content/content-schema.ts:185`), `getHeartPoints` робить `Math.floor` (`combat/heart-points.ts:13`) → 0.5 стане 0.
9. **Схеми без споживача.** `TokenExtensions` (5 заглушок), реєстр навичок-заглушок, 6 атрибутів з `implemented: false` суперечать правилу скіла (L). Питання: лишати їх у LG1 як рішення Олега (тоді записати виняток) чи вводити, коли з'явиться читач?
10. **Назви в контенті — не ключі i18n** (I). Для LG5 треба `nounKey` для типів і ключі назв унікальних; наявні `title` предметів — сирий текст.
11. **Межі LG1.** «engine, нові файли», але словник en/uk живе в наявних web `locales/{en,uk}/content.json` + реєстрація в `i18n/locale-keys.ts`, а перевірка вмісту — у наявному `content/validate-content.ts`. Питання: дозволити LG1 ці три правки?
12. **Ціна токена проти економіки.** Випадкова ціна (§8) ламає ціни за ключем: `coinPriceOf(key)` у торгівлі, знижки «лише цілі монети» (`trade/discount-math.ts:10`), `coin-price.test.ts`, `loot-economy.test.ts` (меч як мета, `content/loot-tables.content.ts:19-24`), R-Q-12. Торговцю (`sellUnitPrice`, `trade/trader-view.ts:45`) потрібна ціна екземпляра.
13. **Рівень мапи.** §1 `mapTier: 1|2|3`; у коді лише параметр моделі печери `params: { tier: [1, 4] }` (engine `content/boards/models/cave.ts:14`), ніхто його не читає (grep `.tier` — 0); у Сілезії й кемпу рівня немає. Питання: звідки `mapTier` і що з діапазоном 1–4?
14. **`SkillKey`.** У коді є лише `SkillId` дерева героя (G). Питання: `SkillKey` — новий реєстр чи підмножина `SkillId`?
15. **`CONTENT_VERSION`** (M): підняття не скидає інвентарі, але валить усі збережені карти (немає обробки помилки). LG5 потребує upcaster `inventory` і шлях «застаріла карта → свіжа».
16. **Документи.** План посилався на `docs/features/…`; реальні шляхи `docs/loot-plan.md`, `docs/RARITY-REALMS-PLAN.md` (виправлено в шапці); `docs/architecture/domain-model-plan.md` не існує. CLAUDE.md називає стартовий список `STARTER_STASH_ITEMS`, у коді `CAMP_CHEST_ITEMS` (`inventory/stash-constants.ts:17`).
17. **Рука — не тип плану.** `hand` лишається ручним інструментом (порожня рука, `NOT_STORABLE` engine `inventory/plan-stock.ts:57`, `requiredTool: HAND` у 14 діях `content/constructions.content.ts`). LG5 не видаляє `hand`.
18. **Легасі.** `campingMapConfig` (engine `map/providers/map-tiles-schema-provider.ts:45-63`) досі ставить меч/щит/сокиру/кайло на мапу кемпу для api `game/scenario-state.service.ts:12`. Питання: видалити разом із LG5 чи залишити?

### Крок 2. Поняття плану → наявний код

| Поняття плану           | Наявні оголошення                                                                                                                                                                                   | Шар          | Розрив                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------- |
| `ItemToken`             | `InventoryStateItem { id, key, type, stackKey?, amount }` (engine `inventory/inventory-state.ts:14-23`); гексобʼєкт `THexobject` (`abstraction/hexobject-abstraction.ts:157-167`)                   | engine       | немає: предмет без власних даних; немає місця для назви, атрибутів, ціни, спрайта, `origin` |
| `ItemTypeDefinition`    | `TContentDefinition` групи `TOOL`/`EQUIPMENT` (engine `content/content-schema.ts:146-194`, :214-231); бойовий `BATTLE_ITEMS` (`battle/battle-catalogue.ts:67-80`)                                   | engine       | розкидано на 2 каталоги; немає `nounKey`, `realms`, `tool.action`; слот = `weapon`/`shield` |
| `AttributeDefinition`   | поля `equipment.hearts`/`shields`/`defense` (engine `content/content-schema.ts:180-194`); `WillCapacityModifier` (`knowledge/math.ts:90-93`)                                                        | engine       | немає реєстру, ваг, `valueByTier`, `implemented`                                            |
| `UniqueTokenDefinition` | немає (grep `unique` у `content/` — 0)                                                                                                                                                              | engine       | повністю нове                                                                               |
| `TokenName`             | `title: string` літерал (engine `content/equipment.content.ts:21`)                                                                                                                                  | engine + web | немає словника слів, шаблонів en/uk                                                         |
| `DescriptionLine`       | `description` літерал (engine `content/equipment.content.ts:23`); рядки підказки `ItemTooltipView` (`utils/inventory/item-tooltip.ts:52-67`)                                                        | engine + web | немає `{ key, params }[]`; підказка будується з прототипу, не з токена                      |
| `SpriteManifest`        | `spritePath` у кожному прототипі (D); списки попереднього завантаження `battleAssetPaths` (web `render/battle/battle-look.ts`), `questLayerAssetPaths` (web `render/layers/quest-numbers-layer.ts`) | engine + web | немає маніфесту, теки `items/`, скрипта збирання, placeholder                               |
| `price`                 | `coinPrice` + `coinPriceOf(key)` (engine `content/content-schema.ts:93`, `content/content-accessors.ts:96-100`)                                                                                     | engine + web | ціна за ключем, не за екземпляром; `priceRange` за рідкістю немає                           |
| `ownedUniques`          | `progress.claimedRewards: string[]` (engine `aggregates/progress-state.ts:34`) — найближчий аналог                                                                                                  | engine + api | поля немає; потрібна версія `progress` 9 → 10 + upcaster                                    |
| `UniqueDropRule`        | `LootTable` з `guaranteed` і зваженими `entries` (engine `loot/loot-table.ts`), `construction.lootTableId` (`content/content-schema.ts:170`)                                                        | engine       | немає поля шансу унікального; таблиці знають лише ключі                                     |

### Крок 3. Ручні предмети: усі посилання на ключ

Метод підрахунку (відтворюваний): `grep -rlE "HEXOBJECT_KEYS\.<KEY>\b|['\"\`]<key>['\"\`]"`по`packages/engine/src apps/api/src apps/web/src apps/playwright/{src,e2e}`; тест = `_.test._|_.spec._|test-setup|test-support|fake-*|web e2e/`. Для `shield`і`hand`літерал збігається також зі слотом руки`'shield'` і бойовою рукою — їхні числа тестів завищені.

| Ключ      | Контент (визначення)                 | Інші посилання engine (prod)                                                                                                                                                                                                                                                                                                                               | Тести engine / web / api (файлів) | api prod                        | web prod                                                                                                                                                                                        | e2e / хуки                                                                                                               | Збереження                                                             | Dev                                           | Що зламається після видалення визначення                                                                                                                                                                                                                       |
| --------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sword`   | `content/equipment.content.ts:17-41` | `battle/battle-catalogue.ts:136`, `content/traders.content.ts:22`, `content/loot-tables.content.ts:20`, :39, :86, `inventory/stash-constants.ts:18`, `map/providers/map-tiles-schema-provider.ts:55`                                                                                                                                                       | 38 / 23 / 3                       | `player/admin-tools.ts:17`, :24 | `composables/hand-tools.ts:12-13`, `render/battle/battle-tool-key.ts:10`                                                                                                                        | playwright `src/config/test-data.ts:30`, `src/config/hero-tool.ts:14`, `src/features/world/quest-run.feature.ts:234-238` | сумки/скриня/руки, земля, контейнери, товари, лоти, журнал (B)         | `admin-tools.ts` SEED_PRESETS, редактор дошки | typecheck `content-map.ts:18` (`satisfies Record<THexobjectKey,…>`); `getPrototype` кидає на кожен збережений меч; `LOOT_ECONOMY_TARGET`, таблиці, пул торговця, стартова скриня, бойовий мапінг, звідси `loot-economy.test`, `coin-price.test`, e2e shop/loot |
| `shield`  | `content/equipment.content.ts:43-64` | `battle/battle-catalogue.ts:137`, `quests/quests.content.ts:84`, `content/traders.content.ts:23`, `content/loot-tables.content.ts:32`, :40, :87, `inventory/stash-constants.ts:20`, `map/providers/map-tiles-schema-provider.ts:63`                                                                                                                        | 20 / 14 / 1                       | `player/admin-tools.ts:19`, :26 | `composables/hand-tools.ts:14-15`, `render/battle/battle-tool-key.ts:9`, `render/battle/battle-look.ts:32` (спрайт щита на дошці бою)                                                           | playwright `src/config/*` (6 файлів e2e містять `'shield'`, частина — слот)                                              | як у меча                                                              | як у меча                                     | те саме + бонус сердець (`aggregates/execute-player-command.ts:72`), спрайт щита в бою, квест-нагорода                                                                                                                                                         |
| `axe`     | `content/tools.content.ts:9-28`      | `registry/action-starters-registry.ts:75`, `content/resources.content.ts:26`, `quests/quests.content.ts:26`, `content/traders.content.ts:20`, `content/loot-tables.content.ts:33`, `inventory/stash-constants.ts:19`, `enums/hero-tool-type.ts:3`, `content/equipment.content.ts:10`, `map/providers/map-tiles-schema-provider.ts:51`                      | 19 / 5 / 1                        | `player/admin-tools.ts:18`, :25 | `composables/hand-tools.ts:8-9`, `components/gui/icons/item-icons.ts:70`                                                                                                                        | playwright `src/config/test-data.ts:25`, `src/config/hero-tool.ts:12`                                                    | як у меча                                                              | як у меча                                     | рубка дерев неможлива (типова вимога `AXE`), квест woodcutter-нагорода, типи `THeroToolKey`/`TToolKeys`                                                                                                                                                        |
| `pickaxe` | `content/tools.content.ts:30-49`     | `registry/action-starters-registry.ts:129`, `content/resources.content.ts:49`, :74, `content/traders.content.ts:21`, `content/loot-tables.content.ts:34`, `inventory/stash-constants.ts:21`, `enums/hero-tool-type.ts:4`, `content/equipment.content.ts:11`, `map/providers/map-tiles-schema-provider.ts:59`                                               | 5 / 0 / 0                         | `player/admin-tools.ts:20`, :27 | `composables/hand-tools.ts:10-11`, `components/gui/icons/item-icons.ts:71`                                                                                                                      | playwright `src/config/test-data.ts:31`, `src/config/hero-tool.ts:13`                                                    | як у меча                                                              | як у меча                                     | видобуток каменю й руди неможливий, типи інструментів                                                                                                                                                                                                          |
| `hand`    | `content/tools.content.ts:51-77`     | `content/constructions.content.ts` (14 дій `requiredTool: HAND`), `registry/action-starters-registry.ts:89`, :143, :193, :210, :238, :306, `registry/action-finishers-registry.ts:141`, `world/server-ports.ts:60`, `world/travel.ts:86`, :98, `quests/world-entrances.ts:123`, `inventory/plan-stock.ts:57`, `utils/inventory/traits-resolver.ts:90`, :96 | 22 / 18 / 3                       | — немає (0 prod-файлів)         | 22 файли, напр. `stores/hero-tool-store.ts:36`, `stores/hero-inventory-store.ts:202`, `a-game-scenes/map-scene/components/tool-hex-tile.vue:117`, `services/inventory/inventory-store-io.ts:70` | 2 файли playwright                                                                                                       | не зберігається (`NOT_STORABLE`); лише `activeTool` у підказці клієнта | немає                                         | майже все: кожна дія рукою; **план не видаляє `hand`** (N-17)                                                                                                                                                                                                  |

### Крок 5. Атрибути §5 → чи читає код

| Атрибут  | Поле в коді зараз                                                                                                                         | Читання кодом                                                                                                                                                                                                     | `implemented`         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `heart`  | `equipment.hearts` (int, engine `content/content-schema.ts:185`)                                                                          | read by code at engine `aggregates/execute-player-command.ts:72` (`sumHeartPoints` → `progress.health.bonus` → бій через `squads/squad-battle.ts:43-44`); також web `composables/use-equipment-health-sync.ts:11` | true (лише цілі, N-8) |
| `shield` | `equipment.shields` (engine `content/content-schema.ts:184`)                                                                              | not read by hero or battle: бій бере `shieldCapacity` з каталогу (`battle/battle-catalogue.ts:70`); поле показують лише web `composables/use-hero-details.ts:190` і engine `utils/inventory/item-tooltip.ts:182`  | false                 |
| `force`  | немає в предметі; `force` істоти бою (engine `battle/battle-catalogue.ts:86-90`, герой `force: 1` :90)                                    | not read from items (бій читає `force` з каталогу, `battle/displacement.ts:50`, `squads/squad-battle.ts:53`)                                                                                                      | false                 |
| `mass`   | немає; `weight` істоти (engine `battle/battle-catalogue.ts:89`), `traits.weightKG` предмета (вага ноші)                                   | not read from items as an attribute (`battle/displacement.ts:50` читає `weight` істоти з каталогу)                                                                                                                | false                 |
| `will`   | немає; гачок `WillCapacityModifier` (engine `knowledge/math.ts:90-93`)                                                                    | not read: `willCapacityOf()` викликається без модифікаторів (engine `knowledge/state.ts:115`)                                                                                                                     | false                 |
| `fog`    | немає                                                                                                                                     | not read: радіус відкриття фіксований (герой + 6 сусідів, engine `map/fog-service.ts:42-52`)                                                                                                                      | false                 |
| `bag`    | немає; `capacityKg` героя (engine `inventory/inventory-state.ts:42`, типово `DEFAULT_CARRY_CAPACITY_KG = 10` `inventory/bag-layout.ts:9`) | not read from items: жоден код не змінює `capacityKg` від спорядження (grep `capacityKg` — лише читання в `trade/*`, `inventory/*`)                                                                               | false                 |

### Крок 8. Розкладка файлів

**LG1 (лише нові файли, engine):**

- `packages/engine/src/tokens/token-schema.ts` — Zod `ItemToken`, `TokenName`, `DescriptionLine`, `TokenExtensions`, гілки ключів (`ItemTypeKey`, `AttributeKey`, `WordKey`, `SpriteKey`, `UniqueKey`, `ItemTokenId`).
- `packages/engine/src/tokens/light-tone.ts` — `lightTone(token)` (§2).
- `packages/engine/src/tokens/index.ts` — публічний вхід.
- `packages/engine/src/content/item-types.content.ts` — `ItemTypeDefinition` (sword, shield, axe, pickaxe).
- `packages/engine/src/content/token-attributes.content.ts` — `AttributeDefinition` з `implemented` за таблицею «Крок 5».
- `packages/engine/src/content/token-words.content.ts` — пули префіксів/суфіксів (ключі, `realms`).
- `packages/engine/src/content/token-prices.content.ts` — `priceRange` за рідкістю.
- `packages/engine/src/content/validate-tokens.ts` — `tokenContentFailures` (TG-8 і схеми).
- `packages/engine/src/content/token-words.test.ts` — TG-8; `packages/engine/src/tokens/token-schema.test.ts`.
- Наявні файли, які LG1 теж потребує (N-11, рішення Олега): web `locales/{en,uk}/content.json` (словник), web `i18n/locale-keys.ts` (реєстрація ключів), engine `content/validate-content.ts` (виклик `tokenContentFailures`), engine `index.ts` (експорт).

**LG2:** нові `apps/web/public/hex-assets/items/base/<realm>-<type>/…`, `items/base/_placeholder.png`, скрипт маніфесту (нове, напр. `apps/web/scripts/build-sprite-manifest.ts`) і згенерований `packages/engine/src/tokens/sprite-manifest.ts`; переносяться `hex-loot/sword-hex.png`, `hex-loot/axe-token.png`, `hex-tools/pickaxe-token-image.png`, `hex-equipment/hex-weapons/hex-shield/shield-token-image.png`; змінюються `spritePath` у engine `content/equipment.content.ts:26`, :52, `content/tools.content.ts:19`, :40 (якщо перенос до LG5), `apps/web/package.json` (скрипт).

**LG3:** нові файли фабрики в `packages/engine/src/tokens/` (класи §10); змінюються engine `index.ts`.

**LG4:** engine `aggregates/progress-state.ts` (`ownedUniques`), `aggregates/registry.ts` (`progress` 9 → 10 + upcaster), нові `content/uniques.content.ts`, `tokens/unique-availability.ts`; `loot/loot-table.ts` (`UniqueDropRule`, якщо в схемі таблиці).

**LG5 (наявні файли):**

- engine: `registry/hexobjects-registry.ts`, `content/content-map.ts`, `content/equipment.content.ts`, `content/tools.content.ts`, `content/resources.content.ts`, `content/loot-tables.content.ts`, `content/traders.content.ts`, `content/content-version.ts`, `content/coin-price.test.ts`, `content/validate-loot.ts`, `content/content-accessors.ts`, `inventory/inventory-state.ts`, `inventory/apply-stock.ts`, `inventory/plan-stock.ts`, `inventory/stash-constants.ts`, `aggregates/registry.ts` (`inventory` 1 → 2), `aggregates/claim-camp-chest.ts`, `aggregates/execute-player-command.ts`, `aggregates/player-commands.ts`, `aggregates/world-player-commands.ts`, `loot/loot-table.ts`, `loot/roll-loot.ts`, `loot/apply-spread.ts`, `loot/pickup-stack.ts`, `containers/create-container.ts`, `chests/world-container-space.ts`, `battle/battle-state.ts`, `battle/battle-catalogue.ts`, `squads/inventory-loadout.ts`, `world/battle-hands-sync.ts`, `world/server-world.ts`, `world/world-fixtures.ts`, `quests/quest-state.ts`, `quests/quest-log.ts`, `quests/quests.content.ts`, `trade/trade-state.ts`, `trade/listing-state.ts`, `trade/trader-view.ts`, `trade/plan-buy.ts`, `trade/plan-sell.ts`, `trade/plan-listing.ts`, `trade/plan-deal.ts`, `trade/discount-math.ts`, `trade/coin-purse.ts`, `combat/heart-points.ts`, `combat/shield-points.ts`, `utils/inventory/item-tooltip.ts`, `utils/inventory/traits-resolver.ts`, `utils/inventory/equip-compatibility.ts`, `registry/action-starters-registry.ts`, `game-resolvers/interactions-resolver.ts`, `map/models/hex-map-model.ts`, `factory/hex-object-factory.ts`, `map/providers/map-tiles-schema-provider.ts` (N-18).
- api: `player/aggregate-store.ts`, `player/item-ledger.ts`, `player/admin-tools.ts`, `player/player-command.service.ts`, `world/world.service.ts` (застаріла карта), `quests/quest-run.service.ts`, `quests/reconcile-quest-world.ts`, `db/schema.ts` (якщо журнал отримає id токена).
- web: `render/rarity.ts`, `render/layers/tiles-layer.ts`, `render/layers/loot-flight-layer.ts`, `render/layers/battle-loot-layer.ts`, `render/layers/quest-numbers-layer.ts`, `render/battle/battle-tool-key.ts`, `render/battle/battle-look.ts`, `a-game-scenes/inventory-scene/components/inventory-token.vue`, `hero-equip-board.vue`, `equip-token.vue`, `token-details-panel.vue`, `a-game-scenes/map-scene/components/stash/stash-item-token.vue`, `stash/stash-cell.vue`, `shop/shop-trade-cell.vue`, `shop/shop-board-trade-kit.ts`, `composables/hand-tools.ts`, `composables/use-hero-details.ts`, `composables/use-equipment-health-sync.ts`, `composables/use-item-tooltip.ts`, `composables/use-shop-card.ts`, `composables/shop-messages.ts`, `components/gui/icons/item-icons.ts`, `services/hex-info/build-hex-info.ts`, `services/inventory/inventory-store-io.ts`, `services/inventory/inventory-aggregate.ts`, `services/trade/trade-preview.ts`, `stores/hero-inventory-store.ts`, `e2e/inventory-hooks.ts`, `i18n/locale-keys.ts`, `locales/{en,uk}/content.json`.
- playwright: `src/config/test-data.ts`, `src/config/hero-tool.ts`, `src/features/world/quest-run.feature.ts`.
- E2E-специфікації, яких стосується (лише назви): `e2e/hero/inventory-drag.spec.ts`, `e2e/hero/item-tooltip.spec.ts`, `e2e/hero/loot-chest.spec.ts`, `e2e/hero/quest-seeker-loot.spec.ts`, `e2e/hero/shop.spec.ts`, `e2e/hero/stash.spec.ts`, `e2e/hero/shield-max-health.spec.ts`, `e2e/hero/hero-board-panel.spec.ts`, `e2e/combat/battle-collect.spec.ts`, `e2e/combat/squad-actions.spec.ts`, `e2e/board/hex-info-tooltip.spec.ts`.

## Журнал

| Дата       | Фаза | Результат                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-14 | —    | v1: план з генеративними й унікальними предметами                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-11-17 | —    | v2: структура токена Олега, рідкість = світ + вид токена, ключі слів, ООП-фабрика, межі = схема об'єктів                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-11-17 | —    | v2.1: атрибут «damage» прибрано; сила удару — лише властивість типу                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-17 | LG0  | звірка з кодом без змін коду: «Результати LG0» A–N, таблиці понять, посилань і атрибутів (лише `heart` реалізовано), розкладка файлів LG1–LG5, 18 конфліктів/питань; назви `RarityRealm`→`ERarityKind`, `godExecutor`→`god-executor`, шляхи документів виправлено                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-11-17 | LG1  | схеми й дані без зміни поведінки: `tokens/` (`token-keys`, `token-schema` з `ItemToken` strict і `ItemTokenEntry` D1, `token-content-schema`, `light-tone` 7 тонів, класи `TypeRegistry`/`AttributeRegistry`/`WordPool`), контент `item-types` (strike 2/1/1/1, щит sides 2, CUT/MINE), `token-attributes` (лише `heart` implemented, рівні 1–4), `token-prices` (D4), `token-words` (38 префіксів + 38 суфіксів, по 2 з тегом кожного світу, 1156 назв на пару світ+тип), `validate-tokens` у `validateContent`; словник `content.tokens.*` en/uk + `tokenLocaleKeys()` у web `locale-keys.ts`; 69 нових тестів engine, TG-8 зелений; lint/typecheck/test зелені, пороги не змінено                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-11-17 | LG1  | D13: назва інструмента стала (`TokenName` kind `noun`, `hasGeneratedName`), TG-8 лише для меча й щита; +4 тести                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-11-17 | LG2  | спрайти без зміни рендера: 4 копії `items/base/idol-{sword,shield,axe,pickaxe}/idol-<type>-01.png` (старі файли й `spritePath` не змінено, рендер читає їх до LG5), `items/base/_placeholder.png` (512×512 RGBA, сіре кільце, Node zlib), `items/unique/.gitkeep`; `pnpm tokens:manifest` (web `scripts/build-sprite-manifest.ts`, tsx) пише `engine/src/tokens/sprite-manifest.ts` (4 записи, чисті дані без parse при імпорті); правила в engine `tokens/sprite-files.ts` (`readPngHeader` з IHDR, `buildSpriteManifest`: NAME_PATTERN, UNKNOWN_REALM, GOD_EXECUTOR_IN_BASE, UNKNOWN_TYPE, WRONG_SIZE, NOT_PNG_RGBA, DUPLICATE_KEY, NO_PLACEHOLDER), `ManifestSpriteRegistry.spritesFor` (світ+тип → тип у будь-якому світі → `_placeholder`); TG-10 і «маніфест = теки» у web `scripts/sprite-manifest/sprite-manifest.test.ts`; +28 тестів; lint/typecheck/test зелені, пороги й залежності не змінено. Відкрито: ключ маніфесту без `.png`, а `SpriteKey` токена з `.png` (рішення в LG3); `spritesFor('unique', …)` завжди дає placeholder, пошук унікального спрайта за `uniqueKey` — LG4                                                                                                                                                                                                                                                                                                                                 |
| 2026-11-17 | LG3  | фабрика базових токенів без зміни поведінки гри: `tokens/factory/` — інтерфейси `ITypePicker`…`ITokenValidator` і класи `RealmTypePicker`, `WordPoolNameGenerator` (D13, без пари слів однієї `theme`), `ManifestSpriteResolver`, `WeightedAttributeGenerator` (0–2, рівні ваги, лише implemented), `EmptySkillGenerator`, `RangePriceGenerator`, `SpecSheetDescriptionBuilder` (рядки §6, ключі `content.tokens.line                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | realm | attr                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | tool.*`en/uk),`ZodTokenValidator`; `TokenFactory.createBase`→`TokenResult`(відмови`BAD_SOURCE_ID`, `BAD_ITEM_INDEX`, `GOD_EXECUTOR_NOT_BASE`, `UNKNOWN_TYPE`, `TYPE_NOT_IN_REALM`, `NO_TYPE_IN_REALM`, `INVALID_TOKEN`), потоки `token:<id>:<step>`, `generatorVersion`1; id`<kind>:<key>:<n>`(kind chest/grave/quest/shop/upcast/dev/test) і ключ спрайта без`.png`(D14) у схемі;`theme`у словах (7 тем),`unit` в атрибуті (`heart`= half-heart);`formatTokenName`/`formatTokenDescription`/`flattenTextTree`; `pnpm tokens:sample`; `tsx ^4.23.1` у web devDependencies (D16). Тести +38 (TG-1…TG-7, TG-9, golden 20 сідів, відмови). TG-7: змішані 454/500 = 90.8% різних, макс. 3 повтори; пара світ+тип 412–413/500 = 82.4–82.6% |
| 2026-11-17 | LG4  | унікальні токени без зміни поведінки гри: словник 48+48 спільних слів (+16 префіксів, +16 суфіксів en/uk, нові теми `stone`, `rain`, `hawk`), одиниці атрибутів D18 (`half-heart`, `side`, `point`, `hex`, `kg`); `tokens/unique-schema.ts` (`UniqueTokenDefinition` strict: назва `authored`, `SkillId[]`, ручна ціна, `rolled.attributes` 1–2 = максимум, як TG-2), `UniqueRegistry`, контент `token-uniques.content.ts` (`lantern-eater` gloom, серце 1 + 1 випадковий; `last-verdict` god-executor, серце 2, `b_strike`), тексти `content.tokens.unique.*` і `realm.god-executor`; `uniqueContentFailures` у `validateContent` (тип, атрибут відомий, дозволений, значення в межах `valueByTier`); `TokenFactory.createUnique` → `UNKNOWN_UNIQUE`, `UNIQUE_ALREADY_OWNED` (за `ctx.ownedUniques`, `progress` не змінено), без відкату на базовий; спрайт унікального — ключ `unique-<uniqueKey>` (файл `items/unique/unique-<uniqueKey>.png`), немає в маніфесті → `_placeholder` + попередження `pnpm tokens:manifest`; `unique-drop.ts`: `UniqueDropRule { uniqueKey, chance: 'a/b' }`, `resolveUniqueDrop` (один кидок, смуги шансів, власні ключі пропускаються, сума ≤ 1); `lightFrameFile`/`LIGHT_COLOR_BY_TONE`; `generatorVersion` 2 (змінено лише golden). TG-7: змішані 480/500 = 96% (макс. 2 повтори), пара світ+тип 459–460/500 = 92%. +48 тестів engine, +2 web; lint/typecheck/test зелені, пороги не змінено |
| 2026-11-17 | LG4  | виправлення: закріплений атрибут унікального має бути `implemented: true` (`uniqueContentFailures`, +1 тест відмови); `rolled.attributes` — точна кількість (`AttributeRollOptions.count`), менше лише коли пул вичерпано (тести оновлено; golden базових не змінився); §7: шлях спрайта унікального `items/unique/unique-<uniqueKey>.png`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-11-17 | LG5a | зберігання токенів без зміни створення предметів: клітинка інвентаря = union (стос — нинішня форма без `token`; токен — strict `{ id, key, type, amount: 1, token }`, `key` = `token.type`), бо літеральна форма D1 зламала б усіх читачів `item.key`; поле `token?` (strict, ключ = тип, кількість 1) також у товарах, викупі, лотах, землі бою й квесту, вмісті контейнерів і гексоб'єкті карти; токен переноситься при переміщенні, продажі → викуп → купівлі, лоті → знятті; upcaster `inventory` v1 → v2 (`inventory/upcast-item-tokens.ts`: спорядження з одним предметом → `idol` base, `mapTier` 1, `sourceId` `upcast:<heroId>.<bag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | equip | stash>.<slot>`, `n`0, сід`upcast:<heroId>`; стоси й id без змін; детермінований, ідемпотентний); `progress`v10`ownedUniques`(upcaster 9 → 10);`staleWorldOf`/`StaleWorldError`в engine і api`world/world-documents.ts` `loadWorldDocument`: застаріла карта → свіжа з тим самим `mapId`+ одне попередження (world.service, quest-run.service, reconcile-quest-world;`battleOpen`ігнорує застарілий документ);`CONTENT_VERSION`2. Тести: характеризація engine + API, upcaster 14, збереження токена 9, застаріла карта 3 + 2 API,`ownedUniques`3, TG-12, FORBIDDEN. Змінено характеризацію/піни:`board-library` `CONTENT_VERSION`1 → 2, API`schemaVersion` progress 9 → 10. Відкрито: підбір із землі/контейнера (`grantToDraft`, `pickupStack`, TAKE) і `set-hands` при стосі > 1 ще за ключем — до LG5b |
