# Спліт-скрін 70/30: hero-board як постійна дошка

**Гілка:** створюєш і перемикаєшся сам, до старту чату — `git checkout -b ui/hero-board-split-screen` від актуального `origin/game-dev-vite`. Claude Code гілок не створює, лише працює на вже переключеній.
**Скоуп:** тільки `apps/web`, тільки desktop. Мобільна/планшетна поведінка не чіпається — інвентар там лишається оверлеєм, як зараз.

## Що є зараз

`hero-inventory-overlay.vue` — модалка в стеку `overlay-store` (бекдроп, фокус-трап, Esc). Відкривається однією точкою входу: `hex-world-map.vue:280`, `onOpenHeroInventory: () => useOverlayStore().openOverlay('hero-inventory')`.

Карта масштабується на весь viewport: `use-hex-board-sizing.ts` рахує `scale` від `window.innerWidth`.

`hero-details-top-bar.vue` — фіксована шапка (`position: fixed; inset: 0 0 auto 0`, 64px), вміст: імʼя, HP-бар, чіп кроків із поповером (Scout rank, Move Steps, Next Rank), короткий Scout-ранг, підпис інструменту в руці, статус LOCKED/READY, назва локації, кнопка налаштувань (`overlayStore.openOverlay('settings')`), `game-events-logger`, Logout.

**[Оновлено за макетом користувача — заміняє попередній поділ "герой / система".]** Топ-бар зникає **весь**, без винятків і без окремого кутового кластера. Увесь його вміст переїжджає одним блоком у шапку `hero-board-panel.vue` (правих 30%). Карта забирає всю висоту екрана від `y=0` — вертикальний відступ під бар (64px) зникає разом з баром.

## Що робимо

1. **Layout.** У `hex-world-map.vue` — контейнер 70/30: ліворуч наявний `.hex-map` (без змін усередині), праворуч нова постійна панель. Розмір панелі — константа UI-стану в новому composable (`use-game-layout.ts` чи подібне), **не** Pinia-стор і не жорстко зашитий відсоток у двох місцях.

2. **Панель замість модалки.** Нова `hero-board-panel.vue` у `map-scene/components/` — той самий вміст (`inventory-board-grid`, `hero-equip-board`, `token-details-panel`), без бекдропу й фокус-трапа модалки. `hero-inventory-store.hydrate()` викликається в `onMounted` панелі, як зараз у оверлеї.

3. **Прибрати з overlay-системи.** `'hero-inventory'` геть з `OverlayType` (`types/overlay-types.ts`), з реєстру в `base-overlay.vue`, кнопка `onOpenHeroInventory` у `hex-world-map.vue` видаляється — панель завжди видима, відкривати нічого.

4. **Розмір карти під нову ширину.** `use-hex-board-sizing.ts` рахує доступну ширину від фактичного контейнера `.hex-map` (через ref/`ResizeObserver`), а не від `window.innerWidth` напряму. Це правильніше за жорстко вписаний "70%" удруге в цьому файлі — контейнер сам знає свою ширину.

5. **Топ-бар зникає весь.** `hero-details-top-bar.vue` видаляється з `hex-world-map.vue` без залишку. Увесь його вміст — і дані героя (імʼя, HP, кроки/Scout-поповер, інструмент, статус), і системні елементи (локація, налаштування, event-логер, logout) — переїжджає одним блоком у шапку нової `hero-board-panel.vue`. Жодного окремого кутового кластера — попередня версія цього брифу пропонувала розділити на дві групи, макет користувача це скасував.

6. **Стиль панелі — не сіра шахівниця.** Наявний `inventory-board-grid.vue` — однотонна сітка сірих квадратів (`.cell`), функціонально ок, візуально ні. Це не косметика на потім, а частина цього ж завдання: оформити `hero-board-panel.vue` (і слоти інвентаря всередині неї) у стилі, узгодженому з наявною палітрою гри — той самий крижано-блакитний/золотавий фентезійний тон, що вже є в `hero-details-top-bar.vue` (`rgba(190, 220, 255, …)`, скруглені `chip`, тонкі світлі рамки, легкий blur/glow). Не вигадувати нову візуальну мову й не тягнути новий асет-пайплайн — переоформити наявні слоти (заокруглення, рамка, hover/selected стан, легке підсвічування) у тому ж дусі, що вже є на сторінці логіну й топ-барі.

