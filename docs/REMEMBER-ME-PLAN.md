# Hexoflat — план: "Remember me" на логіні

## Поточний стан (перевірено в коді, 2026-08-06)

Сесія зараз керується виключно httpOnly cookie `session`, яку ставить `setSessionCookie()` в [`apps/api/src/auth/auth.controller.ts`](../apps/api/src/auth/auth.controller.ts) — і `POST /auth/login`, і `POST /auth/register` завжди викликають її з фіксованим `maxAge: SESSION_COOKIE_MAX_AGE_SECONDS` (7 днів). Жодного вибору в користувача зараз немає — кожен логін уже "запам'ятовується" на 7 днів, незалежно від того, закриє він браузер чи ні.

`accessToken` живе лише в пам'яті (Pinia state в `user-store.ts`, не в `localStorage` — `SESSION_STORAGE_KEYS` там містить тільки `user`/`hero`). На перезавантаженні сторінки його відновлює `GET /auth/session` через саму cookie (`restoreSession()` в [`apps/web/src/stores/user-store.ts`](../apps/web/src/stores/user-store.ts), викликається з `main.ts`). Це означає: **єдине, що фактично визначає "чи переживе сесія закриття браузера" — це наявність/відсутність `Max-Age` на cookie.** Термін дії самого JWT (`JWT_EXPIRES_IN`, дефолт `7d`, див. `jwt.env.ts`) міняти для цієї фічі не потрібно — залишається як стеля незалежно від "remember me".

Форма логіну — [`apps/web/src/a-game-scenes/login-scene/components/login-form.vue`](../apps/web/src/a-game-scenes/login-scene/components/login-form.vue), перемикає `login`/`register` режими, чекбоксу "remember me" немає.

## Мета

Дати користувачу вибір на екрані логіну: **"Запам'ятати мене"** (checked за замовчуванням — щоб не зробити тиху регресію теперішньої завжди-персистентної поведінки).

- Checked (за замовчуванням) → як зараз: persistent cookie з `Max-Age` (7 днів), сесія переживає закриття браузера.
- Unchecked → session cookie (без `Max-Age`/`Expires`) — браузер сам стирає її при повному закритті, сесія не переживає рестарт браузера, хоч і живе нормально між перезавантаженнями сторінки в межах одного браузерного сеансу.

Чекбокс стосується тільки `login` (не `register` — реєстрація й так одразу логінить, зберегти для неї теж persistent-за-замовчуванням поведінку без окремого чекбокса).

## Що робити

**Backend (`apps/api`):**

1. `apps/api/src/auth/auth.dto.ts` — додати `rememberMe: z.boolean().optional().default(false)` до `LoginDtoSchema` (не чіпати `RegisterDtoSchema`).
2. `apps/api/src/auth/auth.controller.ts`:
   - `setSessionCookie(reply, accessToken)` → додати третій параметр `persistent: boolean`; коли `true` — лишити `maxAge: SESSION_COOKIE_MAX_AGE_SECONDS` як зараз; коли `false` — не передавати `maxAge` взагалі (Fastify тоді ставить cookie сесії браузера).
   - `login()` handler — викликати `setSessionCookie(reply, result.accessToken, dto.rememberMe)`.
   - `register()` handler — викликати з `persistent: true` завжди (поточна поведінка, без чекбокса).
3. Юніт-тест у `auth.controller.spec.ts` (за зразком існуючих `login sets an httpOnly session cookie...`): перевірити, що при `rememberMe: true` в опціях cookie є `maxAge`, а при `false` (або відсутньому полі) — немає.

**Frontend (`apps/web`):**

4. `apps/web/src/api/Requests.ts` — `LoginCredentials` → додати `rememberMe?: boolean`.
5. `apps/web/src/stores/user-store.ts` — `login(username, password, rememberMe = true)` прокидає `rememberMe` в `loginRequest(...)`. `register()` не чіпати.
6. `apps/web/src/a-game-scenes/login-scene/components/login-form.vue`:
   - Новий `<input type="checkbox">` "Remember me" — видимий тільки коли `mode === 'login'` (за зразком того, як зараз показано/приховано `confirmPassword` для `register`).
   - `data-testid="login-remember-me-checkbox"`.
   - Reactive `form.rememberMe`, дефолт `true`.
   - `onSubmit()` передає `form.rememberMe` в `userStore.login(...)` тільки для `mode === 'login'`.

**E2E (`apps/playwright`):**

7. Новий тест (або доповнення `verify-login-test.spec.ts`): залогінитись з unchecked "remember me", прочитати `context.cookies()` і перевірити, що cookie `session` **не має** `expires` (Playwright показує `-1` для session cookie), на відміну від дефолтного (checked) логіну, де `expires` має бути в майбутньому.

## Критерій приймання

- `pnpm turbo run lint typecheck build` і `pnpm turbo run test --filter=@hexoflat/api --filter=@hexoflat/web` проходять чисто.
- Логін з checked (або без явного вибору) "remember me" — cookie `session` має `Max-Age`/`Expires`, як і зараз.
- Логін з unchecked — cookie `session` без `Max-Age`/`Expires` (session cookie).
- Реєстрація не змінює поведінку (завжди persistent, без чекбокса).
- Новий e2e-тест з п.7 зелений.

## Свідомо поза скоупом

- Термін дії самого JWT (`JWT_EXPIRES_IN`) не міняється — стеля залишається 7 днів для обох випадків, "remember me" контролює тільки чи переживе cookie закриття браузера, не довжину токена.
- Немає "remember me" на реєстрації.
- Ніякого окремого refresh-токена/ротації — поза скоупом цієї фічі.

## Старт чату

```
Working in hexoflat. Read docs/REMEMBER-ME-PLAN.md in full before starting — it has the
exact current-state analysis (setSessionCookie in auth.controller.ts, LoginDtoSchema,
login-form.vue, user-store.ts, Requests.ts) and the precise list of changes needed.
Implement the "Remember me" checkbox on login only (not register): add rememberMe to
LoginDtoSchema (default false), thread it through setSessionCookie's new `persistent`
param (omit cookie maxAge when false instead of always setting
SESSION_COOKIE_MAX_AGE_SECONDS), and add the checkbox + wiring on the frontend
(login-form.vue, user-store.ts's login(), Requests.ts's LoginCredentials). Default the
checkbox to checked so existing always-persistent behavior doesn't silently regress for
users who don't touch it. Add the unit test in auth.controller.spec.ts and the e2e test
described in the plan (checked vs unchecked cookie Max-Age/Expires). Do not touch
JWT_EXPIRES_IN or add refresh-token logic — out of scope per the plan. Ask before git
commit.
```
