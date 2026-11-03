# E2E: групування за функціональністю + вибірковий запуск на pre-push

Бриф для Claude Code. Гілка вже створена й checked out — працюй у ній, не створюй гілок, не комітай.
Перед стартом завантаж скіли `hexoflat-e2e`, `hexoflat-phase`.

## Мета і критерії приймання

1. Кожен e2e-тест належить до логічної групи функціональності застосунку.
2. Pre-push хук визначає змінені файли в пуші, розпізнає, до яких груп вони належать, і запускає **лише** e2e цих груп (+ `@smoke`).
3. Зміни в спільній інфраструктурі (engine, test-framework, конфіги, залежності) → повний прогін. Невідомий файл → повний прогін (safe by default). Тільки docs/*.md → e2e пропускаються.
4. Рішення селектора детерміноване, пояснюване (друкує: файл → група → чому) і покрите Vitest-тестами.

## Фаза 0 — Інвентаризація (без змін коду) ✅ 2026-11-03

Пройди `apps/playwright/e2e/**/*.spec.ts` і `apps/web/src/**`. Підготуй таблицю:

- spec-файл → що він реально перевіряє → які Feature/Page Object/Component використовує → які маршрути/view/stores/feature-папки `apps/web` зачіпає.
- Які хук-менеджери вже є (husky / lefthook / simple-git-hooks), версія Playwright (теги потребують ≥1.42), як CI запускає e2e.

Покажи таблицю і запропоновані групи **до** початку фази 1. Орієнтовний перелік груп (уточни за фактичними spec-ами, не створюй порожніх):

| Тег            | Функціональність                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@smoke`       | застосунок запускається, дошка готова (`data-ready`), один критичний шлях. Завжди запускається при зміні `apps/web` |
| `@auth`        | логін, реєстрація, restoreSession, user-store                                                                       |
| `@board`       | рендер дошки, fog, reveal, рух героя, генерація карт                                                                |
| `@hero`        | деталі героя, інвентар, предмети/рідкість, дерево навичок (Path)                                                    |
| `@camp`        | кемп, телепорт/return scroll, Воля                                                                                  |
| `@scenario`    | сценарії, задачі, перемога/поразка                                                                                  |
| `@combat`      | бій (якщо вже є тести)                                                                                              |
| `@persistence` | save/load, debounce-збереження, snapshots                                                                           |
| `@shell`       | навігація, налаштування, layout desktop/tablet/mobile                                                               |

## Фаза 1 — Реорганізація suite ✅ 2026-11-03

- Структура: `apps/playwright/e2e/<group>/*.spec.ts`. Тести переносяться, логіка не змінюється.
- Кожен `test.describe` отримує теги: `test.describe('…', { tag: ['@board'] }, …)`. **Рівно один основний тег групи** на spec-файл. Додаткові теги допустимі лише тоді, коли тест справді проходить через іншу фічу (напр. `@board` + `@persistence`).
- Шари не порушувати: spec-и викликають лише Feature. Якщо при переносі видно дублі Feature-методів — злити, але не розширювати scope.
- Команди в `apps/playwright/package.json`: `e2e:all`, `e2e:group -- @board` (через `--grep`).

**Підсумок фази 0/1.** Затверджені групи: `@auth` 13, `@board` 6, `@camp` 13, `@combat` 25, `@hero` 32 (разом з `events-log`), `@shell` 4 (лише locale), додатково `@smoke` 2 (перший тест `login.spec` і `hero-movement`). Сума 93 = було 93; повний прогін до і після: 93 passed. Спеки лежать у `e2e/<group>/`, папки `world/` і `i18n/` прибрані; `e2e:all` і `e2e:group` додані в `apps/playwright/package.json`. Тимчасовий shell-варіант (`scripts/e2e-suites.map`, `pre-push-e2e-plan.sh`) оновлено на нові шляхи й живе до фази 4. Назви тестів у звітах тепер мають префікс describe (групова назва файлу).

Фаза 1 закінчена, коли повний прогін дає ту саму кількість тестів і той самий результат, що й до переносу (порівняй числа).

## Фаза 2 — Карта впливу (impact map) ✅ 2026-11-03

Файл `apps/playwright/impact-map.ts` (типізований, валідація через Zod):

```ts
export const impactMap = {
  // будь-яка зміна → повний прогін
  global: [
    'packages/engine/**',
    'apps/playwright/src/framework/**',
    'apps/playwright/src/fixtures/**',
    'apps/playwright/playwright.config.*',
    'apps/playwright/impact-map.ts',
    'apps/web/src/e2e/**', // window.__HEXOFLAT_TEST__
    'apps/web/vite.config.*',
    'apps/web/index.html',
    'apps/web/src/main.ts',
    '**/package.json',
    'pnpm-lock.yaml',
    'tsconfig*.json',
    'turbo.json',
  ],
  // зміни ніколи не тригерять e2e
  ignore: ['**/*.md', 'docs/**', '**/*.test.ts', '**/*.spec.ts' /* unit, не e2e */, '.github/**'],
  groups: {
    board: {
      roots: ['apps/web/src/features/board/**', 'apps/web/src/render/**'], // фактичні шляхи — з фази 0
      specs: 'apps/playwright/e2e/board/**',
    },
    // …
  },
} as const;
```

**Підсумок фази 2.** `apps/playwright/impact-map.ts` готовий: `impactMapSchema` (Zod) і `impactMap`, який парситься при імпорті. Відхилення від ескізу: (1) `'**/*.spec.ts'` НЕ в `ignore`, бо `*.spec.ts` у `apps/playwright/e2e` це e2e-спеки; ігноруються тільки `**/*.test.ts`; (2) додано `smokeTag`/`smokeOn` (правило 6 фази 3 живе в даних); (3) `roots` це globs: файл належить групі, якщо збігається з root або транзитивно імпортується файлом root (граф у фазі 3); сюди ж входять не-web шляхи (`apps/api/src/auth/**` для `auth`); (4) `global` розширено `config/**`, `global-setup.ts`, `pnpm-workspace.yaml`, `**/tsconfig*.json`. Схема перевіряє: назва групи `[a-z]+`, `specs` лежить у `e2e/<група>/`, `smoke` не група, glob не одночасно в `global` і `ignore`. Перевірено: усі roots збігаються з реальними файлами, кількість спеків за групами 3+3+3+2+7+1=19, негативний кейс (чужа папка спеків) відхиляється. Додано залежність `zod` у `apps/playwright`. Vitest-тести карти й селектора з'являються у фазі 3.

Правила:

- `roots` — це «власні» папки фічі. Зміна spec-а, Feature, Page Object чи Component групи → запуск цієї групи (компонент, який використовують кілька груп → всі групи, що його імпортують).
- Чесне доповнення: не вгадуй відповідність лише за назвами папок. Див. фазу 3.

## Фаза 3 — Селектор `apps/playwright/scripts/select-e2e.ts` ✅ 2026-11-03

Вхід: список змінених файлів. Вихід: `{ mode: 'all' | 'groups' | 'none', groups: string[], reasons: Array<{file, groups, why}> }` і готовий `--grep`.

Алгоритм для кожного файлу:

1. Збіг з `ignore` → пропустити.
2. Збіг з `global` → `mode: 'all'`, далі не рахувати.
3. Файл у `apps/playwright/**` → групи, чиї spec-и прямо чи транзитивно імпортують цей файл (граф імпортів тестового коду).
4. Файл у `apps/web/src/**` → **граф зворотних залежностей**: які `roots` груп транзитивно імпортують цей файл. Так зміна спільного компонента/store/composable піднімає саме ті групи, що його реально використовують. Граф будуй через `dependency-cruiser` (підтримує `.vue`, TS path aliases; `--output-type json`), читай резолвлені шляхи, не парси імпорти регулярками.
5. Файл не потрапив у жодну групу й не в `ignore` → `mode: 'all'` + reason `unmapped` (страховка: краще зайвий прогін, ніж пропущена регресія).
6. Будь-яка зміна в `apps/web/**` → додати `@smoke`.

Логіка чиста: функція `selectE2E(changedFiles, impactMap, depGraph)` без доступу до git і ФС — щоб тестувати її у Vitest. Обгортка CLI окремо збирає git-diff і граф.

**Підсумок фази 3.** Файли: `scripts/select-e2e.ts` (чиста `selectE2E`, picomatch, без git і ФС), `scripts/build-dep-graph.ts` (програмний API `dependency-cruiser`, `.vue` і alias `@/` резолвляться; ~1 с на 471 вузол, графи `apps/web/src`, `apps/playwright/src`, `apps/playwright/e2e`), `scripts/select-e2e-cli.ts` (`pnpm --filter @hexoflat/playwright e2e:select --files a b` або `--range base..head`, `--json`), `scripts/select-e2e.test.ts` (22 тести Vitest, `pnpm --filter @hexoflat/playwright test`, його ж запускає `turbo test`). Додано залежності `vitest`, `dependency-cruiser`, `picomatch`, `tsx`, `typescript`, `@vue/compiler-sfc`; pnpm сам дописав `minimumReleaseAgeExclude` для `dependency-cruiser@18.7.2` і `semver@7.8.6` у `pnpm-workspace.yaml`.

**Знахідка: `boundaries`.** Наївний зворотний граф дає «усе досяжне з усього»: `login-form.vue → router/index.ts → hex-world-map.vue`, а Pinia-сторі (`hero-store`, `world-map-store`, `battle-store`) імпортують майже все. Будь-яка зміна у `apps/web` піднімала всі шість груп. Рішення: `boundaries` в `impact-map.ts` (`router/**`, `stores/*-store.ts`): обхід доходить до межі, але не йде крізь неї, крім випадку, коли межа сама є root цієї групи (`hero-store` це root `hero`, тому `hero` бачить його імпорти). Ціна: зміна глибоко під стором приписується групі власника стору, а не його споживачам; страховка від помилок карти це повний прогін на trunk і nightly (фаза 5). Приклади: `render/fog-look.ts` → `board, smoke`; `use-fit-to-width.ts` → `board, hero, smoke`; `api/client.ts` → `auth, hero, smoke`; `packages/engine/**` → усе.

**Vitest-тести селектора** (`select-e2e.test.ts`), мінімум:

- лише `.md` → `none`
- файл у `packages/engine` → `all`
- файл у корені board → `['board','smoke']`
- спільний компонент, який імпортують hero і camp → `['camp','hero','smoke']` (саме ці групи, не всі)
- новий незмаплений файл → `all` з reason `unmapped`
- зміна Component тестового фреймворку, яку використовує лише одна група → ця група

## Фаза 4 — Pre-push хук ✅ 2026-11-03

Використай уже наявний хук-менеджер; якщо немає — `lefthook`.

Diff-діапазон: git передає хуку в stdin рядки `<local_ref> <local_sha> <remote_ref> <remote_sha>`.

- `remote_sha` не нулі → `git diff --name-only remote_sha..local_sha`.
- нулі (нова гілка) → `git merge-base local_sha origin/main` і diff від нього.
- видалення гілки (`local_sha` нулі) → нічого не запускати.
- Об'єднати файли з усіх рефів пушу.

Поведінка:

- Надрукувати пояснення: `board ← apps/web/src/render/fog-layer.ts (imports via BoardView.vue)`.
- `none` → вийти з 0 з повідомленням.
- Інакше `pnpm --filter playwright exec playwright test --grep "@smoke|@board"`.
- Ручні перемикачі: `E2E_ALL=1` (повний прогін), `E2E_SKIP=1` (пропустити, з попередженням). `--no-verify` працює й так.
- Хук не повинен сам будувати весь застосунок, якщо e2e не потрібні: селектор запускається до білду.

**Підсумок фази 4.** `.husky/pre-push` викликає `select-e2e-cli.ts --pre-push` до будь-якого білду. Діапазони diff рахує чиста `diffRanges` у `scripts/push-refs.ts` (8 Vitest-тестів у `push-refs.test.ts`): наявна гілка `remote..local`, нова `merge-base origin/main..local`, видалення нічого, кілька рефів об'єднуються. Відхилення від плану: невідомий локально `remote_sha` або відсутній `origin/main` дають повний прогін (план мовчав). stdout селектора це `none` / `all` / `grep:<regex>`, пояснення «файл → група → чому» іде в stderr. `E2E_ALL=1` і `E2E_SKIP=1` працюють. Тимчасові `scripts/e2e-suites.map` і `scripts/pre-push-e2e-plan.sh` та крок CI `lint:e2e-map` видалені; їхню роль (кожен спек у групі) перебере `e2e:map:check` у фазі 5.

**Демо (фейкові коміти через `git commit-tree`, гілки не чіпалися).** (а) `render/fog-look.ts` → `board, smoke`: через хук реально пройшло 7 тестів, 30 с тестів, 50 с стіни разом з typecheck і білдом engine (повний прогін: 93 тести, 4,6 хв тестів). (б) `components/gui/will-number.vue` → `board, camp, combat, hero, smoke` (споживачі за графом; `auth` і `shell` не потрібні). (в) `packages/engine/src/battle/strike.ts` → `global`, повний прогін. Для (б) і (в) показано лише рішення селектора, e2e не запускалось.

## Фаза 5 — CI і захист від деградації карти ✅ 2026-11-03

- CI на PR використовує той самий селектор, але з diff-ом від `merge-base` з базовою гілкою. На trunk-пушах і nightly — завжди повний прогін (страховка від помилок у карті впливу).
- Скрипт `e2e:map:check` (запуск у CI, падає при порушенні):
  - кожен spec має рівно один основний груповий тег, і цей тег є в `impactMap.groups`;
  - spec лежить у папці своєї групи;
  - кожна група має ≥1 spec;
  - кожен файл `apps/web/src/**` досяжний з `roots` хоча б однієї групи або входить у `global`, інакше він друкується як `unmapped` (щоб «повний прогін через unmapped» не став нормою).

**Підсумок фази 5.**

- `ci.yml`: новий job `e2e-plan` (дешевий). Для гейтового PR (`game-dev-vite` → `main`) ставить checkout з повною історією, запускає `select-e2e-cli.ts --range "<base.sha>...HEAD" --json`, віддає `mode` і `grep`, а пояснення «файл → група → чому» пише в Job Summary. Інші PR отримують `none` без install; push і nightly отримують `all`. Job `e2e` залежить від `e2e-plan`, пропускається при `none` і передає `grep` у reusable `e2e-tests.yml` (новий input `grep`, порожній = весь набір).
- Додано `schedule` (`0 3 * * *`) і запуск повного e2e на push у `main`/`game-dev-vite`. Nightly не публікує Pages (`build-pages` і `deploy` пропускаються при `schedule`).
- **Зміна політики CI (підтвердьте):** раніше e2e в CI йшов лише для гейтового PR, а push у trunk e2e не запускав; тепер кожен push у `main`/`game-dev-vite` і nightly це повний прогін, як вимагає ця фаза.
- Allure: частковий PR-прогін публікує менший звіт, тренди повні лише на повних прогонах.
- `e2e:map:check` (`pnpm run e2e:map:check`, крок у lint-job): `scripts/check-e2e-map.ts` (7 Vitest-тестів) і `e2e-map-check-cli.ts`, що бере теги з `playwright test --list --reporter=json`. Падає, якщо тест без тегу своєї папки (`@<група>`), з невідомим тегом, поза папками груп, або в групі немає спеків. Файли `apps/web/src`, до яких не доходить жоден root, друкуються як `unmapped` без падіння (зараз 13). У `global` додано `App.vue`, `router/routes.ts`, `assets/global.css`, `scripts/**`; `*.fixture.ts` в `ignore`.
- Відхилення від плану: перевірка «досяжність з roots» лише друкує, не валить CI.

## Що показати для приймання

1. Таблиця з фази 0 і фінальний перелік груп.
2. Кількість тестів до/після реорганізації (має збігтися).
3. Зелені Vitest-тести селектора.
4. Три демо-пуші з виводом хука: (а) зміна лише в одній фічі → запуск тільки її групи + smoke; (б) зміна спільного компонента → лише групи-споживачі; (в) зміна в `packages/engine` → повний прогін.
5. Час прогону e2e для (а) порівняно з повним прогоном.

Оновлюй цей документ прогресом після кожної фази (позначки ✅ і короткі нотатки).