## Що не чіпаємо

Жодної ігрової логіки, жодних змін у `packages/engine`. `hero-inventory-store` лишається як є — міняється тільки презентаційна обгортка. `hex-tile-details` і `settings` лишаються в overlay-системі — вони справді модальні.

## e2e — не побічний ефект, окрема робота

`inventory-overlay` е2e-тести (Feature/Page Object/Component шари, `apps/playwright/`) писані під модалку — `data-testid="inventory-overlay"` зникає разом з бекдропом. Топ-бар теж має свої `data-testid` (`topbar-hero-name`, `topbar-steps-chip`, `topbar-hp-bar` тощо) — вони переїжджають разом із вмістом на нові елементи `hero-board-panel.vue`, а не зникають мовчки. Компонент-шар (`*.component.ts`) і відповідні Feature-класи треба оновити під нову структуру. Прочитати скіл `hexoflat-e2e` перед правками — без прямих локаторів у `e2e/**`.

## Приймання

- Панель героя завжди видима на 70/30, ніколи не закривається/не відкривається.
- Карта коректно центрується й масштабується в межах 70%-контейнера (не всього вікна).
- `overlay-store` більше не знає про `hero-inventory`.
- Нічого з топ-бару не втрачено — і дані героя, і системні елементи видно в шапці панелі.
- Панель героя виглядає оформленою (заокруглені слоти, узгоджена палітра, hover/selected стан), а не сірою шахівницею.
- e2e зелені (з оновленими компонент-локаторами й `data-testid`).
- Ратчет ESLint не зрушено; нова логіка — у composable, не в `hero-store`/`world-map-store`.

## Старт чату

```
Working in hexoflat. Read docs/tasks/hero-board-split-screen.md in full, and the
hexoflat-web-state skill before writing any store/composable code, and the hexoflat-e2e skill
before touching apps/playwright.

Desktop-only 70/30 split: hex-world-map.vue gets a persistent 70% map pane / 30% hero-board
pane, no breakpoints or mobile handling. Move hero inventory out of overlay-store entirely
(delete 'hero-inventory' from OverlayType and its base-overlay.vue registry entry, remove the
onOpenHeroInventory trigger) into a new always-mounted hero-board-panel.vue in
map-scene/components, reusing inventory-board-grid / hero-equip-board / token-details-panel as
they are — drop the modal backdrop/focus-trap chrome, keep hero-inventory-store.hydrate() on
mount. Panel width is UI-only state in a new composable, not a Pinia store, not a magic number
duplicated in two files. use-hex-board-sizing.ts must measure the actual .hex-map container
width (ref/ResizeObserver), not window.innerWidth, so the map centers correctly in the new 70%
pane.

Also remove hero-details-top-bar.vue entirely, no remainder — per the user's own mockup, ALL of
its content (hero stats: name, HP bar, steps chip + scout popover, tool label, LOCKED/READY
status; AND session controls: location chip, settings button, game-events-logger, logout) moves
as one block into hero-board-panel.vue's header. No separate corner cluster — an earlier draft
of this brief proposed splitting hero stats from session controls into two places; the user's
mockup overrides that, don't reintroduce it. Carry over the existing computed logic as-is, not
rewritten.

Also restyle the inventory slots and the panel shell: the current inventory-board-grid.vue is a
flat grey checkerboard of squares, functional but not game-like. Reuse the icy-blue/gold
fantasy palette already established in hero-details-top-bar.vue and the login scene (rounded
chips, thin light borders, soft glow) rather than inventing a new visual language or pulling in
new art assets — restyle the existing slot markup (rounding, border, hover/selected state,
subtle highlight).

hex-tile-details and settings stay in the overlay system — they are genuinely modal, don't
touch them. No packages/engine changes, no change to hero-inventory-store's actual state.

Update the Playwright inventory AND topbar e2e (component layer + Feature classes) to match the
new panel structure instead of the modal/bar — carry over every data-testid's underlying
assertion, don't just delete coverage. This is required work, not an afterthought.

I'm already on the dedicated branch for this task — do not create or switch branches yourself.
Do not commit.
```
