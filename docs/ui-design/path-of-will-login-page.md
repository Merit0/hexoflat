# TASK FOR CLAUDE CODE — Implement the "Path of Will" login screen, identical to the approved prototype

You are implementing a new login screen in this repo (`hexoflat`, product name **Path of Will**). The design is final and approved. Your job is to reproduce it **pixel- and behavior-identical** in the real app (Vue 3 + TypeScript + Vite + Pinia), for desktop, tablet and phone.

This file has three parts:

- **Part 1 — Execution instructions** (this part): what to do, in which order, file by file.
- **Part 2 — Design & behavior spec**: the detailed reference (tokens, every animation with numbers, copy EN/UA, a11y, tests).
- **Appendix B / C** at the end of Part 2: the **full source of the approved interactive prototype** (desktop/tablet and mobile). The prototype is the source of truth: when Part 2 and the prototype disagree on a visual value, **the prototype wins**.

> **Overrides to Part 2:** Part 2 §2 says Phase B/C UI stays hidden. For this task, **build the complete UI of all three modes now** (Sign in, Hero code, New hero with grade/guardian/token preview, passkey button). Features whose backend does not exist yet go through an adapter + feature flags (see Step 6), with flags **ON in development** so the UI is identical to the prototype, and **OFF in production** until the backend lands. Part 2 §9 also says "do not copy inline styles" — correct: move them into scoped CSS + tokens, but keep every value identical.

---

## PART 1 — Execution instructions

### Ground rules (read first)

1. Work on the branch the user already created. Do **not** create branches. Do **not** commit or push — the user commits. Run `git` with `--no-optional-locks` for read-only status commands.
2. Follow this repo's skills: `hexoflat-phase` (characterization tests before changing existing behavior), `hexoflat-web-state` (state placement, ESLint size/complexity ratchet — keep components small), `hexoflat-e2e` (Playwright, layered Page Object / Component architecture, `data-testid` only, no CSS selectors).
3. **Do not change** auth endpoints, token/session storage or `restoreSession()` semantics. Known bug class: shared auth-result handlers in `user-store.ts` must not unconditionally clear persisted client state — `restoreSession()` continues the same session. The "Keep me signed in" switch must map to the existing remember-me behavior without breaking this.
4. No new runtime network requests: self-host fonts.
5. Keep the game engine (`packages/engine`) untouched — this is UI only.
6. After each step, run typecheck, lint and the relevant tests; fix before moving on.

### Step 0 — Discovery (report before editing)

Find and list back to the user (paths + one line each):

- the current login view/route component(s) and the "Create account" view/flow,
- the user/auth store (`user-store.ts` or equivalent) and the functions for sign-in, sign-up, remember-me, restore session,
- the i18n setup (library, locale files, how locale is switched) — if none exists, say so,
- the global styles entry, existing CSS variables/tokens, how Cinzel is loaded today,
- existing Playwright tests and page objects that touch login,
- the router guard that redirects to/from login.

Then state your plan in ≤10 bullets mapped to Steps 1–10 and continue (no need to wait unless something blocks).

### Step 1 — Characterization tests

Before touching the login, make sure Playwright covers today's behavior: successful sign-in reaches the game, wrong password shows an error, remember-me persists a session across reload, not-remembered session does not, create-account works. Add missing cases using the existing page-object layer. These must stay green at the end (update only selectors/test ids, not intent).

### Step 2 — Fonts and tokens

1. Add self-hosted fonts: `@fontsource/cinzel` (500, 600, 700) and `@fontsource/inter` (400, 500, 600, 700) — or reuse the repo's existing Cinzel setup. Import once in the app entry.
2. Create `apps/web/src/styles/auth-tokens.css` (adapt path to repo conventions) with **all** tokens from Part 2 §3, exactly as written. Import it globally.
3. Create `apps/web/src/styles/auth-motion.css` with every keyframe from Part 2 Appendix A plus these classes, values copied from the prototype `<helmet><style>`: lattice drift 40s linear infinite alternate; heart pulse 2.4s ease-in-out infinite with `transform-origin: 100px 150px`; float 6s ease-in-out infinite; spin .8s linear infinite; progress fill 1.6s ease-out forwards; rise .35s ease-out; tagline fade .5s ease-out (two identically-defined classes A/B so it retriggers); shake .45s ease-in-out (two identical classes A/B); ripple .9s ease-out forwards with `transform-origin: 60px 60px`. Include the `prefers-reduced-motion: reduce` block disabling all of them.

### Step 3 — Pure logic (framework-free) + unit tests

Create `apps/web/src/features/auth/logic/` (adapt to repo layout) with pure TS, no Vue imports:

- `password-score.ts` — `passwordScore(p)` exactly as in Part 2 §6.7, plus `STRENGTH_LABEL_KEYS` and `STRENGTH_COLORS` (`#3A4452, #E5484D, #F5A524, #7FB8E6, #5FD4A0` for 0–4). Submit requires score ≥ 2.
- `gaze.ts` — `computeGaze(pointer, emblemRect)`: center x = left + 50% width, y = top + 39% height; `d = max(1, hypot(dx,dy))`; `k = min(1, d/220)`; returns `{ x: dx/d*4.5*k, y: dy/d*3.5*k }`.
- `emblem-mood.ts` — `deriveEmblemMood({ focus, show, blink, loading, gaze, nameLength })` returning `{ eyeX, eyeY, eyesClosed, heartSeconds }` with these rules (identical to prototype `renderVals`):
  - default eye offset = gaze;
  - focus `name` or `newName` → `eyeX = -4 + min(len,18)/18*8`, `eyeY = 3`;
  - focus `password` and shown → `eyeX = 4.5`, `eyeY = 2`;
  - `eyesClosed = blink || (focus==='password' && !show) || focus==='newPassword'`;
  - `heartSeconds = loading ? 0.5 : focus ? 1.5 : 2.4`.
- `runes.ts` — rune definitions (ids, labels, SVG paths from the prototype `defs` array, in this order: star, moon, leaf, flame, drop, bolt, sun), positions `[[78,72],[137,38],[137,106],[78,140],[19,106],[19,38],[78,4]]`, and a pure reducer: `pickRune(state, id)` (ignore duplicates, max 4, report `complete` at 4), `resetRunes()`, `runePolyline(picked)` → `"x+34,y+36 …"` points string.
- `forge-progress.ts` — `forgeSteps({name, score, email})` → `[!!name.trim(), score>=2, true, /.+@.+\..+/.test(email)]`.
- `grade-colors.ts` — `{2:'#8FD3B6',3:'#F2C46D',4:'#7FB8E6',5:'#C9A7F0'}`.

Vitest: table tests for every function (see Part 2 §10).

### Step 4 — Composables

In `apps/web/src/composables/` (or feature folder):

- `usePrefersReducedMotion()` — reactive media query.
- `useBreakpoint()` — returns `'phone' | 'wide'` (phone `< 600px`); one shared listener.
- `usePointerGaze(rootRef, emblemRef)` — one `pointermove` + `pointerleave` listener on the page root; **requestAnimationFrame-throttled**; ignores `pointerType === 'touch'`; returns `{ mx, my, gaze }`; on leave → `mx = my = -999`, gaze `0,0`; disabled when reduced motion. Cache emblem rect; recompute on resize/scroll.
- `useRipples(rootRef)` — `pointerdown` on root; ignore if `event.target.closest('[data-auth-card]')`; push `{id, x: clientX-left-60, y: clientY-top-60}`, keep last 6, remove each after 950ms. Disabled when reduced motion.
- `useBlink()` — every 4300ms set `blink=true` for 140ms. Pause on `document.hidden`. Clear on unmount.
- `useTagline(count=3, ms=5000)` — index + `goTo(i)` that restarts the interval. Pause on hidden.
- `useRecentHeroes()` — reads/writes a small list `{ name, color }[]` (max 3) in localStorage with try/catch; **never store passwords**. Add the hero after each successful sign-in/sign-up. (In dev with an empty list, seed nothing — the prototype's "Mira"/"Tarek" are demo data only.)

### Step 5 — Components (identical visuals)

Create under `apps/web/src/components/auth/`. Use `<script setup lang="ts">` and scoped CSS using the tokens. For **every** element, copy sizes, paddings, gaps, radii, font sizes/weights, colors, borders, shadows and transitions from the prototype markup (Appendix B for wide, Appendix C for phone). Add the listed `data-testid`s.

1. **`AuthBackground.vue`** — absolute layers, `aria-hidden`, `pointer-events:none`:
   - wrapper `left/top -60px`, `width calc(100% + 120px)`, `height calc(100% + 160px)`, class drift;
   - base lattice SVG (pattern `60×104`, path from prototype, stroke `#6F8BA8` 1px, opacity .16);
   - spotlight lattice SVG (same pattern, stroke accent 1.4px, opacity .85) with `mask-image` and `-webkit-mask-image` = `radial-gradient(circle 190px at {mx+60}px {my+60}px, #000 0%, rgba(0,0,0,0) 100%)`;
   - glow: wide = `left 6%, top 50%, 640×640, margin-top -320px`; phone = `left 50%, top -40px, 420×420, margin-left -210px`; `radial-gradient(circle, rgba(127,184,230,.16) 0%, rgba(127,184,230,0) 65%)` (phone .18);
   - ripples: 120×120 SVG at `{x,y}`, polygon `60,6 107,33 107,87 60,114 13,87 13,33`, stroke accent 2px, ripple class.
     Use unique pattern ids per instance (e.g. `useId()`).
2. **`WillEmblem.vue`** — props `eyeX, eyeY, eyesClosed, heartSeconds, shakeKey, size: 'lg'|'sm'`. `lg` = 152×167, `sm` = 84×92 (phone; stroke widths 6/5/4/5 as in Appendix C). Markup exactly Appendix A. Outer wrapper applies shake class alternating A/B on each `shakeKey` change (no class when 0); inner wrapper has float class. Eyes group `transform: translate(eyeX px, eyeY px)` transition `.14s ease-out`; open/closed groups swap opacity with `.08s` transition. Heart `animation-duration: heartSeconds s`. `data-emblem` attribute for gaze rect.
3. **`TaglineCarousel.vue`** — `<p aria-live="polite">` with fade class alternating A/B by index parity; wide: 18px/1.55 `#B4BFCC`, `max-width 460px`, `min-height 56px`, + dots row (gap 8): each a 28×28 transparent button containing a 6px-tall pill, width 24 active / 8 inactive, color accent / `#3A4452`, transition `width .25s, background .25s`, `aria-label "Show tip n"`. Phone: 14px, `min-height 22px`, centered, no dots.
4. **`AuthBrandPanel.vue`** (wide only) — section `flex: 1 1 520px; min-width:0; padding: 64px clamp(24px,6vw,96px); flex column; justify center; gap 28px`: emblem → block (gap 14) with wordmark `<p>` "Path of Will" (Cinzel 700, `clamp(40px,5vw,64px)`, `letter-spacing .08em`, `line-height 1`, `#F2F6FA`) + tagline → `<ul>` (gap 14, max-width 460) of 3 items (15px `#C9D3DE`, gap 14, 22px stroke icons in `#7FB8E6` — copy the three SVGs).
5. **`AuthModeTabs.vue`** — track: grid 3 equal columns, gap 4, padding 4, radius 14, bg `#0F141B`, border `1px #222B37`, `role="group"` `aria-label`. Sliding thumb span: `top/bottom 4px`, `left: calc(4px + i * ((100% - 16px)/3 + 4px))`, `width: calc((100% - 16px)/3)`, radius 10, bg `#243041`, `transition: left .25s cubic-bezier(.3,.7,.2,1)`. Buttons: min-height 40, transparent, 600 13px Inter, color active `#F2F6FA` / inactive `#9AA6B6`, `aria-pressed`. Test ids `auth-mode-signin|code|new`. Changing mode clears error, runes and loading.
6. **`RecentHeroChip.vue`** — button min-height 44, flex gap 10, padding `0 14px 0 6px`, radius 12, border `1px` (selected accent / `#2A3340`), bg `#151B24`, 500 14px; 32px hex avatar SVG (polygon `16,1 29,8.5 29,23.5 16,31 3,23.5 3,8.5`, fill `#223042`, stroke hero color 1.4, initial Cinzel 700 13px at y=21). `aria-pressed`. Test id `auth-recent-hero`.
7. **`AuthField.vue`** — label (13px/500 `#C9D3DE`) + input (height 48, padding `0 14px`, radius 12, border `1px #2E3846`, bg `#0F141B`, color `#F2F6FA`, 400 15px Inter; focus: border `#7FB8E6` + `0 0 0 3px rgba(127,184,230,.22)`; placeholder `#7F8A99`; transition `border-color .15s, box-shadow .15s`) + optional helper (12px `#8E9AAA`). Column gap 6. Emits focus/blur for emblem mood.
8. **`PasswordField.vue`** — AuthField variant with the 44×40 toggle button at `right 4px, top 4px` (input right padding 64px), eye / eye-off SVGs (copy), `aria-label` Show/Hide, **`@pointerdown.prevent`** so focus stays in the input; "Forgot it?" link on the label row (13px, no underline, `#9CCBF0`, hover `#CFE6F8`); Caps Lock warning 13px `#F5C46B`.
9. **`RememberSwitch.vue`** — button `role="switch"` `aria-checked`, min-height 44, gap 10, 500 14px `#C9D3DE`; track 40×24 radius 12 bg accent/`#2E3846` (transition .15s); knob 18px white at `top 3px`, `left 19px|3px` (transition .15s).
10. **`AuthAlert.vue`** — `role="alert"`, padding `10px 12px`, radius 10, bg `rgba(229,72,77,.12)`, border `1px rgba(229,72,77,.4)`, color `#FF9EA2`, 14px. Test id `auth-error`.
11. **`PrimaryButton.vue`** — height 52, radius 14, bg accent, color `#0B1520`, 700 16px Inter, letter-spacing .02em; hover brightness 1.1; active translateY(1px); transition `filter .15s, transform .1s, box-shadow .25s`. Props `loading`, `loadingText`, `ready`. Shadow: ready = `0 0 0 4px rgba(127,184,230,.18), 0 10px 30px rgba(127,184,230,.35)`; not ready (sign-in) = `0 8px 24px rgba(127,184,230,.2)`; not ready (sign-up) = `none`. Loading shows 18px spinner (stroke `#0B1520` 2.4, path `M12 3a9 9 0 1 1-9 9`) + text and disables the button.
12. **`SignInForm.vue`** — form gap 18; title block (h1 Cinzel 600 28px/24px phone `#F2F6FA`; subtitle 15px `#9AA6B6`, gap 6); "Recent on this device" (12px/600 uppercase .06em `#8E9AAA`) + chips (wrap, gap 8) — only when list non-empty; hero name; password; remember switch; alert; primary "Enter the world" (`ready` when both fields non-empty; loading "Opening the gates…"); divider ("or" 12px `#6F7B8B`, 1px lines `#232C38`, gap 12); passkey button (height 48, radius 14, border `1px #2E3846`, bg `#151B24`, 600 15px, key icon in accent) — shown when `authPasskey` flag on. Validation & messages per Part 2 §6.5; each error bumps `shakeKey`. Enter submits; no double submit.
13. **`RunePad.vue`** + **`HeroCodeForm.vue`** — exactly Part 2 §6.8 and Appendix B: 224×216 box centered; dashed polyline under the buttons (accent, width 3, round caps/joins, `stroke-dasharray: 2 7`, opacity .8); 68×72 buttons with hex polygon `34,3 64,19.5 64,52.5 34,69 4,52.5 4,19.5` (fill `#141A23`/`#22374D`, stroke `#33404F`/accent, 2px, transition fill/stroke .15s, hover stroke `#9CCBF0`, active scale .94), glyph group `translate(22 24)` stroke `#B4C3D3`/`#F2F6FA` 1.8; order badge 20px white circle `#0B1520` 700 11px at `right 2, top 2`. Progress: 4 dots 12px gap 10 (accent/`#2A3340`) + "Start over" (min-height 44, `#9CCBF0` 500 14px). Hero chips at top (required). 4th rune → submit via adapter, show "Checking your runes…" (14px `#9CCBF0`, centered). Test ids `auth-rune-{id}`, `auth-rune-reset`.
14. **`HeroTokenPreview.vue`** — box: flex gap 16, padding 14, radius 16, bg `#0F141B`, border `1px #222B37`; 64px token SVG (polygon `32,2 58,17 58,47 32,62 6,47 6,17`, fill `#1A2330`, stroke grade color 2.5 with `transition: stroke .3s`, initial Cinzel 700 24px at y=41, `filter: drop-shadow(0 0 10px <glow>)` glow = grade color when 4/4 else transparent, `transition: filter .3s`); name Cinzel 600 20px ellipsis ("Your hero" fallback), "Grade N riddles" 13px `#9AA6B6`; forge row: 4 hexes 14×16 (polygon `7,1 13,4.5 13,11.5 7,15 1,11.5 1,4.5`, fill grade color/transparent, stroke grade color/`#3A4452` 1.2, transition fill .2s) + label 12px `#9AA6B6` "n / 4" → "Ready!", `role="img"` aria-label.
15. **`PasswordStrength.vue`** — 4-column grid gap 4, segments 4px tall radius 2 (transition background .2s) + label 12px/600, min-width 64, right-aligned, in score color. Test id `auth-strength`.
16. **`GradePicker.vue`** — `<fieldset>` + `<legend>` (13px/500 `#C9D3DE`, margin-bottom 8); 4-column grid gap 8; buttons min-height 44, radius 12, border grade color when selected else `#2A3340`, bg `#22374D`/`#151B24`, 600 15px; `aria-pressed`. Default 4. Test ids `auth-grade-{n}`.
17. **`SignUpForm.vue`** — order: token preview (if `authGuardianSignup` flag), hero name (maxlength 20 + helper), password (+ strength), grade picker (flag), guardian email (flag, + helper), alert, primary "Create hero" (ready = forge 4/4; loading "Forging your hero…"). Validation order and messages per Part 2 §6.7. With the flag off, only name + password + strength are shown and the existing create-account call is used.
18. **`SuccessPanel.vue`** — centered column gap 18, padding `24px 0`, rise animation: 64px hex-check icon (accent, stroke 1.4), "Welcome, {name}!" Cinzel 600 28px, "Unfolding your map…" 15px `#B4BFCC`, 6px progress bar (track `#222B37`, fill accent, fill animation). Then navigate (keep the existing post-login navigation; show the panel only if the session takes > 300ms, otherwise navigate immediately). Test id `auth-success`. No "Back to sign in (demo)" button in the real app.
19. **`AuthFooter.vue`** — top border `1px #1F2732`, padding-top 4; Terms · Privacy (12px, gap 14, padding-top 12) + language button (min-height 44, globe icon 16px, 600 12px `#C9D3DE`, shows current locale "EN"/"UA"). Test id `auth-lang`.
20. **`AuthCard.vue`** — `data-auth-card`; wide: `width 100%; max-width 440px; padding 32px; radius 22px; bg rgba(19,24,32,.86); border 1px #2A3340; box-shadow 0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04); backdrop-filter blur(14px); flex column gap 24`. Phone (bottom sheet): `flex:1; min-height:0; overflow-y:auto; padding 22px 20px 28px; radius 28px 28px 0 0; bg rgba(19,24,32,.92); border-top 1px #2A3340; box-shadow 0 -16px 40px rgba(0,0,0,.4); blur(14px); gap 22`. Content: success panel OR (tabs → active form with rise animation → footer).

### Step 6 — Auth adapter and feature flags

1. Create `apps/web/src/services/auth-gateway.ts` (or the repo's services folder) with an interface:
   ```ts
   export interface AuthGateway {
     signIn(input: { name: string; password: string; remember: boolean }): Promise<AuthResult>;
     signUp(input: {
       name: string;
       password: string;
       grade?: 2 | 3 | 4 | 5;
       guardianEmail?: string;
     }): Promise<AuthResult>;
     signInWithRunes(input: {
       name: string;
       runes: [string, string, string, string];
     }): Promise<AuthResult>;
     signInWithPasskey(input: { name?: string }): Promise<AuthResult>;
   }
   ```
   Implement `signIn`/`signUp` by delegating to the **existing** store/service calls (pass grade/guardian only if the API accepts them). Implement `signInWithRunes` / `signInWithPasskey` as `throw new AuthNotAvailableError()` until the backend exists; the UI shows the alert "This sign-in method isn't available yet." (add i18n key `auth.err.notAvailable`, UA: "Цей спосіб входу ще недоступний.").
2. Feature flags (use the repo's flag mechanism; if none, a small `auth-flags.ts` reading `import.meta.env`): `VITE_AUTH_HERO_CODE`, `VITE_AUTH_PASSKEY`, `VITE_AUTH_GUARDIAN_SIGNUP`. Default **true** in `.env.development`, **false** in `.env.production`. When `authHeroCode` is off, the tabs show 2 columns (Sign in / New hero) with the same thumb logic.
3. Map server errors: wrong credentials → `auth.err.credentials`; network → existing generic error.

### Step 7 — Layouts, view, routing

- `AuthLayoutWide.vue`: root `min-height:100vh; position:relative; overflow:hidden; bg #0B0E13; color #E6EBF2; Inter; display:flex; flex-wrap:wrap; align-items:stretch` → `AuthBackground` → `AuthBrandPanel` → right section (`flex: 1 1 480px; min-width:0; padding 48px 24px; flex center`) with `AuthCard`. Tablet portrait wraps naturally (brand on top) — verify at 768×1024.
- `AuthLayoutPhone.vue`: root `100dvh` (fallback `100vh`), flex column, overflow hidden → `AuthBackground` (phone glow) → header (`padding 36px 24px 18px`, centered, gap 8: emblem sm, wordmark Cinzel 700 30px .08em, tagline phone) → `AuthCard` as bottom sheet.
- `LoginView.vue`: owns form state via a small local composable `useAuthForm()` (mode, fields, focus, show, remember, caps, error, shakeKey, loading, runes, grade, guardian) and passes props/events down; picks layout with `useBreakpoint()`; the **same** form components are used by both layouts.
- Wire `LoginView` to the existing login route; keep the router guard; replace the old create-account route with redirect to the login route in "New hero" mode (`?mode=new`), and support `?mode=code`.
- Desktop: autofocus hero name (or password if a recent hero is selected). Phone: no autofocus.

### Step 8 — i18n

Add every key from Part 2 §7 (EN + UA) plus `auth.err.notAvailable`. If the repo has no i18n, add `vue-i18n` with `en` and `uk` locales, locale persisted in localStorage, language button toggles EN ↔ UA. Check UA at 320px width: tabs may wrap to 2 lines — allow it (`line-height 1.2`, min-height 40 stays).

### Step 9 — Playwright e2e

Following `hexoflat-e2e`: add `AuthPage` page object + components (`ModeTabs`, `SignInForm`, `SignUpForm`, `RunePad`). Cover Part 2 §10 scenarios plus: tab thumb moves (aria-pressed), eye toggle keeps focus in the password input, Caps Lock warning (press CapsLock), rune pad numbering and reset, flags-off build hides code tab/passkey/guardian fields, phone viewport 390×844 shows bottom sheet and no brand feature list, reduced-motion emulation (`page.emulateMedia({ reducedMotion: 'reduce' })`) shows no running animations. Keep Step 1 characterization tests green.

### Step 10 — Visual parity check

1. Run the dev server. Compare against the prototype at **1440×900**, **768×1024** and **390×844** in these states: empty sign-in; filled sign-in (ready glow); error (alert + shake); loading; success; hero code with 2 runes picked; new hero empty; new hero 4/4 ready; UA locale.
2. Fix any difference in spacing, size, color, radius, font, shadow or timing. Use the prototype source as the reference for exact values.
3. Check `prefers-reduced-motion` and keyboard-only navigation (visible focus on every control, order per Part 2 §8).

### Definition of done

- All acceptance criteria in Part 2 §11 met, with the overrides above (all three modes built; Phase B/C behind flags, ON in dev).
- Typecheck, lint (no ratchet regressions), Vitest and Playwright all green; Step 1 tests still green.
- No changes to engine, auth API contracts or session persistence semantics.
- Nothing committed.

### Report back to the user (in Ukrainian)

A short summary: files added/changed (grouped), what is behind which flag, what backend work is still needed for Hero code / passkey / guardian sign-up, any deviation from the prototype and why, and the commands to run the tests.

---

## PART 2 — Design & behavior spec

> **Who reads this:** Claude Code working in the game repo (currently named `hexoflat`; the game's product name is **Path of Will**).
> **What it is:** a complete, self-contained brief for replacing the current login screen. It contains the design decisions, exact tokens, every interactive behavior with numbers, copy (EN + UA), accessibility rules, tests, acceptance criteria, and — in Appendix B — the full source of the working interactive prototype to use as the visual/behavioral reference.

---

## 0. Working rules for this task

- Work on the task branch the user has created for this. Do not create branches yourself. **Do not commit** — the user commits.
- This is a **visual + interaction redesign of the login route only**. Do not change auth endpoints, token handling or session persistence in Phase A.
- Follow the repo's own skills/conventions: `hexoflat-web-state` (where state lives), `hexoflat-e2e` (Playwright, `data-testid`, no raw selectors), `hexoflat-phase` (one phase per chat, characterization tests first).
- Known bug class to avoid: shared auth-result handlers in `user-store.ts` must **not** unconditionally clear persisted client state — `restoreSession()` is a continuation of the same session. Any new "remember me" wiring must respect this.
- First step: locate the current login view/route, the user/auth store and the existing "Remember me" + "Create account" wiring, and list them back before editing.

---

## 1. Goal

Replace the current screen (a big centered hexagon with username, password, Show, Remember me, PLAY, Create account) with a modern, game-like, kid-friendly sign-in that:

1. Keeps the brand: dark ground, cool blue hex lines, Cinzel display type, the **hex robot emblem with the red heart**.
2. Feels alive: the emblem reacts to the player, the hex field reacts to the pointer, transitions are smooth — without hurting accessibility or performance.
3. Fits the audience: primary players are children (grade 2–5 riddles). Clear labels, big touch targets, no real names, a grown-up in the loop at sign-up.
4. Works on desktop, tablet and phone with **shared state/components and separate layouts**.

---

## 2. Scope & phases

| Phase | What                                                                                                                                                                                                                                                                                                                                                | Backend needed?                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **A** | New layout, tokens, emblem + all dynamic elements, Sign in tab (hero name, password, show/hide, Caps Lock warning, keep me signed in, inline errors, loading/success states), Recent heroes on this device, language switch EN/UA, mobile bottom-sheet layout. "New hero" tab wired to the **existing** create-account flow (name + password only). | No (uses current auth)                                     |
| **B** | "New hero" extras: school grade picker (2–5), parent/guardian email + confirmation, forge-progress meter, live hero token preview.                                                                                                                                                                                                                  | Yes: grade + guardian email on account, confirmation email |
| **C** | "Hero code" tab (4-rune picture password for kids) and "Sign in with a passkey" (WebAuthn).                                                                                                                                                                                                                                                         | Yes: rune-code credential, WebAuthn endpoints              |

Phase B/C UI must be behind a feature flag (or simply not rendered) until the backend exists. Never show a button that does nothing.

---

## 3. Design tokens

Define once (CSS custom properties on `:root` or the app's theme file) and reuse:

```css
:root {
  /* ground & surfaces */
  --pow-bg: #0b0e13; /* page */
  --pow-surface: rgba(19, 24, 32, 0.86); /* auth card, with backdrop-filter: blur(14px) */
  --pow-surface-solid: #131820;
  --pow-field: #0f141b; /* inputs, segmented track */
  --pow-chip: #151b24;
  --pow-chip-hover: #1e2631;
  --pow-selected: #243041; /* segmented thumb */
  --pow-selected-2: #22374d; /* picked rune / grade */
  /* lines */
  --pow-border: #2a3340;
  --pow-border-field: #2e3846;
  --pow-divider: #1f2732;
  --pow-lattice: #6f8ba8; /* background hex grid, used at 16% opacity */
  /* text */
  --pow-text-strong: #f2f6fa;
  --pow-text: #e6ebf2;
  --pow-text-2: #c9d3de;
  --pow-text-3: #b4bfcc;
  --pow-text-muted: #9aa6b6; /* ≥4.5:1 on surface */
  --pow-placeholder: #7f8a99;
  /* brand */
  --pow-accent: #7fb8e6; /* ice blue — primary button, focus, highlights */
  --pow-accent-ink: #0b1520; /* text on accent */
  --pow-link: #9ccbf0;
  --pow-heart: #e5484d;
  --pow-emblem-line: #e9f2fb;
  /* feedback */
  --pow-error-text: #ff9ea2;
  --pow-error-bg: rgba(229, 72, 77, 0.12);
  --pow-error-border: rgba(229, 72, 77, 0.4);
  --pow-warning: #f5c46b;
  /* password strength 1..4 */
  --pow-strength-1: #e5484d;
  --pow-strength-2: #f5a524;
  --pow-strength-3: #7fb8e6;
  --pow-strength-4: #5fd4a0;
  /* grade / hero colors (token outline) */
  --pow-grade-2: #8fd3b6;
  --pow-grade-3: #f2c46d;
  --pow-grade-4: #7fb8e6;
  --pow-grade-5: #c9a7f0;
  /* shape */
  --pow-radius-card: 22px;
  --pow-radius-btn: 14px;
  --pow-radius-field: 12px;
  --pow-radius-chip: 12px;
  /* focus ring */
  --pow-focus: 0 0 0 3px rgba(127, 184, 230, 0.22);
}
```

Alternative accent options the prototype offers (pick one, keep one): `#7FB8E6` (default), `#8FD3B6`, `#C9A7F0`, `#F2C46D`.

**Type**

- Display: **Cinzel** 600/700 (already used in the game's tabs). Wordmark `clamp(40px, 5vw, 64px)`, letter-spacing `0.08em`. Card titles 28px desktop / 24px mobile.
- UI/body: **Inter** 400/500/600/700. Body 15px, labels 13px/500, helper 12px, section label 12px/600 uppercase `0.06em`.
- Self-host both fonts (no runtime Google Fonts request in production).

**Sizes**: inputs 48px tall; primary button 52px; secondary 48px; every tap target ≥ 44×44px.

---

## 4. Layout

### Desktop / tablet (≥ 1024px, and tablet landscape)

Two columns that wrap (flex-wrap):

- **Left (brand) column** `flex: 1 1 520px`, vertically centered, padding `64px clamp(24px, 6vw, 96px)`: emblem (152×167) → wordmark "Path of Will" → rotating tagline + its dots → three feature lines with line icons.
- **Right (auth) column** `flex: 1 1 480px`, centered: the auth card, `max-width: 440px`, padding 32px, radius 22px, translucent surface + blur, 1px border, deep shadow.
- Background layers (absolute, behind everything, `pointer-events: none`): hex lattice, cursor spotlight lattice, soft radial glow behind the emblem, click ripples.

### Tablet portrait (600–1023px)

Columns wrap naturally: brand block on top (keep emblem 120–152px), card below, both centered, max-width 440px.

### Phone (< 600px)

Separate layout component (shared children):

- Header: emblem 84×92, wordmark 30px, one-line rotating tagline (14px). No feature list, no tagline dots.
- Auth card becomes a **bottom sheet**: fills remaining height, radius `28px 28px 0 0`, top border only, internal scroll (`overflow-y: auto`), padding `22px 20px 28px`.
- No pointer spotlight/gaze from hover (touch has no hover); taps on the header still ripple; eyes still react to focus/typing.

---

## 5. Component structure (Vue 3 + TS)

Suggested split — adapt names to repo conventions:

```
views/LoginView.vue                // picks layout by breakpoint, owns nothing but layout choice
components/auth/
  AuthLayoutDesktop.vue            // two-column shell
  AuthLayoutMobile.vue             // header + bottom sheet shell
  AuthBackground.vue               // lattice + spotlight + glow + ripples
  WillEmblem.vue                   // SVG emblem; props: gaze {x,y}, eyesClosed, heartRate, shakeKey
  TaglineCarousel.vue
  AuthCard.vue                     // mode tabs + active form + footer
  AuthModeTabs.vue                 // segmented control with sliding thumb
  SignInForm.vue
  RecentHeroes.vue
  HeroCodeForm.vue  + RunePad.vue  // Phase C
  SignUpForm.vue                   // Phase A minimal, Phase B extras
  HeroTokenPreview.vue             // Phase B
  PasswordStrength.vue
  GradePicker.vue                  // Phase B
  LanguageSwitch.vue
composables/
  usePointerGaze.ts                // rAF-throttled pointer → {mx,my,gazeX,gazeY}
  useEmblemMood.ts                 // derives eyes/heart/shake from form focus/state
  usePrefersReducedMotion.ts
  usePasswordStrength.ts           // pure scoring fn + reactive wrapper
```

State placement:

- Form fields, focus, mode, ripples, tagline index → **component/composable local** (UI-only).
- Auth calls, session, "remember me" persistence → the **existing user/auth store**.
- Recent heroes on this device → small persisted list (name + color only, never passwords), owned by the auth store or a dedicated composable over localStorage; wrap storage access in try/catch.
- The emblem gets everything via props so it stays dumb and reusable (it can later appear on loading screens).

---

## 6. Behavior spec — every interactive element

### 6.1 Will emblem (hex robot)

SVG in Appendix A. Viewbox `0 0 200 220`. Glow: `drop-shadow(0 0 14px rgba(190,220,255,.45))`.

| Trigger                                   | Reaction                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pointer moves (desktop)                   | Both eye-hexes translate toward the pointer. Vector from emblem center (x = 50% width, y = 39% height) to pointer, normalized; offset = `dir * (4.5, 3.5)` units × `min(1, distance/220)`. Transition `transform .14s ease-out`. Pointer leaves page → eyes return to 0,0. |
| Hero-name field focused                   | Eyes look down at the text and "read along": `x = -4 + min(len,18)/18 * 8`, `y = 3`.                                                                                                                                                                                       |
| Password field focused & hidden           | Eyes **close** (two curved lid lines replace the eye hexes, opacity swap 80ms).                                                                                                                                                                                            |
| Password shown (eye toggle) while focused | Eyes open and peek to the right (`x = 4.5, y = 2`).                                                                                                                                                                                                                        |
| Sign-up password focused                  | Eyes closed.                                                                                                                                                                                                                                                               |
| Idle                                      | Random-feel blink: every 4.3s eyes close for 140ms.                                                                                                                                                                                                                        |
| Heart                                     | Pulse animation (scale 1→1.12, opacity .88→1). Duration 2.4s idle, 1.5s while any field focused, 0.5s while loading.                                                                                                                                                       |
| Validation error                          | Whole emblem shakes once (0.45s, ±8px with slight rotation). Each new error must retrigger (alternate two identical keyframe classes, or bump a `key`).                                                                                                                    |
| Always                                    | Gentle float: translateY 0 → -6px → 0 over 6s.                                                                                                                                                                                                                             |

### 6.2 Background hex field

- Base lattice: pointy-top hex pattern tile `60×104`, path `M30 0 L60 17.3 L60 52 L30 69.3 L0 52 L0 17.3 Z M30 69.3 L30 104`, stroke `--pow-lattice` 1px, layer opacity 16%. Slow drift: translate (0,0) → (-30px,-52px), 40s, linear, alternate.
- **Pointer spotlight:** a second identical lattice layer, stroke = accent, 1.4px, opacity .85, masked with `radial-gradient(circle 190px at <pointer>, #000, transparent)` (`mask-image` + `-webkit-mask-image`). Effect: hexes near the cursor light up in accent. Hidden when pointer leaves.
- Soft radial glow (accent at 16% → 0 at 65%) behind the emblem, 640px circle.
- **Click/tap ripple:** pointer-down anywhere _outside the auth card_ spawns a 120px hex outline (accent, 2px) at the point, animating scale .2→2.2 and opacity .9→0 over 0.9s, then removed. Keep at most 6 alive.

### 6.3 Tagline carousel

Three lines, rotate every 5s with a 0.5s fade-up; `aria-live="polite"`. Dots below (desktop only): active dot is a 24×6 pill in accent, others 8×6 in `#3A4452`; each dot is a 28×28 button that jumps to that line and restarts the timer. Pause rotation when the tab is hidden.

1. "Every step takes Will. Spend it wisely."
2. "Every riddle you solve makes your hero stronger."
3. "Friends can join your adventure at any time."

### 6.4 Mode tabs (segmented control)

Three equal segments in a 4px-padded track (`--pow-field`, 1px border, radius 14). A single **thumb** (`--pow-selected`, radius 10) slides under the active segment: `transition: left .25s cubic-bezier(.3,.7,.2,1)`. Active label `--pow-text-strong`, inactive `--pow-text-muted`. Buttons with `aria-pressed`. Switching mode clears the error and any half-entered rune sequence. Phase A shows only the tabs that are live (if only Sign in + New hero, use 2 columns).

### 6.5 Sign in form

- Title "Welcome back", subtitle "Your hero is waiting where you left off."
- **Recent on this device** (only if the list is non-empty): chips with a 32px hex avatar (initial in Cinzel, outline in the hero's color) + name. Tapping fills the hero name. Selected chip border = accent. Max 3 chips; offer "Not you?" removal later if needed.
- Hero name: label above, placeholder "e.g. StarFox42", `autocomplete="username"`.
- Password: label + "Forgot it?" link on the same row; input with a 44×40 icon button inside on the right (eye / eye-off), `aria-label` "Show password"/"Hide password". The button must **not steal focus** from the input (prevent default on pointerdown). `autocomplete="current-password"`.
- Caps Lock: on keyup read `getModifierState('CapsLock')`; show "Caps Lock is on" in `--pow-warning` under the field.
- "Keep me signed in": a real `role="switch"` button with `aria-checked`, 40×24 track (accent when on), 18px knob sliding `left 3px → 19px`. Default **on**. Maps to the existing Remember-me behavior.
- Errors: one inline alert block (`role="alert"`) above the button; clear it as soon as the user edits any field. Messages: empty name → "Enter your hero name to continue."; empty password → "Enter your password."; wrong credentials → "That hero name and password don't match." (never say which one is wrong). Error also triggers the emblem shake.
- Primary button "Enter the world": accent background, `--pow-accent-ink` text 16px/700. When both fields have content it gains a stronger glow (`0 0 0 4px rgba(127,184,230,.18), 0 10px 30px rgba(127,184,230,.35)`) — a small "ready" signal. Loading: spinner + "Opening the gates…", button disabled, heart beats fast.
- Divider "or" + secondary "Sign in with a passkey" (Phase C only).
- Submit on Enter. Prevent double submit.

### 6.6 Success state

Card content cross-fades to: hex check icon (64px, accent), "Welcome, {name}!", "Unfolding your map…", a 6px progress bar that fills over 1.6s. In the real app, navigate to the game as soon as the session is ready; the bar is only shown if loading takes >300ms.

### 6.7 New hero form

Phase A (existing flow): Hero name (+ helper "Friends will see this name. Don't use your real name.", maxlength 20), Password with strength meter, "Create hero".
Phase B adds:

- **Live hero token preview** at the top of the form: 64px hex token, outline color = selected grade color, initial of the typed name (or "?"), name in Cinzel (or "Your hero"), "Grade N riddles". When all steps are done the token gets a glow in its color.
- **Forge progress:** four small hexes (name ✓, strong-enough password ✓, grade ✓ (always), guardian email valid ✓) that fill in the grade color, + label "n / 4" → "Ready!". When 4/4 the Create button gets the "ready" glow.
- **School grade** picker: 4 equal buttons 2/3/4/5 (`aria-pressed`), selected border = that grade's color. Legend: "School grade — sets your first riddles". Default 4.
- **Parent or guardian email**: helper "A grown-up confirms the account and sees progress reports." Validation: "Add a grown-up's email so they can confirm."
- Password strength (pure function, unit-test it):
  ```ts
  export function passwordScore(p: string): 0 | 1 | 2 | 3 | 4 {
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) s++;
    if (p.length > 0 && p.length < 8) s = Math.min(s, 1);
    return s as 0 | 1 | 2 | 3 | 4;
  }
  // labels: 1 Weak, 2 Okay, 3 Strong, 4 Legendary; require ≥ 2 to submit
  ```
  Meter = 4 segments (4px tall, 4px gap) filled in the score's color; label right-aligned in that color.
- Loading label: "Forging your hero…".

### 6.8 Hero code (Phase C — picture password for kids)

- Title "Hero code", subtitle "No typing needed — pick your hero, then tap your 4 secret runes in order."
- Step 1: choose the hero from the Recent chips (required; otherwise error "First choose who is playing.").
- Step 2: **RunePad** — 7 hex buttons (68×72) in a hex cluster (center + 6 around) inside a 224×216 box. Positions (top-left of each button): center (78,72); (137,38) (137,106) (78,140) (19,106) (19,38) (78,4). Runes (24px stroke icons, original): Star, Moon, Leaf, Flame, Drop, Bolt, Sun — paths in Appendix B.
- Tapping a rune: fills it (`--pow-selected-2`, accent outline, white glyph), shows its order number in a 20px white badge, and draws a **dashed accent line** connecting the picked runes in order (like a constellation). Already-picked runes ignore taps. Four progress dots under the pad + "Start over" button. 4th rune → auto-submit, "Checking your runes…".
- `aria-label` per rune: "Star rune" / "Star rune, chosen 2". Progress dots have `role="img"` and label "n of 4 runes chosen".
- Security note for backend: rate-limit and lock after N wrong codes; this is a convenience login for kids on a trusted device, so it should only be offered for heroes in the device's Recent list.

### 6.9 Footer

Terms · Privacy links (12px) and a language button (globe icon + "EN"/"UA", 44px tall) that switches the app locale.

---

## 7. Copy — EN / UA (i18n keys)

| key                             | EN                                                                        | UA                                                                             |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| auth.tagline.1                  | Every step takes Will. Spend it wisely.                                   | Кожен крок потребує Волі. Витрачай її мудро.                                   |
| auth.tagline.2                  | Every riddle you solve makes your hero stronger.                          | Кожна розгадана загадка робить твого героя сильнішим.                          |
| auth.tagline.3                  | Friends can join your adventure at any time.                              | Друзі можуть приєднатися до пригоди будь-коли.                                 |
| auth.feature.map                | Explore a new hex map on every run                                        | Нова гекс-мапа в кожній пригоді                                                |
| auth.feature.riddles            | Solve riddles to level up your hero                                       | Розгадуй загадки й прокачуй героя                                              |
| auth.feature.friends            | Team up with friends — join any adventure                                 | Грай із друзями — приєднуйся до будь-якої пригоди                              |
| auth.tab.signin                 | Sign in                                                                   | Увійти                                                                         |
| auth.tab.code                   | Hero code                                                                 | Код героя                                                                      |
| auth.tab.new                    | New hero                                                                  | Новий герой                                                                    |
| auth.signin.title               | Welcome back                                                              | З поверненням                                                                  |
| auth.signin.subtitle            | Your hero is waiting where you left off.                                  | Твій герой чекає там, де ти зупинився.                                         |
| auth.recent                     | Recent on this device                                                     | Недавні на цьому пристрої                                                      |
| auth.field.name                 | Hero name                                                                 | Ім'я героя                                                                     |
| auth.field.name.placeholder     | e.g. StarFox42                                                            | напр. ЗорянийЛис42                                                             |
| auth.field.password             | Password                                                                  | Пароль                                                                         |
| auth.field.password.placeholder | Your secret word                                                          | Твоє секретне слово                                                            |
| auth.forgot                     | Forgot it?                                                                | Забув?                                                                         |
| auth.password.show / hide       | Show password / Hide password                                             | Показати пароль / Сховати пароль                                               |
| auth.caps                       | Caps Lock is on                                                           | Увімкнено Caps Lock                                                            |
| auth.remember                   | Keep me signed in                                                         | Не виходити з акаунта                                                          |
| auth.signin.submit              | Enter the world                                                           | Увійти у світ                                                                  |
| auth.signin.loading             | Opening the gates…                                                        | Відчиняємо браму…                                                              |
| auth.or                         | or                                                                        | або                                                                            |
| auth.passkey                    | Sign in with a passkey                                                    | Увійти з ключем доступу                                                        |
| auth.err.name                   | Enter your hero name to continue.                                         | Введи ім'я героя, щоб продовжити.                                              |
| auth.err.password               | Enter your password.                                                      | Введи пароль.                                                                  |
| auth.err.credentials            | That hero name and password don't match.                                  | Ім'я героя та пароль не збігаються.                                            |
| auth.success.title              | Welcome, {name}!                                                          | Вітаємо, {name}!                                                               |
| auth.success.loading            | Unfolding your map…                                                       | Розгортаємо твою мапу…                                                         |
| auth.code.title                 | Hero code                                                                 | Код героя                                                                      |
| auth.code.subtitle              | No typing needed — pick your hero, then tap your 4 secret runes in order. | Нічого не треба друкувати — обери героя й натисни 4 свої таємні руни по черзі. |
| auth.code.restart               | Start over                                                                | Почати знову                                                                   |
| auth.code.checking              | Checking your runes…                                                      | Перевіряємо руни…                                                              |
| auth.err.pickHero               | First choose who is playing.                                              | Спершу обери, хто грає.                                                        |
| auth.new.title                  | Create your hero                                                          | Створи свого героя                                                             |
| auth.new.name.placeholder       | Pick something fun                                                        | Вигадай щось цікаве                                                            |
| auth.new.name.help              | Friends will see this name. Don't use your real name.                     | Це ім'я бачитимуть друзі. Не використовуй справжнє ім'я.                       |
| auth.new.password.placeholder   | At least 8 characters                                                     | Щонайменше 8 символів                                                          |
| auth.strength.1..4              | Weak · Okay · Strong · Legendary                                          | Слабкий · Нормальний · Надійний · Легендарний                                  |
| auth.new.grade                  | School grade — sets your first riddles                                    | Клас у школі — від нього залежать перші загадки                                |
| auth.new.grade.short            | Grade {n} riddles                                                         | Загадки {n} класу                                                              |
| auth.new.guardian               | Parent or guardian email                                                  | Email батьків або опікуна                                                      |
| auth.new.guardian.help          | A grown-up confirms the account and sees progress reports.                | Дорослий підтверджує акаунт і бачить звіти про прогрес.                        |
| auth.new.submit                 | Create hero                                                               | Створити героя                                                                 |
| auth.new.loading                | Forging your hero…                                                        | Куємо твого героя…                                                             |
| auth.new.ready                  | Ready!                                                                    | Готово!                                                                        |
| auth.err.newName                | Choose a hero name.                                                       | Обери ім'я героя.                                                              |
| auth.err.weak                   | Make the password a little stronger.                                      | Зроби пароль трохи надійнішим.                                                 |
| auth.err.guardian               | Add a grown-up's email so they can confirm.                               | Додай email дорослого, щоб він підтвердив акаунт.                              |
| auth.footer.terms / privacy     | Terms / Privacy                                                           | Умови / Конфіденційність                                                       |

UA strings are longer — check that the tabs, buttons and chips don't overflow at 320px width (allow tab labels to wrap to 2 lines or reduce to 12px).

---

## 8. Accessibility (must-haves)

- Real `<form>`, `<label for>`, `<input>`, `<button>`; no clickable divs.
- Visible focus everywhere: inputs → accent border + `--pow-focus` ring; buttons/chips/runes → `outline: 2px solid accent; outline-offset: 3px` on `:focus-visible`.
- Contrast: all text ≥ 4.5:1 on its surface (tokens above are chosen to pass; re-check if you change the accent).
- Emblem: `role="img"` with label "Path of Will emblem"; all decorative SVG `aria-hidden="true"`; background layers `aria-hidden`.
- Errors in `role="alert"`; tagline `aria-live="polite"`.
- `prefers-reduced-motion: reduce` → disable drift, float, heart pulse, shake, ripples, fades, tab-thumb slide and pointer gaze (eyes stay centered; closing on password focus may stay since it's a state change, not motion).
- Touch targets ≥ 44px. Keyboard: Tab order = tabs → recent chips → name → password → eye toggle → switch → submit → passkey → footer.
- Never auto-focus on mobile (keyboard would cover the sheet); on desktop auto-focus the hero-name field (or password if a recent hero is preselected).

---

## 9. Performance

- Pointer handling: one `pointermove` listener on the page root, **throttled with requestAnimationFrame**; compute gaze from the emblem's cached `getBoundingClientRect()` (recompute on resize/scroll only).
- Spotlight is a pure CSS mask — no per-hex DOM nodes.
- Only animate `transform`/`opacity`.
- Pause the tagline interval and blink timer on `visibilitychange` hidden; clear all timers on unmount.
- No pointer effects for `pointerType === 'touch'` except ripples.
- Lattice as an inline SVG `<pattern>` (or a CSS background SVG) — no images.

---

## 10. Tests

**Vitest (unit):** `passwordScore` table test; rune selection reducer (no duplicates, max 4, auto-submit at 4, reset on mode change); gaze math (center → 0,0; far pointer → clamped magnitude); emblem mood derivation (focus/show/loading → eyesClosed/heartRate).

**Playwright (e2e, per `hexoflat-e2e` architecture — Page Object + Component layers, `data-testid` only):** add test ids:
`auth-mode-signin`, `auth-mode-code`, `auth-mode-new`, `auth-recent-hero`, `auth-name`, `auth-password`, `auth-password-toggle`, `auth-remember`, `auth-error`, `auth-submit`, `auth-passkey`, `auth-success`, `auth-new-name`, `auth-new-password`, `auth-strength`, `auth-grade-{n}`, `auth-guardian-email`, `auth-new-submit`, `auth-rune-{id}`, `auth-rune-reset`, `auth-lang`.
Scenarios: empty submit shows name error; wrong credentials show credentials error; success navigates to game; remember-me on/off persists/does not persist across reload (and does **not** break `restoreSession`); show/hide toggles input type without losing focus; mobile viewport renders the bottom sheet; reduced-motion run has no running animations.

---

## 11. Acceptance criteria

- [ ] Brand: name "Path of Will", Cinzel wordmark, emblem with red heart, dark/ice-blue palette from §3.
- [ ] Desktop two-column, tablet stacked, phone bottom-sheet layouts, sharing the same form components.
- [ ] Emblem eyes follow pointer, read along while typing the name, close on hidden password, peek when shown, blink; heart rate reacts; shake on error.
- [ ] Hex lattice drifts; spotlight follows pointer; ripples on background tap.
- [ ] Segmented tabs with sliding thumb; only live modes shown.
- [ ] Sign in: recent heroes, show/hide, Caps Lock, keep-me-signed-in switch, inline errors, loading, success; existing auth unchanged.
- [ ] EN/UA strings via i18n keys; layout holds at 320px in UA.
- [ ] All a11y and reduced-motion rules in §8 pass; Lighthouse a11y ≥ 95.
- [ ] Unit + e2e tests from §10 green.
- [ ] Phase B/C UI hidden until their backend exists.

---

## Appendix A — Emblem SVG (Vue-ready)

```html
<svg
  role="img"
  aria-label="Path of Will emblem"
  viewBox="0 0 200 220"
  style="filter: drop-shadow(0 0 14px rgba(190,220,255,.45))"
>
  <!-- outer hex -->
  <polygon
    points="100,8 188,58 188,162 100,212 12,162 12,58"
    fill="#121820"
    stroke="#E9F2FB"
    stroke-width="5"
    stroke-linejoin="round"
  />
  <!-- head -->
  <polygon
    points="82,55 118,55 136,85 118,115 82,115 64,85"
    fill="#121820"
    stroke="#E9F2FB"
    stroke-width="4"
    stroke-linejoin="round"
  />
  <!-- eyes: translate this group by gaze (CSS transform px == user units) -->
  <g :style="{ transform: `translate(${gx}px, ${gy}px)`, transition: 'transform .14s ease-out' }">
    <g :style="{ opacity: eyesClosed ? 0 : 1 }">
      <polygon
        points="79,85 83.5,77.2 92.5,77.2 97,85 92.5,92.8 83.5,92.8"
        fill="none"
        stroke="#E9F2FB"
        stroke-width="3"
      />
      <polygon
        points="103,85 107.5,77.2 116.5,77.2 121,85 116.5,92.8 107.5,92.8"
        fill="none"
        stroke="#E9F2FB"
        stroke-width="3"
      />
    </g>
    <path
      :style="{ opacity: eyesClosed ? 1 : 0 }"
      d="M80 86 Q88 91 96 86 M104 86 Q112 91 120 86"
      fill="none"
      stroke="#E9F2FB"
      stroke-width="3"
      stroke-linecap="round"
    />
  </g>
  <!-- body -->
  <polyline
    points="44,176 70,124 130,124 156,176"
    fill="none"
    stroke="#E9F2FB"
    stroke-width="4"
    stroke-linejoin="round"
  />
  <!-- heart: transform-origin 100px 150px; animation duration = heartRate -->
  <path
    class="pow-heart"
    d="M100 164 L85 150 A9 9 0 0 1 100 138 A9 9 0 0 1 115 150 Z"
    fill="#E5484D"
  />
</svg>
```

Keyframes used by the prototype (copy as-is):

```css
@keyframes powDrift {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(-30px, -52px, 0);
  }
}
@keyframes powPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.88;
  }
  50% {
    transform: scale(1.12);
    opacity: 1;
  }
}
@keyframes powFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
@keyframes powShake {
  0%,
  100% {
    transform: none;
  }
  20% {
    transform: translateX(-8px) rotate(-3deg);
  }
  40% {
    transform: translateX(7px) rotate(2deg);
  }
  60% {
    transform: translateX(-5px);
  }
  80% {
    transform: translateX(3px);
  }
}
@keyframes powRipple {
  from {
    transform: scale(0.2);
    opacity: 0.9;
  }
  to {
    transform: scale(2.2);
    opacity: 0;
  }
}
@keyframes powRise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes powFill {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}
@keyframes powSpin {
  to {
    transform: rotate(360deg);
  }
}
.pow-heart {
  transform-origin: 100px 150px;
  animation: powPulse 2.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  /* disable all of the above */
}
```

---

## Appendix B — Full reference prototype (desktop/tablet)

This is the complete source of the interactive mockup the user approved. It is written in a small template format that maps almost 1:1 to Vue:

| Prototype                                                     | Vue 3                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `{{ value }}`                                                 | `{{ value }}` / `:attr="value"`                              |
| `<sc-if value="{{x}}">`                                       | `v-if="x"`                                                   |
| `<sc-for list="{{items}}" as="it">`                           | `v-for="it in items"` (add `:key`)                           |
| `onClick="{{fn}}"`, `onInput`, `onPointerMove`…               | `@click="fn"`, `@input`, `@pointermove`…                     |
| `class Component extends DCLogic` + `this.state` / `setState` | `<script setup lang="ts">` with `ref`/`reactive`, `computed` |
| `renderVals()`                                                | computed values + functions exposed to the template          |
| `componentDidMount` / `componentWillUnmount`                  | `onMounted` / `onUnmounted`                                  |
| `<helmet><style>`                                             | scoped/global CSS                                            |
| `this.props.accent`                                           | the `--pow-accent` token                                     |

Do **not** copy the inline-style approach — move styles into the tokens/CSS of the real components. The mobile prototype is the same logic with the layout from §4 (Phone).

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Path of Will sign in</title>
    <script src="./support.js"></script>
  </head>
  <body>
    <x-dc>
      <helmet>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&amp;family=Inter:wght@400;500;600;700&amp;display=swap"
          rel="stylesheet"
        />
        <style>
          body {
            margin: 0;
            background: #0b0e13;
          }
          a {
            color: #9ccbf0;
          }
          a:hover {
            color: #cfe6f8;
          }
          .hx-input {
            transition:
              border-color 0.15s,
              box-shadow 0.15s;
          }
          .hx-input::placeholder {
            color: #7f8a99;
          }
          .hx-input:focus {
            outline: none;
            border-color: #7fb8e6;
            box-shadow: 0 0 0 3px rgba(127, 184, 230, 0.22);
          }
          .hx-btn {
            transition:
              filter 0.15s,
              transform 0.1s,
              box-shadow 0.25s;
          }
          .hx-btn:hover {
            filter: brightness(1.1);
          }
          .hx-btn:active {
            transform: translateY(1px);
          }
          .hx-btn:focus-visible,
          .hx-chip:focus-visible,
          .hx-rune:focus-visible {
            outline: 2px solid #7fb8e6;
            outline-offset: 3px;
          }
          .hx-chip {
            transition:
              background 0.15s,
              border-color 0.15s;
          }
          .hx-chip:hover {
            background: #1e2631;
          }
          .hx-rune .hx-hex {
            transition:
              fill 0.15s,
              stroke 0.15s;
          }
          .hx-rune:hover .hx-hex {
            stroke: #9ccbf0;
          }
          .hx-rune:active svg {
            transform: scale(0.94);
          }
          @keyframes hxDrift {
            from {
              transform: translate3d(0, 0, 0);
            }
            to {
              transform: translate3d(-30px, -52px, 0);
            }
          }
          @keyframes hxPulse {
            0%,
            100% {
              transform: scale(1);
              opacity: 0.88;
            }
            50% {
              transform: scale(1.12);
              opacity: 1;
            }
          }
          @keyframes hxSpin {
            to {
              transform: rotate(360deg);
            }
          }
          @keyframes hxFill {
            from {
              width: 0;
            }
            to {
              width: 100%;
            }
          }
          @keyframes hxRise {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: none;
            }
          }
          @keyframes hxFadeA {
            from {
              opacity: 0;
              transform: translateY(6px);
            }
            to {
              opacity: 1;
              transform: none;
            }
          }
          @keyframes hxFadeB {
            from {
              opacity: 0;
              transform: translateY(6px);
            }
            to {
              opacity: 1;
              transform: none;
            }
          }
          @keyframes hxShakeA {
            0%,
            100% {
              transform: none;
            }
            20% {
              transform: translateX(-8px) rotate(-3deg);
            }
            40% {
              transform: translateX(7px) rotate(2deg);
            }
            60% {
              transform: translateX(-5px);
            }
            80% {
              transform: translateX(3px);
            }
          }
          @keyframes hxShakeB {
            0%,
            100% {
              transform: none;
            }
            20% {
              transform: translateX(-8px) rotate(-3deg);
            }
            40% {
              transform: translateX(7px) rotate(2deg);
            }
            60% {
              transform: translateX(-5px);
            }
            80% {
              transform: translateX(3px);
            }
          }
          @keyframes hxRipple {
            from {
              transform: scale(0.2);
              opacity: 0.9;
            }
            to {
              transform: scale(2.2);
              opacity: 0;
            }
          }
          @keyframes hxFloat {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-6px);
            }
          }
          .hx-lattice {
            animation: hxDrift 40s linear infinite alternate;
          }
          .hx-heart {
            transform-origin: 100px 150px;
            animation: hxPulse 2.4s ease-in-out infinite;
          }
          .hx-float {
            animation: hxFloat 6s ease-in-out infinite;
          }
          .hx-spin {
            animation: hxSpin 0.8s linear infinite;
          }
          .hx-bar {
            animation: hxFill 1.6s ease-out forwards;
          }
          .hx-rise {
            animation: hxRise 0.35s ease-out;
          }
          .hx-fadeA {
            animation: hxFadeA 0.5s ease-out;
          }
          .hx-fadeB {
            animation: hxFadeB 0.5s ease-out;
          }
          .hx-shakeA {
            animation: hxShakeA 0.45s ease-in-out;
          }
          .hx-shakeB {
            animation: hxShakeB 0.45s ease-in-out;
          }
          .hx-ripple {
            transform-origin: 60px 60px;
            animation: hxRipple 0.9s ease-out forwards;
          }
          @media (prefers-reduced-motion: reduce) {
            .hx-lattice,
            .hx-heart,
            .hx-float,
            .hx-spin,
            .hx-bar,
            .hx-rise,
            .hx-fadeA,
            .hx-fadeB,
            .hx-shakeA,
            .hx-shakeB,
            .hx-ripple {
              animation: none;
            }
          }
        </style>
      </helmet>
      <div
        onPointerMove="{{onMove}}"
        onPointerLeave="{{onLeave}}"
        onPointerDown="{{onDown}}"
        style="min-height: 100vh; position: relative; overflow: hidden; background: #0B0E13; color: #E6EBF2; font-family: Inter, system-ui, sans-serif; display: flex; flex-wrap: wrap; align-items: stretch"
      >
        <div
          aria-hidden="true"
          class="hx-lattice"
          style="position: absolute; left: -60px; top: -60px; width: calc(100% + 120px); height: calc(100% + 160px); pointer-events: none"
        >
          <svg
            style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: 0.16"
          >
            <defs>
              <pattern id="hxgridA" width="60" height="104" patternUnits="userSpaceOnUse">
                <path
                  d="M30 0 L60 17.3 L60 52 L30 69.3 L0 52 L0 17.3 Z M30 69.3 L30 104"
                  fill="none"
                  stroke="#6F8BA8"
                  stroke-width="1"
                ></path>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hxgridA)"></rect>
          </svg>
          <svg
            style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: 0.85; -webkit-mask-image: radial-gradient(circle 190px at {{spotX}}px {{spotY}}px, #000 0%, rgba(0,0,0,0) 100%); mask-image: radial-gradient(circle 190px at {{spotX}}px {{spotY}}px, #000 0%, rgba(0,0,0,0) 100%)"
          >
            <defs>
              <pattern id="hxgridB" width="60" height="104" patternUnits="userSpaceOnUse">
                <path
                  d="M30 0 L60 17.3 L60 52 L30 69.3 L0 52 L0 17.3 Z M30 69.3 L30 104"
                  fill="none"
                  stroke="{{accent}}"
                  stroke-width="1.4"
                ></path>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hxgridB)"></rect>
          </svg>
        </div>
        <div
          aria-hidden="true"
          style="position: absolute; left: 6%; top: 50%; width: 640px; height: 640px; margin-top: -320px; border-radius: 50%; background: radial-gradient(circle, rgba(127,184,230,0.16) 0%, rgba(127,184,230,0) 65%); pointer-events: none"
        ></div>
        <sc-for list="{{ripples}}" as="rp" hint-placeholder-count="0">
          <svg
            aria-hidden="true"
            viewBox="0 0 120 120"
            style="position: absolute; left: {{rp.x}}px; top: {{rp.y}}px; width: 120px; height: 120px; pointer-events: none; overflow: visible"
          >
            <polygon
              class="hx-ripple"
              points="60,6 107,33 107,87 60,114 13,87 13,33"
              fill="none"
              stroke="{{accent}}"
              stroke-width="2"
            ></polygon>
          </svg>
        </sc-for>

        <section
          style="position: relative; flex: 1 1 520px; min-width: 0; box-sizing: border-box; padding: 64px clamp(24px, 6vw, 96px); display: flex; flex-direction: column; justify-content: center; gap: 28px"
        >
          <div class="{{shakeClass}}" style="width: 152px">
            <div class="hx-float">
              <svg
                data-emblem="1"
                role="img"
                aria-label="Path of Will emblem: a hex robot with a red heart"
                viewBox="0 0 200 220"
                style="width: 152px; height: 167px; display: block; filter: drop-shadow(0 0 14px rgba(190,220,255,0.45))"
              >
                <polygon
                  points="100,8 188,58 188,162 100,212 12,162 12,58"
                  fill="#121820"
                  stroke="#E9F2FB"
                  stroke-width="5"
                  stroke-linejoin="round"
                ></polygon>
                <polygon
                  points="82,55 118,55 136,85 118,115 82,115 64,85"
                  fill="#121820"
                  stroke="#E9F2FB"
                  stroke-width="4"
                  stroke-linejoin="round"
                ></polygon>
                <g style="transform: translate({{eyeT}}); transition: transform .14s ease-out">
                  <g style="opacity: {{openOp}}; transition: opacity .08s">
                    <polygon
                      points="79,85 83.5,77.2 92.5,77.2 97,85 92.5,92.8 83.5,92.8"
                      fill="none"
                      stroke="#E9F2FB"
                      stroke-width="3"
                    ></polygon>
                    <polygon
                      points="103,85 107.5,77.2 116.5,77.2 121,85 116.5,92.8 107.5,92.8"
                      fill="none"
                      stroke="#E9F2FB"
                      stroke-width="3"
                    ></polygon>
                  </g>
                  <g style="opacity: {{closedOp}}; transition: opacity .08s">
                    <path
                      d="M80 86 Q88 91 96 86 M104 86 Q112 91 120 86"
                      fill="none"
                      stroke="#E9F2FB"
                      stroke-width="3"
                      stroke-linecap="round"
                    ></path>
                  </g>
                </g>
                <polyline
                  points="44,176 70,124 130,124 156,176"
                  fill="none"
                  stroke="#E9F2FB"
                  stroke-width="4"
                  stroke-linejoin="round"
                ></polyline>
                <path
                  class="hx-heart"
                  style="animation-duration: {{beat}}s"
                  d="M100 164 L85 150 A9 9 0 0 1 100 138 A9 9 0 0 1 115 150 Z"
                  fill="#E5484D"
                ></path>
              </svg>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 14px">
            <p
              style="margin: 0; font-family: Cinzel, serif; font-weight: 700; font-size: clamp(40px, 5vw, 64px); letter-spacing: 0.08em; line-height: 1; color: #F2F6FA"
            >
              Path of Will
            </p>
            <p
              aria-live="polite"
              class="{{tipClass}}"
              style="margin: 0; max-width: 460px; min-height: 56px; font-size: 18px; line-height: 1.55; color: #B4BFCC"
            >
              {{tipText}}
            </p>
            <div style="display: flex; gap: 8px">
              <sc-for list="{{tipDots}}" as="td" hint-placeholder-count="3">
                <button
                  class="hx-chip"
                  type="button"
                  onClick="{{td.pick}}"
                  aria-label="{{td.aria}}"
                  style="width: 28px; height: 28px; padding: 0; border: 0; border-radius: 8px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center"
                >
                  <span
                    style="width: {{td.w}}px; height: 6px; border-radius: 3px; background: {{td.bg}}; display: block; transition: width .25s, background .25s"
                  ></span>
                </button>
              </sc-for>
            </div>
          </div>
          <ul
            style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; max-width: 460px"
          >
            <li
              style="display: flex; gap: 14px; align-items: center; font-size: 15px; color: #C9D3DE"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                style="width: 22px; height: 22px; flex: none"
                fill="none"
                stroke="#7FB8E6"
                stroke-width="1.6"
                stroke-linejoin="round"
              >
                <path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"></path>
                <path d="M12 7l4.3 2.5v5L12 17l-4.3-2.5v-5z"></path>
              </svg>
              Explore a new hex map on every run
            </li>
            <li
              style="display: flex; gap: 14px; align-items: center; font-size: 15px; color: #C9D3DE"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                style="width: 22px; height: 22px; flex: none"
                fill="none"
                stroke="#7FB8E6"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M13 2L4 14h7l-1 8 9-12h-7z"></path>
              </svg>
              Solve riddles to level up your hero
            </li>
            <li
              style="display: flex; gap: 14px; align-items: center; font-size: 15px; color: #C9D3DE"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                style="width: 22px; height: 22px; flex: none"
                fill="none"
                stroke="#7FB8E6"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="9" cy="8" r="3.5"></circle>
                <circle cx="17" cy="9.5" r="2.8"></circle>
                <path
                  d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M15.5 14.6c2.6-.3 5 1.3 5.8 4.4"
                ></path>
              </svg>
              Team up with friends — join any adventure
            </li>
          </ul>
        </section>

        <section
          style="position: relative; flex: 1 1 480px; min-width: 0; box-sizing: border-box; padding: 48px 24px; display: flex; align-items: center; justify-content: center"
        >
          <div
            data-card="1"
            style="width: 100%; max-width: 440px; box-sizing: border-box; padding: 32px; border-radius: 22px; background: rgba(19,24,32,0.86); border: 1px solid #2A3340; box-shadow: 0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04); backdrop-filter: blur(14px); display: flex; flex-direction: column; gap: 24px"
          >
            <sc-if value="{{done}}" hint-placeholder-val="{{ false }}">
              <div
                class="hx-rise"
                style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 18px; padding: 24px 0"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  style="width: 64px; height: 64px"
                  fill="none"
                  stroke="{{accent}}"
                  stroke-width="1.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"></path>
                  <path d="M8 12.2l2.7 2.6L16.2 9.4"></path>
                </svg>
                <h1
                  style="margin: 0; font-family: Cinzel, serif; font-size: 28px; font-weight: 600; color: #F2F6FA"
                >
                  Welcome, {{who}}!
                </h1>
                <p style="margin: 0; color: #B4BFCC; font-size: 15px">Unfolding your map…</p>
                <div
                  style="width: 100%; height: 6px; border-radius: 3px; background: #222B37; overflow: hidden"
                >
                  <div
                    class="hx-bar"
                    style="height: 6px; border-radius: 3px; background: {{accent}}"
                  ></div>
                </div>
                <button
                  class="hx-btn"
                  type="button"
                  onClick="{{reset}}"
                  style="min-height: 44px; padding: 0 18px; border-radius: 12px; border: 1px solid #2A3340; background: transparent; color: #C9D3DE; font: 500 14px Inter, sans-serif; cursor: pointer"
                >
                  Back to sign in (demo)
                </button>
              </div>
            </sc-if>

            <sc-if value="{{notDone}}" hint-placeholder-val="{{ true }}">
              <div style="display: flex; flex-direction: column; gap: 24px">
                <div
                  role="group"
                  aria-label="How do you want to sign in?"
                  style="position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 14px; background: #0F141B; border: 1px solid #222B37"
                >
                  <span
                    aria-hidden="true"
                    style="position: absolute; top: 4px; bottom: 4px; left: calc(4px + {{tabIndex}} * ((100% - 16px) / 3 + 4px)); width: calc((100% - 16px) / 3); border-radius: 10px; background: #243041; transition: left .25s cubic-bezier(.3,.7,.2,1)"
                  ></span>
                  <sc-for list="{{tabs}}" as="t" hint-placeholder-count="3">
                    <button
                      class="hx-btn"
                      type="button"
                      aria-pressed="{{t.selected}}"
                      onClick="{{t.pick}}"
                      style="position: relative; min-height: 40px; border: 0; border-radius: 10px; background: transparent; color: {{t.fg}}; font: 600 13px Inter, sans-serif; cursor: pointer"
                    >
                      {{t.label}}
                    </button>
                  </sc-for>
                </div>

                <sc-if value="{{isSignin}}" hint-placeholder-val="{{ true }}">
                  <form
                    class="hx-rise"
                    onSubmit="{{submit}}"
                    novalidate="novalidate"
                    style="display: flex; flex-direction: column; gap: 18px"
                  >
                    <div style="display: flex; flex-direction: column; gap: 6px">
                      <h1
                        style="margin: 0; font-family: Cinzel, serif; font-size: 28px; font-weight: 600; color: #F2F6FA"
                      >
                        Welcome back
                      </h1>
                      <p style="margin: 0; font-size: 15px; color: #9AA6B6">
                        Your hero is waiting where you left off.
                      </p>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 8px">
                      <p
                        style="margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #8E9AAA"
                      >
                        Recent on this device
                      </p>
                      <div style="display: flex; flex-wrap: wrap; gap: 8px">
                        <sc-for list="{{recent}}" as="h" hint-placeholder-count="2">
                          <button
                            class="hx-chip"
                            type="button"
                            onClick="{{h.pick}}"
                            aria-pressed="{{h.selected}}"
                            style="min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px 0 6px; border-radius: 12px; border: 1px solid {{h.border}}; background: #151B24; color: #E6EBF2; font: 500 14px Inter, sans-serif; cursor: pointer"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 32 32"
                              style="width: 32px; height: 32px"
                            >
                              <polygon
                                points="16,1 29,8.5 29,23.5 16,31 3,23.5 3,8.5"
                                fill="#223042"
                                stroke="{{h.color}}"
                                stroke-width="1.4"
                              ></polygon>
                              <text
                                x="16"
                                y="21"
                                text-anchor="middle"
                                font-family="Cinzel, serif"
                                font-size="13"
                                font-weight="700"
                                fill="#E6EBF2"
                              >
                                {{h.initial}}
                              </text>
                            </svg>
                            {{h.name}}
                          </button>
                        </sc-for>
                      </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 6px">
                      <label for="hx-user" style="font-size: 13px; font-weight: 500; color: #C9D3DE"
                        >Hero name</label
                      >
                      <input
                        id="hx-user"
                        class="hx-input"
                        type="text"
                        autocomplete="username"
                        placeholder="e.g. StarFox42"
                        value="{{user}}"
                        onInput="{{onUser}}"
                        onFocus="{{fUser}}"
                        onBlur="{{fBlur}}"
                        style="height: 48px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; border: 1px solid #2E3846; background: #0F141B; color: #F2F6FA; font: 400 15px Inter, sans-serif"
                      />
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 6px">
                      <div
                        style="display: flex; justify-content: space-between; align-items: baseline"
                      >
                        <label
                          for="hx-pass"
                          style="font-size: 13px; font-weight: 500; color: #C9D3DE"
                          >Password</label
                        >
                        <a href="#" style="font-size: 13px; text-decoration: none">Forgot it?</a>
                      </div>
                      <div style="position: relative">
                        <input
                          id="hx-pass"
                          class="hx-input"
                          type="{{passType}}"
                          autocomplete="current-password"
                          placeholder="Your secret word"
                          value="{{pass}}"
                          onInput="{{onPass}}"
                          onKeyUp="{{onKey}}"
                          onFocus="{{fPass}}"
                          onBlur="{{fBlur}}"
                          style="width: 100%; height: 48px; box-sizing: border-box; padding: 0 64px 0 14px; border-radius: 12px; border: 1px solid #2E3846; background: #0F141B; color: #F2F6FA; font: 400 15px Inter, sans-serif"
                        />
                        <button
                          class="hx-btn"
                          type="button"
                          onPointerDown="{{keepFocus}}"
                          onClick="{{toggleShow}}"
                          aria-label="{{showAria}}"
                          style="position: absolute; right: 4px; top: 4px; width: 44px; height: 40px; border: 0; border-radius: 9px; background: transparent; color: #9AA6B6; cursor: pointer; display: flex; align-items: center; justify-content: center"
                        >
                          <sc-if value="{{show}}" hint-placeholder-val="{{ false }}">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              style="width: 20px; height: 20px"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.7"
                              stroke-linecap="round"
                            >
                              <path
                                d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.5.9-1.6 2.4-3.1 3.7M6.6 7.6C4.6 8.9 3.1 10.8 2.5 12c1 1.8 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"
                              ></path>
                            </svg>
                          </sc-if>
                          <sc-if value="{{hide}}" hint-placeholder-val="{{ true }}">
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              style="width: 20px; height: 20px"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.7"
                            >
                              <path
                                d="M2.5 12C3.5 10.2 7 6 12 6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6z"
                              ></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          </sc-if>
                        </button>
                      </div>
                      <sc-if value="{{caps}}" hint-placeholder-val="{{ false }}">
                        <p style="margin: 0; font-size: 13px; color: #F5C46B">Caps Lock is on</p>
                      </sc-if>
                    </div>

                    <div
                      style="display: flex; align-items: center; justify-content: space-between; gap: 12px"
                    >
                      <button
                        class="hx-chip"
                        type="button"
                        role="switch"
                        aria-checked="{{remember}}"
                        onClick="{{toggleRemember}}"
                        style="min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 8px 0 0; border: 0; border-radius: 10px; background: transparent; color: #C9D3DE; font: 500 14px Inter, sans-serif; cursor: pointer"
                      >
                        <span
                          style="width: 40px; height: 24px; border-radius: 12px; background: {{switchBg}}; position: relative; display: block; transition: background .15s"
                        >
                          <span
                            style="position: absolute; top: 3px; left: {{knobLeft}}px; width: 18px; height: 18px; border-radius: 50%; background: #F2F6FA; transition: left .15s"
                          ></span>
                        </span>
                        Keep me signed in
                      </button>
                    </div>

                    <sc-if value="{{hasError}}" hint-placeholder-val="{{ false }}">
                      <p
                        role="alert"
                        style="margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(229,72,77,0.12); border: 1px solid rgba(229,72,77,0.4); color: #FF9EA2; font-size: 14px"
                      >
                        {{error}}
                      </p>
                    </sc-if>

                    <button
                      class="hx-btn"
                      type="submit"
                      disabled="{{loading}}"
                      style="height: 52px; border: 0; border-radius: 14px; background: {{accent}}; color: #0B1520; font: 700 16px Inter, sans-serif; letter-spacing: 0.02em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: {{signinGlow}}"
                    >
                      <sc-if value="{{loading}}" hint-placeholder-val="{{ false }}">
                        <svg
                          aria-hidden="true"
                          class="hx-spin"
                          viewBox="0 0 24 24"
                          style="width: 18px; height: 18px"
                          fill="none"
                          stroke="#0B1520"
                          stroke-width="2.4"
                          stroke-linecap="round"
                        >
                          <path d="M12 3a9 9 0 1 1-9 9"></path>
                        </svg>
                        Opening the gates…
                      </sc-if>
                      <sc-if value="{{idle}}" hint-placeholder-val="{{ true }}"
                        >Enter the world</sc-if
                      >
                    </button>

                    <div
                      style="display: flex; align-items: center; gap: 12px; color: #6F7B8B; font-size: 12px"
                    >
                      <span style="flex: 1; height: 1px; background: #232C38"></span>or<span
                        style="flex: 1; height: 1px; background: #232C38"
                      ></span>
                    </div>

                    <button
                      class="hx-btn"
                      type="button"
                      onClick="{{passkey}}"
                      style="height: 48px; border-radius: 14px; border: 1px solid #2E3846; background: #151B24; color: #E6EBF2; font: 600 15px Inter, sans-serif; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        style="width: 20px; height: 20px"
                        fill="none"
                        stroke="#7FB8E6"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="8" cy="12" r="4"></circle>
                        <path d="M12 12h9M18 12v3M21 12v2"></path>
                      </svg>
                      Sign in with a passkey
                    </button>
                  </form>
                </sc-if>

                <sc-if value="{{isRune}}" hint-placeholder-val="{{ false }}">
                  <div class="hx-rise" style="display: flex; flex-direction: column; gap: 18px">
                    <div style="display: flex; flex-direction: column; gap: 6px">
                      <h1
                        style="margin: 0; font-family: Cinzel, serif; font-size: 28px; font-weight: 600; color: #F2F6FA"
                      >
                        Hero code
                      </h1>
                      <p style="margin: 0; font-size: 15px; color: #9AA6B6">
                        No typing needed — pick your hero, then tap your 4 secret runes in order.
                      </p>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px">
                      <sc-for list="{{recent}}" as="h" hint-placeholder-count="2">
                        <button
                          class="hx-chip"
                          type="button"
                          onClick="{{h.pick}}"
                          aria-pressed="{{h.selected}}"
                          style="min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px 0 6px; border-radius: 12px; border: 1px solid {{h.border}}; background: #151B24; color: #E6EBF2; font: 500 14px Inter, sans-serif; cursor: pointer"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 32 32"
                            style="width: 32px; height: 32px"
                          >
                            <polygon
                              points="16,1 29,8.5 29,23.5 16,31 3,23.5 3,8.5"
                              fill="#223042"
                              stroke="{{h.color}}"
                              stroke-width="1.4"
                            ></polygon>
                            <text
                              x="16"
                              y="21"
                              text-anchor="middle"
                              font-family="Cinzel, serif"
                              font-size="13"
                              font-weight="700"
                              fill="#E6EBF2"
                            >
                              {{h.initial}}
                            </text>
                          </svg>
                          {{h.name}}
                        </button>
                      </sc-for>
                    </div>
                    <div
                      style="position: relative; width: 224px; height: 216px; align-self: center"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 224 216"
                        style="position: absolute; left: 0; top: 0; width: 224px; height: 216px; pointer-events: none"
                      >
                        <polyline
                          points="{{runePath}}"
                          fill="none"
                          stroke="{{accent}}"
                          stroke-width="3"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-dasharray="2 7"
                          opacity="0.8"
                        ></polyline>
                      </svg>
                      <sc-for list="{{runes}}" as="r" hint-placeholder-count="7">
                        <button
                          class="hx-rune"
                          type="button"
                          onClick="{{r.pick}}"
                          aria-label="{{r.aria}}"
                          style="position: absolute; left: {{r.x}}px; top: {{r.y}}px; width: 68px; height: 72px; padding: 0; border: 0; border-radius: 16px; background: transparent; cursor: pointer"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 68 72"
                            style="width: 68px; height: 72px; display: block; transition: transform .1s"
                          >
                            <polygon
                              class="hx-hex"
                              points="34,3 64,19.5 64,52.5 34,69 4,52.5 4,19.5"
                              fill="{{r.fill}}"
                              stroke="{{r.stroke}}"
                              stroke-width="2"
                              stroke-linejoin="round"
                            ></polygon>
                            <g transform="translate(22 24)">
                              <path
                                d="{{r.d}}"
                                fill="none"
                                stroke="{{r.ink}}"
                                stroke-width="1.8"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              ></path>
                            </g>
                          </svg>
                          <sc-if value="{{r.picked}}" hint-placeholder-val="{{ false }}">
                            <span
                              style="position: absolute; right: 2px; top: 2px; width: 20px; height: 20px; border-radius: 50%; background: #F2F6FA; color: #0B1520; font: 700 11px/20px Inter, sans-serif; text-align: center"
                              >{{r.order}}</span
                            >
                          </sc-if>
                        </button>
                      </sc-for>
                    </div>
                    <div
                      style="display: flex; align-items: center; justify-content: center; gap: 16px"
                    >
                      <div
                        aria-label="{{runeProgress}}"
                        role="img"
                        style="display: flex; gap: 10px"
                      >
                        <sc-for list="{{dots}}" as="d" hint-placeholder-count="4">
                          <span
                            style="width: 12px; height: 12px; border-radius: 50%; background: {{d.bg}}; display: block; transition: background .15s"
                          ></span>
                        </sc-for>
                      </div>
                      <button
                        class="hx-chip"
                        type="button"
                        onClick="{{clearRunes}}"
                        style="min-height: 44px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: #9CCBF0; font: 500 14px Inter, sans-serif; cursor: pointer"
                      >
                        Start over
                      </button>
                    </div>
                    <sc-if value="{{hasError}}" hint-placeholder-val="{{ false }}">
                      <p
                        role="alert"
                        style="margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(229,72,77,0.12); border: 1px solid rgba(229,72,77,0.4); color: #FF9EA2; font-size: 14px"
                      >
                        {{error}}
                      </p>
                    </sc-if>
                    <sc-if value="{{loading}}" hint-placeholder-val="{{ false }}">
                      <p style="margin: 0; text-align: center; font-size: 14px; color: #9CCBF0">
                        Checking your runes…
                      </p>
                    </sc-if>
                  </div>
                </sc-if>

                <sc-if value="{{isSignup}}" hint-placeholder-val="{{ false }}">
                  <form
                    class="hx-rise"
                    onSubmit="{{signup}}"
                    novalidate="novalidate"
                    style="display: flex; flex-direction: column; gap: 18px"
                  >
                    <div
                      style="display: flex; align-items: center; gap: 16px; padding: 14px; border-radius: 16px; background: #0F141B; border: 1px solid #222B37"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 64 64"
                        style="width: 64px; height: 64px; flex: none; filter: drop-shadow(0 0 10px {{tokenGlow}}); transition: filter .3s"
                      >
                        <polygon
                          points="32,2 58,17 58,47 32,62 6,47 6,17"
                          fill="#1A2330"
                          stroke="{{tokenColor}}"
                          stroke-width="2.5"
                          stroke-linejoin="round"
                          style="transition: stroke .3s"
                        ></polygon>
                        <text
                          x="32"
                          y="41"
                          text-anchor="middle"
                          font-family="Cinzel, serif"
                          font-size="24"
                          font-weight="700"
                          fill="#F2F6FA"
                        >
                          {{tokenInitial}}
                        </text>
                      </svg>
                      <div
                        style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px"
                      >
                        <p
                          style="margin: 0; font-family: Cinzel, serif; font-size: 20px; font-weight: 600; color: #F2F6FA; overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
                        >
                          {{tokenName}}
                        </p>
                        <p style="margin: 0; font-size: 13px; color: #9AA6B6">
                          Grade {{nGrade}} riddles
                        </p>
                        <div
                          aria-label="{{forgeAria}}"
                          role="img"
                          style="display: flex; align-items: center; gap: 6px"
                        >
                          <sc-for list="{{forge}}" as="f" hint-placeholder-count="4">
                            <svg viewBox="0 0 14 16" style="width: 14px; height: 16px">
                              <polygon
                                points="7,1 13,4.5 13,11.5 7,15 1,11.5 1,4.5"
                                fill="{{f.fill}}"
                                stroke="{{f.stroke}}"
                                stroke-width="1.2"
                                style="transition: fill .2s"
                              ></polygon>
                            </svg>
                          </sc-for>
                          <span style="font-size: 12px; color: #9AA6B6; margin-left: 4px"
                            >{{forgeLabel}}</span
                          >
                        </div>
                      </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px">
                      <label
                        for="hx-nname"
                        style="font-size: 13px; font-weight: 500; color: #C9D3DE"
                        >Hero name</label
                      >
                      <input
                        id="hx-nname"
                        class="hx-input"
                        type="text"
                        autocomplete="username"
                        maxlength="20"
                        placeholder="Pick something fun"
                        value="{{nName}}"
                        onInput="{{onNName}}"
                        onFocus="{{fNName}}"
                        onBlur="{{fBlur}}"
                        style="height: 48px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; border: 1px solid #2E3846; background: #0F141B; color: #F2F6FA; font: 400 15px Inter, sans-serif"
                      />
                      <p style="margin: 0; font-size: 12px; color: #8E9AAA">
                        Friends will see this name. Don't use your real name.
                      </p>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px">
                      <label
                        for="hx-npass"
                        style="font-size: 13px; font-weight: 500; color: #C9D3DE"
                        >Password</label
                      >
                      <input
                        id="hx-npass"
                        class="hx-input"
                        type="password"
                        autocomplete="new-password"
                        placeholder="At least 8 characters"
                        value="{{nPass}}"
                        onInput="{{onNPass}}"
                        onFocus="{{fNPass}}"
                        onBlur="{{fBlur}}"
                        style="height: 48px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; border: 1px solid #2E3846; background: #0F141B; color: #F2F6FA; font: 400 15px Inter, sans-serif"
                      />
                      <div style="display: flex; align-items: center; gap: 10px">
                        <div
                          style="flex: 1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px"
                        >
                          <sc-for list="{{segs}}" as="g" hint-placeholder-count="4">
                            <span
                              style="height: 4px; border-radius: 2px; background: {{g.bg}}; display: block; transition: background .2s"
                            ></span>
                          </sc-for>
                        </div>
                        <span
                          style="font-size: 12px; font-weight: 600; color: {{strengthColor}}; min-width: 64px; text-align: right"
                          >{{strengthLabel}}</span
                        >
                      </div>
                    </div>
                    <fieldset
                      style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"
                    >
                      <legend
                        style="padding: 0; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #C9D3DE"
                      >
                        School grade — sets your first riddles
                      </legend>
                      <div
                        style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px"
                      >
                        <sc-for list="{{grades}}" as="gr" hint-placeholder-count="4">
                          <button
                            class="hx-chip"
                            type="button"
                            aria-pressed="{{gr.selected}}"
                            onClick="{{gr.pick}}"
                            style="min-height: 44px; border-radius: 12px; border: 1px solid {{gr.border}}; background: {{gr.bg}}; color: #E6EBF2; font: 600 15px Inter, sans-serif; cursor: pointer"
                          >
                            {{gr.label}}
                          </button>
                        </sc-for>
                      </div>
                    </fieldset>
                    <div style="display: flex; flex-direction: column; gap: 6px">
                      <label
                        for="hx-parent"
                        style="font-size: 13px; font-weight: 500; color: #C9D3DE"
                        >Parent or guardian email</label
                      >
                      <input
                        id="hx-parent"
                        class="hx-input"
                        type="email"
                        autocomplete="email"
                        placeholder="grown-up@example.com"
                        value="{{nParent}}"
                        onInput="{{onNParent}}"
                        onFocus="{{fBlur}}"
                        style="height: 48px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; border: 1px solid #2E3846; background: #0F141B; color: #F2F6FA; font: 400 15px Inter, sans-serif"
                      />
                      <p style="margin: 0; font-size: 12px; color: #8E9AAA">
                        A grown-up confirms the account and sees progress reports.
                      </p>
                    </div>
                    <sc-if value="{{hasError}}" hint-placeholder-val="{{ false }}">
                      <p
                        role="alert"
                        style="margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(229,72,77,0.12); border: 1px solid rgba(229,72,77,0.4); color: #FF9EA2; font-size: 14px"
                      >
                        {{error}}
                      </p>
                    </sc-if>
                    <button
                      class="hx-btn"
                      type="submit"
                      disabled="{{loading}}"
                      style="height: 52px; border: 0; border-radius: 14px; background: {{accent}}; color: #0B1520; font: 700 16px Inter, sans-serif; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: {{forgeGlow}}"
                    >
                      <sc-if value="{{loading}}" hint-placeholder-val="{{ false }}">
                        <svg
                          aria-hidden="true"
                          class="hx-spin"
                          viewBox="0 0 24 24"
                          style="width: 18px; height: 18px"
                          fill="none"
                          stroke="#0B1520"
                          stroke-width="2.4"
                          stroke-linecap="round"
                        >
                          <path d="M12 3a9 9 0 1 1-9 9"></path>
                        </svg>
                        Forging your hero…
                      </sc-if>
                      <sc-if value="{{idle}}" hint-placeholder-val="{{ true }}">Create hero</sc-if>
                    </button>
                  </form>
                </sc-if>

                <div
                  style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-top: 4px; border-top: 1px solid #1F2732"
                >
                  <div style="display: flex; gap: 14px; font-size: 12px; padding-top: 12px">
                    <a href="#" style="text-decoration: none">Terms</a>
                    <a href="#" style="text-decoration: none">Privacy</a>
                  </div>
                  <button
                    class="hx-chip"
                    type="button"
                    onClick="{{toggleLang}}"
                    aria-label="Change language"
                    style="min-height: 44px; margin-top: 4px; display: flex; align-items: center; gap: 6px; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; color: #C9D3DE; font: 600 12px Inter, sans-serif; cursor: pointer"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      style="width: 16px; height: 16px"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                    >
                      <circle cx="12" cy="12" r="9"></circle>
                      <path
                        d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"
                      ></path>
                    </svg>
                    {{lang}}
                  </button>
                </div>
              </div>
            </sc-if>
          </div>
        </section>
      </div>
    </x-dc>
    <script
      type="text/x-dc"
      data-dc-script
      data-props='{"accent":{"editor":"color","default":"#7FB8E6","options":["#7FB8E6","#8FD3B6","#C9A7F0","#F2C46D"]},"$preview":{"width":1440,"height":900}}'
    >
      class Component extends DCLogic {
        constructor(props) {
          super(props);
          this.state = {
            mode: 'signin', user: '', pass: '', show: false, remember: true, caps: false,
            error: '', errTick: 0, loading: false, done: false, who: '',
            runes: [], runeHero: '', nName: '', nPass: '', nGrade: 4, nParent: '', lang: 'EN',
            mx: -999, my: -999, gx: 0, gy: 0, focus: '', blink: false, ripples: [], tip: 0
          };
          this.rid = 0;
        }
        componentDidMount() {
          this.tipTimer = setInterval(() => this.setState({ tip: (this.state.tip + 1) % 3 }), 5000);
          this.blinkTimer = setInterval(() => {
            this.setState({ blink: true });
            this.blinkOff = setTimeout(() => this.setState({ blink: false }), 140);
          }, 4300);
        }
        componentWillUnmount() {
          clearTimeout(this.timer); clearInterval(this.tipTimer); clearInterval(this.blinkTimer); clearTimeout(this.blinkOff);
          if (this.raf) cancelAnimationFrame(this.raf);
        }
        fail(msg) { this.setState({ error: msg, errTick: this.state.errTick + 1 }); }
        finish(who) {
          this.setState({ loading: true, error: '' });
          clearTimeout(this.timer);
          this.timer = setTimeout(() => this.setState({ loading: false, done: true, who: who }), 1300);
        }
        renderVals() {
          const s = this.state;
          const accent = this.props.accent ?? '#7FB8E6';
          const modes = ['signin', 'rune', 'signup'];
          const tabs = [['signin', 'Sign in'], ['rune', 'Hero code'], ['signup', 'New hero']].map((p) => ({
            label: p[1], selected: s.mode === p[0], fg: s.mode === p[0] ? '#F2F6FA' : '#9AA6B6',
            pick: () => this.setState({ mode: p[0], error: '', runes: [], loading: false })
          }));
          const heroColors = { Mira: '#8FD3B6', Tarek: '#F2C46D' };
          const recent = ['Mira', 'Tarek'].map((n) => {
            const sel = s.mode === 'rune' ? s.runeHero === n : s.user === n;
            return {
              name: n, initial: n[0], selected: sel, color: heroColors[n], border: sel ? accent : '#2A3340',
              pick: () => (s.mode === 'rune' ? this.setState({ runeHero: n, runes: [], error: '' }) : this.setState({ user: n, error: '' }))
            };
          });

          // emblem eyes: follow pointer, read along while typing, close while a hidden password is typed
          let ex = s.gx, ey = s.gy;
          if (s.focus === 'user' || s.focus === 'nname') {
            const len = (s.focus === 'user' ? s.user : s.nName).length;
            ex = -4 + Math.min(len, 18) / 18 * 8; ey = 3;
          }
          if (s.focus === 'pass' && s.show) { ex = 4.5; ey = 2; }
          const closed = s.blink || (s.focus === 'pass' && !s.show) || s.focus === 'npass';

          const defs = [
            { id: 'star', label: 'Star', d: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z' },
            { id: 'moon', label: 'Moon', d: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
            { id: 'leaf', label: 'Leaf', d: 'M5 19C5 10 11 5 20 4c-1 9-6 15-15 15zM5 19l7-7' },
            { id: 'flame', label: 'Flame', d: 'M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z' },
            { id: 'drop', label: 'Drop', d: 'M12 3l6 8a7 7 0 1 1-12 0z' },
            { id: 'bolt', label: 'Bolt', d: 'M13 2L4 14h7l-1 8 9-12h-7z' },
            { id: 'sun', label: 'Sun', d: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8' }
          ];
          const pos = [[78, 72], [137, 38], [137, 106], [78, 140], [19, 106], [19, 38], [78, 4]];
          const runes = defs.map((r, i) => {
            const idx = s.runes.indexOf(r.id);
            const picked = idx >= 0;
            return {
              d: r.d, x: pos[i][0], y: pos[i][1], picked: picked, order: idx + 1,
              aria: r.label + ' rune' + (picked ? ', chosen ' + (idx + 1) : ''),
              fill: picked ? '#22374D' : '#141A23', stroke: picked ? accent : '#33404F', ink: picked ? '#F2F6FA' : '#B4C3D3',
              pick: () => {
                if (s.loading) return;
                if (!s.runeHero) { this.fail('First choose who is playing.'); return; }
                if (picked || s.runes.length >= 4) return;
                const next = s.runes.concat([r.id]);
                this.setState({ runes: next, error: '' });
                if (next.length === 4) this.finish(s.runeHero);
              }
            };
          });
          const runePath = s.runes.map((id) => {
            const i = defs.findIndex((d) => d.id === id);
            return (pos[i][0] + 34) + ',' + (pos[i][1] + 36);
          }).join(' ');
          const dots = [0, 1, 2, 3].map((i) => ({ bg: i < s.runes.length ? accent : '#2A3340' }));

          const p = s.nPass;
          let score = 0;
          if (p.length >= 8) score++;
          if (p.length >= 12) score++;
          if (/[0-9]/.test(p)) score++;
          if (/[^A-Za-z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) score++;
          if (p.length > 0 && p.length < 8) score = Math.min(score, 1);
          const sColors = ['#3A4452', '#E5484D', '#F5A524', '#7FB8E6', '#5FD4A0'];
          const sLabels = ['', 'Weak', 'Okay', 'Strong', 'Legendary'];
          const segs = [0, 1, 2, 3].map((i) => ({ bg: i < score ? sColors[score] : '#2A3340' }));
          const gradeColors = { 2: '#8FD3B6', 3: '#F2C46D', 4: '#7FB8E6', 5: '#C9A7F0' };
          const grades = [2, 3, 4, 5].map((g) => ({
            label: String(g), selected: s.nGrade === g,
            bg: s.nGrade === g ? '#22374D' : '#151B24', border: s.nGrade === g ? gradeColors[g] : '#2A3340',
            pick: () => this.setState({ nGrade: g })
          }));
          const emailOk = /.+@.+\..+/.test(s.nParent);
          const steps = [!!s.nName.trim(), score >= 2, true, emailOk];
          const ready = steps.filter(Boolean).length;
          const tokenColor = gradeColors[s.nGrade];
          const forge = steps.map((ok) => ({ fill: ok ? tokenColor : 'transparent', stroke: ok ? tokenColor : '#3A4452' }));

          const tips = [
            'Every step takes Will. Spend it wisely.',
            'Every riddle you solve makes your hero stronger.',
            'Friends can join your adventure at any time.'
          ];
          const tipDots = tips.map((t, i) => ({
            w: i === s.tip ? 24 : 8, bg: i === s.tip ? accent : '#3A4452', aria: 'Show tip ' + (i + 1),
            pick: () => {
              clearInterval(this.tipTimer);
              this.setState({ tip: i });
              this.tipTimer = setInterval(() => this.setState({ tip: (this.state.tip + 1) % 3 }), 5000);
            }
          }));

          return {
            accent: accent, tabs: tabs, tabIndex: modes.indexOf(s.mode), recent: recent,
            runes: runes, runePath: runePath, dots: dots, segs: segs, grades: grades,
            done: s.done, notDone: !s.done, who: s.who,
            isSignin: s.mode === 'signin', isRune: s.mode === 'rune', isSignup: s.mode === 'signup',
            user: s.user, pass: s.pass, nName: s.nName, nPass: s.nPass, nParent: s.nParent, nGrade: s.nGrade,
            passType: s.show ? 'text' : 'password', show: s.show, hide: !s.show, showAria: s.show ? 'Hide password' : 'Show password',
            caps: s.caps, remember: s.remember, switchBg: s.remember ? accent : '#2E3846', knobLeft: s.remember ? 19 : 3,
            error: s.error, hasError: !!s.error, loading: s.loading, idle: !s.loading,
            strengthLabel: p.length === 0 ? '' : sLabels[Math.max(score, 1)], strengthColor: sColors[Math.max(score, 1)],
            runeProgress: s.runes.length + ' of 4 runes chosen', lang: s.lang,
            eyeT: ex.toFixed(1) + 'px, ' + ey.toFixed(1) + 'px', openOp: closed ? 0 : 1, closedOp: closed ? 1 : 0,
            beat: s.loading ? 0.5 : (s.focus ? 1.5 : 2.4),
            shakeClass: s.errTick === 0 ? '' : (s.errTick % 2 ? 'hx-shakeA' : 'hx-shakeB'),
            spotX: s.mx + 60, spotY: s.my + 60, ripples: s.ripples,
            tipText: tips[s.tip], tipClass: s.tip % 2 ? 'hx-fadeB' : 'hx-fadeA', tipDots: tipDots,
            signinGlow: s.user && s.pass ? '0 0 0 4px rgba(127,184,230,0.18), 0 10px 30px rgba(127,184,230,0.35)' : '0 8px 24px rgba(127,184,230,0.2)',
            tokenName: s.nName.trim() || 'Your hero', tokenInitial: (s.nName.trim()[0] || '?').toUpperCase(),
            tokenColor: tokenColor, tokenGlow: ready === 4 ? tokenColor : 'rgba(0,0,0,0)',
            forge: forge, forgeLabel: ready === 4 ? 'Ready!' : ready + ' / 4', forgeAria: ready + ' of 4 steps done',
            forgeGlow: ready === 4 ? '0 0 0 4px rgba(127,184,230,0.18), 0 10px 30px rgba(127,184,230,0.35)' : 'none',

            onMove: (e) => {
              const root = e.currentTarget;
              const r = root.getBoundingClientRect();
              const em = root.querySelector('[data-emblem]');
              let gx = 0, gy = 0;
              if (em) {
                const er = em.getBoundingClientRect();
                const dx = e.clientX - (er.left + er.width / 2);
                const dy = e.clientY - (er.top + er.height * 0.39);
                const d = Math.max(1, Math.hypot(dx, dy));
                const k = Math.min(1, d / 220);
                gx = dx / d * 4.5 * k; gy = dy / d * 3.5 * k;
              }
              this.pend = { mx: e.clientX - r.left, my: e.clientY - r.top, gx: gx, gy: gy };
              if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.setState(this.pend); });
            },
            onLeave: () => this.setState({ mx: -999, my: -999, gx: 0, gy: 0 }),
            onDown: (e) => {
              if (e.target.closest && e.target.closest('[data-card]')) return;
              const r = e.currentTarget.getBoundingClientRect();
              const id = ++this.rid;
              const rp = { id: id, x: e.clientX - r.left - 60, y: e.clientY - r.top - 60 };
              this.setState({ ripples: this.state.ripples.concat([rp]).slice(-6) });
              setTimeout(() => this.setState({ ripples: this.state.ripples.filter((q) => q.id !== id) }), 950);
            },
            fUser: () => this.setState({ focus: 'user' }),
            fPass: () => this.setState({ focus: 'pass' }),
            fNName: () => this.setState({ focus: 'nname' }),
            fNPass: () => this.setState({ focus: 'npass' }),
            fBlur: () => this.setState({ focus: '' }),
            keepFocus: (e) => e.preventDefault(),
            onUser: (e) => this.setState({ user: e.target.value, error: '' }),
            onPass: (e) => this.setState({ pass: e.target.value, error: '' }),
            onKey: (e) => this.setState({ caps: !!(e.getModifierState && e.getModifierState('CapsLock')) }),
            onNName: (e) => this.setState({ nName: e.target.value, error: '' }),
            onNPass: (e) => this.setState({ nPass: e.target.value, error: '' }),
            onNParent: (e) => this.setState({ nParent: e.target.value, error: '' }),
            toggleShow: () => this.setState({ show: !s.show }),
            toggleRemember: () => this.setState({ remember: !s.remember }),
            toggleLang: () => this.setState({ lang: s.lang === 'EN' ? 'UA' : 'EN' }),
            clearRunes: () => this.setState({ runes: [], error: '' }),
            reset: () => { clearTimeout(this.timer); this.setState({ done: false, loading: false, runes: [], pass: '', error: '' }); },
            passkey: () => this.finish(s.user.trim() || 'hero'),
            submit: (e) => {
              e.preventDefault();
              if (s.loading) return;
              if (!s.user.trim()) { this.fail('Enter your hero name to continue.'); return; }
              if (!s.pass) { this.fail('Enter your password.'); return; }
              this.finish(s.user.trim());
            },
            signup: (e) => {
              e.preventDefault();
              if (s.loading) return;
              if (!s.nName.trim()) { this.fail('Choose a hero name.'); return; }
              if (score < 2) { this.fail('Make the password a little stronger.'); return; }
              if (!emailOk) { this.fail('Add a grown-up’s email so they can confirm.'); return; }
              this.finish(s.nName.trim());
            }
          };
        }
      }
    </script>
  </body>
</html>
```

---

## Appendix C — Full reference prototype (phone, 390×844)

Same logic as Appendix B; layout per §4 Phone (header + bottom sheet).

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Path of Will sign in, mobile</title>
    <script src="./support.js"></script>
  </head>
  <body>
    <x-dc>
      <helmet>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&amp;family=Inter:wght@400;500;600;700&amp;display=swap"
          rel="stylesheet"
        />
        <style>
          body {
            margin: 0;
            background: #0b0e13;
          }
          a {
            color: #9ccbf0;
          }
          a:hover {
            color: #cfe6f8;
          }
          .hx-input {
            transition:
              border-color 0.15s,
              box-shadow 0.15s;
          }
          .hx-input::placeholder {
            color: #7f8a99;
          }
          .hx-input:focus {
            outline: none;
            border-color: #7fb8e6;
            box-shadow: 0 0 0 3px rgba(127, 184, 230, 0.22);
          }
          .hx-btn {
            transition:
              filter 0.15s,
              transform 0.1s,
              box-shadow 0.25s;
          }
          .hx-btn:hover {
            filter: brightness(1.1);
          }
          .hx-btn:active {
            transform: translateY(1px);
          }
          .hx-btn:focus-visible,
          .hx-chip:focus-visible,
          .hx-rune:focus-visible {
            outline: 2px solid #7fb8e6;
            outline-offset: 3px;
          }
          .hx-chip {
            transition:
              background 0.15s,
              border-color 0.15s;
          }
          .hx-chip:hover {
            background: #1e2631;
          }
          .hx-rune .hx-hex {
            transition:
              fill 0.15s,
              stroke 0.15s;
          }
          .hx-rune:hover .hx-hex {
            stroke: #9ccbf0;
          }
          .hx-rune:active svg {
            transform: scale(0.94);
          }
          @keyframes hxDrift {
            from {
              transform: translate3d(0, 0, 0);
            }
            to {
              transform: translate3d(-30px, -52px, 0);
            }
          }
          @keyframes hxPulse {
            0%,
            100% {
              transform: scale(1);
              opacity: 0.88;
            }
            50% {
              transform: scale(1.12);
              opacity: 1;
            }
          }
          @keyframes hxSpin {
            to {
              transform: rotate(360deg);
            }
          }
          @keyframes hxFill {
            from {
              width: 0;
            }
            to {
              width: 100%;
            }
          }
          @keyframes hxRise {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: none;
            }
          }
          @keyframes hxFadeA {
            from {
              opacity: 0;
              transform: translateY(6px);
            }
            to {
              opacity: 1;
              transform: none;
            }
          }
          @keyframes hxFadeB {
            from {
              opacity: 0;
              transform: translateY(6px);
            }
            to {
              opacity: 1;
              transform: none;
            }
          }
          @keyframes hxShakeA {
            0%,
            100% {
              transform: none;
            }
            20% {
              transform: translateX(-8px) rotate(-3deg);
            }
            40% {
              transform: translateX(7px) rotate(2deg);
            }
            60% {
              transform: translateX(-5px);
            }
            80% {
              transform: translateX(3px);
            }
          }
          @keyframes hxShakeB {
            0%,
            100% {
              transform: none;
            }
            20% {
              transform: translateX(-8px) rotate(-3deg);
            }
            40% {
              transform: translateX(7px) rotate(2deg);
            }
            60% {
              transform: translateX(-5px);
            }
            80% {
              transform: translateX(3px);
            }
          }
          @keyframes hxRipple {
            from {
              transform: scale(0.2);
              opacity: 0.9;
            }
            to {
              transform: scale(2.2);
              opacity: 0;
            }
          }
          @keyframes hxFloat {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-6px);
            }
          }
          .hx-lattice {
            animation: hxDrift 40s linear infinite alternate;
          }
          .hx-heart {
            transform-origin: 100px 150px;
            animation: hxPulse 2.4s ease-in-out infinite;
          }
          .hx-float {
            animation: hxFloat 6s ease-in-out infinite;
          }
          .hx-spin {
            animation: hxSpin 0.8s linear infinite;
          }
          .hx-bar {
            animation: hxFill 1.6s ease-out forwards;
          }
          .hx-rise {
            animation: hxRise 0.35s ease-out;
          }
          .hx-fadeA {
            animation: hxFadeA 0.5s ease-out;
          }
          .hx-fadeB {
            animation: hxFadeB 0.5s ease-out;
          }
          .hx-shakeA {
            animation: hxShakeA 0.45s ease-in-out;
          }
          .hx-shakeB {
            animation: hxShakeB 0.45s ease-in-out;
          }
          .hx-ripple {
            transform-origin: 60px 60px;
            animation: hxRipple 0.9s ease-out forwards;
          }
          @media (prefers-reduced-motion: reduce) {
            .hx-lattice,
            .hx-heart,
            .hx-float,
            .hx-spin,
            .hx-bar,
            .hx-rise,
            .hx-fadeA,
            .hx-fadeB,
            .hx-shakeA,
            .hx-shakeB,
            .hx-ripple {
              animation: none;
            }
          }
        </style>
      </helmet>
      <div
        onPointerMove="{{onMove}}"
        onPointerLeave="{{onLeave}}"
        onPointerDown="{{onDown}}"
        style="width: 390px; height: 844px; position: relative; overflow: hidden; background: #0B0E13; color: #E6EBF2; font-family: Inter, system-ui, sans-serif; display: flex; flex-direction: column"
      >
        <div
          aria-hidden="true"
          class="hx-lattice"
          style="position: absolute; left: -60px; top: -60px; width: calc(100% + 120px); height: calc(100% + 160px); pointer-events: none"
        >
          <svg
            style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: 0.16"
          >
            <defs>
              <pattern id="hxgridA" width="60" height="104" patternUnits="userSpaceOnUse">
                <path
                  d="M30 0 L60 17.3 L60 52 L30 69.3 L0 52 L0 17.3 Z M30 69.3 L30 104"
                  fill="none"
                  stroke="#6F8BA8"
                  stroke-width="1"
                ></path>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hxgridA)"></rect>
          </svg>
          <svg
            style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: 0.85; -webkit-mask-image: radial-gradient(circle 190px at {{spotX}}px {{spotY}}px, #000 0%, rgba(0,0,0,0) 100%); mask-image: radial-gradient(circle 190px at {{spotX}}px {{spotY}}px, #000 0%, rgba(0,0,0,0) 100%)"
          >
            <defs>
              <pattern id="hxgridB" width="60" height="104" patternUnits="userSpaceOnUse">
                <path
                  d="M30 0 L60 17.3 L60 52 L30 69.3 L0 52 L0 17.3 Z M30 69.3 L30 104"
                  fill="none"
                  stroke="{{accent}}"
                  stroke-width="1.4"
                ></path>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hxgridB)"></rect>
          </svg>
        </div>
        <div
          aria-hidden="true"
          style="position: absolute; left: 50%; top: -40px; width: 420px; height: 420px; margin-left: -210px; border-radius: 50%; background: radial-gradient(circle, rgba(127,184,230,0.16) 0%, rgba(127,184,230,0) 65%); pointer-events: none"
        ></div>
        <sc-for list="{{ripples}}" as="rp" hint-placeholder-count="0">
          <svg
            aria-hidden="true"
            viewBox="0 0 120 120"
            style="position: absolute; left: {{rp.x}}px; top: {{rp.y}}px; width: 120px; height: 120px; pointer-events: none; overflow: visible"
          >
            <polygon
              class="hx-ripple"
              points="60,6 107,33 107,87 60,114 13,87 13,33"
              fill="none"
              stroke="{{accent}}"
              stroke-width="2"
            ></polygon>
          </svg>
        </sc-for>

        <header
          style="position: relative; flex: none; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 24px 18px; text-align: center"
        >
          <div class="{{shakeClass}}" style="width: 84px">
            <div class="hx-float">
              <svg
                data-emblem="1"
                role="img"
                aria-label="Path of Will emblem: a hex robot with a red heart"
                viewBox="0 0 200 220"
                style="width: 84px; height: 92px; display: block; filter: drop-shadow(0 0 14px rgba(190,220,255,0.45))"
              >
                <polygon
                  points="100,8 188,58 188,162 100,212 12,162 12,58"
                  fill="#121820"
                  stroke="#E9F2FB"
                  stroke-width="5"
                  stroke-linejoin="round"
                ></polygon>
                <polygon
                  points="82,55 118,55 136,85 118,115 82,115 64,85"
                  fill="#121820"
                  stroke="#E9F2FB"
                  stroke-width="4"
                  stroke-linejoin="round"
                ></polygon>
                <g style="transform: translate({{eyeT}}); transition: transform .14s ease-out">
                  <g style="opacity: {{openOp}}; transition: opacity .08s">
                    <polygon
                      points="79,85 83.5,77.2 92.5,77.2 97,85 92.5,92.8 83.5,92.8"
                      fill="none"
                      stroke="#E9F2FB"
                      stroke-width="3"
                    ></polygon>
                    <polygon
                      points="103,85 107.5,77.2 116.5,77.2 121,85 116.5,92.8 107.5,92.8"
                      fill="none"
                      stroke="#E9F2FB"
                      stroke-width="3"
                    ></polygon>
                  </g>
                  <g style="opacity: {{closedOp}}; transition: opacity .08s">
                    <path
                      d="M80 86 Q88 91 96 86 M104 86 Q112 91 120 86"
                      fill="none"
                      stroke="#E9F2FB"
                      stroke-width="3"
                      stroke-linecap="round"
                    ></path>
                  </g>
                </g>
                <polyline
                  points="44,176 70,124 130,124 156,176"
                  fill="none"
                  stroke="#E9F2FB"
                  stroke-width="4"
                  stroke-linejoin="round"
                ></polyline>
                <path
                  class="hx-heart"
                  style="animation-duration: {{beat}}s"
                  d="M100 164 L85 150 A9 9 0 0 1 100 138 A9 9 0 0 1 115 150 Z"
                  fill="#E5484D"
                ></path>
              </svg>
            </div>
          </div>
          <p
            style="margin: 0; font-family: Cinzel, serif; font-weight: 700; font-size: 30px; letter-spacing: 0.08em; color: #F2F6FA"
          >
            Path of Will
          </p>
          <p
            aria-live="polite"
            class="{{tipClass}}"
            style="margin: 0; min-height: 22px; font-size: 14px; color: #B4BFCC"
          >
            {{tipText}}
          </p>
        </header>

        <div
          data-card="1"
          style="position: relative; flex: 1; min-height: 0; overflow-y: auto; box-sizing: border-box; padding: 22px 20px 28px; border-radius: 28px 28px 0 0; background: rgba(19,24,32,0.92); border-top: 1px solid #2A3340; box-shadow: 0 -16px 40px rgba(0,0,0,0.4); backdrop-filter: blur(14px); display: flex; flex-direction: column; gap: 22px"
        >
          <sc-if value="{{done}}" hint-placeholder-val="{{ false }}">
            <div
              class="hx-rise"
              style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 18px; padding: 24px 0"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                style="width: 64px; height: 64px"
                fill="none"
                stroke="{{accent}}"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"></path>
                <path d="M8 12.2l2.7 2.6L16.2 9.4"></path>
              </svg>
              <h1
                style="margin: 0; font-family: Cinzel, serif; font-size: 24px; font-weight: 600; color: #F2F6FA"
              >
                Welcome, {{who}}!
              </h1>
              <p style="margin: 0; color: #B4BFCC; font-size: 15px">Unfolding your map…</p>
              <div
                style="width: 100%; height: 6px; border-radius: 3px; background: #222B37; overflow: hidden"
              >
                <div
                  class="hx-bar"
                  style="height: 6px; border-radius: 3px; background: {{accent}}"
                ></div>
              </div>
              <button
                class="hx-btn"
                type="button"
                onClick="{{reset}}"
                style="min-height: 44px; padding: 0 18px; border-radius: 12px; border: 1px solid #2A3340; background: transparent; color: #C9D3DE; font: 500 14px Inter, sans-serif; cursor: pointer"
              >
                Back to sign in (demo)
              </button>
            </div>
          </sc-if>

          <sc-if value="{{notDone}}" hint-placeholder-val="{{ true }}">
            <div style="display: flex; flex-direction: column; gap: 24px">
              <div
                role="group"
                aria-label="How do you want to sign in?"
                style="position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 14px; background: #0F141B; border: 1px solid #222B37"
              >
                <span
                  aria-hidden="true"
                  style="position: absolute; top: 4px; bottom: 4px; left: calc(4px + {{tabIndex}} * ((100% - 16px) / 3 + 4px)); width: calc((100% - 16px) / 3); border-radius: 10px; background: #243041; transition: left .25s cubic-bezier(.3,.7,.2,1)"
                ></span>
                <sc-for list="{{tabs}}" as="t" hint-placeholder-count="3">
                  <button
                    class="hx-btn"
                    type="button"
                    aria-pressed="{{t.selected}}"
                    onClick="{{t.pick}}"
                    style="position: relative; min-height: 40px; border: 0; border-radius: 10px; background: transparent; color: {{t.fg}}; font: 600 13px Inter, sans-serif; cursor: pointer"
                  >
                    {{t.label}}
                  </button>
                </sc-for>
              </div>

              <sc-if value="{{isSignin}}" hint-placeholder-val="{{ true }}">
                <form
                  class="hx-rise"
                  onSubmit="{{submit}}"
                  novalidate="novalidate"
                  style="display: flex; flex-direction: column; gap: 18px"
                >
                  <div style="display: flex; flex-direction: column; gap: 6px">
                    <h1
                      style="margin: 0; font-family: Cinzel, serif; font-size: 24px; font-weight: 600; color: #F2F6FA"
                    >
                      Welcome back
                    </h1>
                    <p style="margin: 0; font-size: 15px; color: #9AA6B6">
                      Your hero is waiting where you left off.
                    </p>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 8px">
                    <p
                      style="margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #8E9AAA"
                    >
                      Recent on this device
                    </p>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px">
                      <sc-for list="{{recent}}" as="h" hint-placeholder-count="2">
                        <button
                          class="hx-chip"
                          type="button"
                          onClick="{{h.pick}}"
                          aria-pressed="{{h.selected}}"
                          style="min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px 0 6px; border-radius: 12px; border: 1px solid {{h.border}}; background: #151B24; color: #E6EBF2; font: 500 14px Inter, sans-serif; cursor: pointer"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 32 32"
                            style="width: 32px; height: 32px"
                          >
                            <polygon
                              points="16,1 29,8.5 29,23.5 16,31 3,23.5 3,8.5"
                              fill="#223042"
                              stroke="{{h.color}}"
                              stroke-width="1.4"
                            ></polygon>
                            <text
                              x="16"
                              y="21"
                              text-anchor="middle"
                              font-family="Cinzel, serif"
                              font-size="13"
                              font-weight="700"
                              fill="#E6EBF2"
                            >
                              {{h.initial}}
                            </text>
                          </svg>
                          {{h.name}}
                        </button>
                      </sc-for>
                    </div>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 6px">
                    <label for="hx-user" style="font-size: 13px; font-weight: 500; color: #C9D3DE"
                      >Hero name</label
                    >
                    <input
                      id="hx-user"
                      class="hx-input"
                      type="text"
                      autocomplete="username"
                      placeholder="e.g. StarFox42"
                      value="{{user}}"
                      onInput="{{onUser}}"
                      onFocus="{{fUser}}"
                      onBlur="{{fBlur}}"
                      style="height: 48px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; border: 1px solid #2E3846; background: #0F141B; color: #F2F6FA; font: 400 15px Inter, sans-serif"
                    />
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 6px">
                    <div
                      style="display: flex; justify-content: space-between; align-items: baseline"
                    >
                      <label for="hx-pass" style="font-size: 13px; font-weight: 500; color: #C9D3DE"
                        >Password</label
                      >
                      <a href="#" style="font-size: 13px; text-decoration: none">Forgot it?</a>
                    </div>
                    <div style="position: relative">
                      <input
                        id="hx-pass"
                        class="hx-input"
                        type="{{passType}}"
                        autocomplete="current-password"
                        placeholder="Your secret word"
                        value="{{pass}}"
                        onInput="{{onPass}}"
                        onKeyUp="{{onKey}}"
                        onFocus="{{fPass}}"
                        onBlur="{{fBlur}}"
                        style="width: 100%; height: 48px; box-sizing: border-box; padding: 0 64px 0 14px; border-radius: 12px; border: 1px solid #2E3846; background: #0F141B; color: #F2F6FA; font: 400 15px Inter, sans-serif"
                      />
                      <button
                        class="hx-btn"
                        type="button"
                        onPointerDown="{{keepFocus}}"
                        onClick="{{toggleShow}}"
                        aria-label="{{showAria}}"
                        style="position: absolute; right: 4px; top: 4px; width: 44px; height: 40px; border: 0; border-radius: 9px; background: transparent; color: #9AA6B6; cursor: pointer; display: flex; align-items: center; justify-content: center"
                      >
                        <sc-if value="{{show}}" hint-placeholder-val="{{ false }}">
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            style="width: 20px; height: 20px"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.7"
                            stroke-linecap="round"
                          >
                            <path
                              d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.5.9-1.6 2.4-3.1 3.7M6.6 7.6C4.6 8.9 3.1 10.8 2.5 12c1 1.8 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"
                            ></path>
                          </svg>
                        </sc-if>
                        <sc-if value="{{hide}}" hint-placeholder-val="{{ true }}">
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            style="width: 20px; height: 20px"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.7"
                          >
                            <path
                              d="M2.5 12C3.5 10.2 7 6 12 6s8.5 4.2 9.5 6c-1 1.8-4.5 6-9.5 6s-8.5-4.2-9.5-6z"
                            ></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </sc-if>
                      </button>
                    </div>
                    <sc-if value="{{caps}}" hint-placeholder-val="{{ false }}">
                      <p style="margin: 0; font-size: 13px; color: #F5C46B">Caps Lock is on</p>
                    </sc-if>
                  </div>

                  <div
                    style="display: flex; align-items: center; justify-content: space-between; gap: 12px"
                  >
                    <button
                      class="hx-chip"
                      type="button"
                      role="switch"
                      aria-checked="{{remember}}"
                      onClick="{{toggleRemember}}"
                      style="min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 8px 0 0; border: 0; border-radius: 10px; background: transparent; color: #C9D3DE; font: 500 14px Inter, sans-serif; cursor: pointer"
                    >
                      <span
                        style="width: 40px; height: 24px; border-radius: 12px; background: {{switchBg}}; position: relative; display: block; transition: background .15s"
                      >
                        <span
                          style="position: absolute; top: 3px; left: {{knobLeft}}px; width: 18px; height: 18px; border-radius: 50%; background: #F2F6FA; transition: left .15s"
                        ></span>
                      </span>
                      Keep me signed in
                    </button>
                  </div>

                  <sc-if value="{{hasError}}" hint-placeholder-val="{{ false }}">
                    <p
                      role="alert"
                      style="margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(229,72,77,0.12); border: 1px solid rgba(229,72,77,0.4); color: #FF9EA2; font-size: 14px"
                    >
                      {{error}}
                    </p>
                  </sc-if>

                  <button
                    class="hx-btn"
                    type="submit"
                    disabled="{{loading}}"
                    style="height: 52px; border: 0; border-radius: 14px; background: {{accent}}; color: #0B1520; font: 700 16px Inter, sans-serif; letter-spacing: 0.02em; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: {{signinGlow}}"
                  >
                    <sc-if value="{{loading}}" hint-placeholder-val="{{ false }}">
                      <svg
                        aria-hidden="true"
                        class="hx-spin"
                        viewBox="0 0 24 24"
                        style="width: 18px; height: 18px"
                        fill="none"
                        stroke="#0B1520"
                        stroke-width="2.4"
                        stroke-linecap="round"
                      >
                        <path d="M12 3a9 9 0 1 1-9 9"></path>
                      </svg>
                      Opening the gates…
                    </sc-if>
                    <sc-if value="{{idle}}" hint-placeholder-val="{{ true }}"
                      >Enter the world</sc-if
                    >
                  </button>

                  <div
                    style="display: flex; align-items: center; gap: 12px; color: #6F7B8B; font-size: 12px"
                  >
                    <span style="flex: 1; height: 1px; background: #232C38"></span>or<span
                      style="flex: 1; height: 1px; background: #232C38"
                    ></span>
                  </div>

                  <button
                    class="hx-btn"
                    type="button"
                    onClick="{{passkey}}"
                    style="height: 48px; border-radius: 14px; border: 1px solid #2E3846; background: #151B24; color: #E6EBF2; font: 600 15px Inter, sans-serif; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      style="width: 20px; height: 20px"
                      fill="none"
                      stroke="#7FB8E6"
                      stroke-width="1.7"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="8" cy="12" r="4"></circle>
                      <path d="M12 12h9M18 12v3M21 12v2"></path>
                    </svg>
                    Sign in with a passkey
                  </button>
                </form>
              </sc-if>

              <sc-if value="{{isRune}}" hint-placeholder-val="{{ false }}">
                <div class="hx-rise" style="display: flex; flex-direction: column; gap: 18px">
                  <div style="display: flex; flex-direction: column; gap: 6px">
                    <h1
                      style="margin: 0; font-family: Cinzel, serif; font-size: 24px; font-weight: 600; color: #F2F6FA"
                    >
                      Hero code
                    </h1>
                    <p style="margin: 0; font-size: 15px; color: #9AA6B6">
                      No typing needed — pick your hero, then tap your 4 secret runes in order.
                    </p>
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 8px">
                    <sc-for list="{{recent}}" as="h" hint-placeholder-count="2">
                      <button
                        class="hx-chip"
                        type="button"
                        onClick="{{h.pick}}"
                        aria-pressed="{{h.selected}}"
                        style="min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px 0 6px; border-radius: 12px; border: 1px solid {{h.border}}; background: #151B24; color: #E6EBF2; font: 500 14px Inter, sans-serif; cursor: pointer"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 32 32"
                          style="width: 32px; height: 32px"
                        >
                          <polygon
                            points="16,1 29,8.5 29,23.5 16,31 3,23.5 3,8.5"
                            fill="#223042"
                            stroke="{{h.color}}"
                            stroke-width="1.4"
                          ></polygon>
                          <text
                            x="16"
                            y="21"
                            text-anchor="middle"
                            font-family="Cinzel, serif"
                            font-size="13"
                            font-weight="700"
                            fill="#E6EBF2"
                          >
                            {{h.initial}}
                          </text>
                        </svg>
                        {{h.name}}
                      </button>
                    </sc-for>
                  </div>
                  <div style="position: relative; width: 224px; height: 216px; align-self: center">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 224 216"
                      style="position: absolute; left: 0; top: 0; width: 224px; height: 216px; pointer-events: none"
                    >
                      <polyline
                        points="{{runePath}}"
                        fill="none"
                        stroke="{{accent}}"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-dasharray="2 7"
                        opacity="0.8"
                      ></polyline>
                    </svg>
                    <sc-for list="{{runes}}" as="r" hint-placeholder-count="7">
                      <button
                        class="hx-rune"
                        type="button"
                        onClick="{{r.pick}}"
                        aria-label="{{r.aria}}"
                        style="position: absolute; left: {{r.x}}px; top: {{r.y}}px; width: 68px; height: 72px; padding: 0; border: 0; border-radius: 16px; background: transparent; cursor: pointer"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 68 72"
                          style="width: 68px; height: 72px; display: block; transition: transform .1s"
                        >
                          <polygon
                            class="hx-hex"
                            points="34,3 64,19.5 64,52.5 34,69 4,52.5 4,19.5"
                            fill="{{r.fill}}"
                            stroke="{{r.stroke}}"
                            stroke-width="2"
                            stroke-linejoin="round"
                          ></polygon>
                          <g transform="translate(22 24)">
                            <path
                              d="{{r.d}}"
                              fill="none"
                              stroke="{{r.ink}}"
                              stroke-width="1.8"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            ></path>
                          </g>
                        </svg>
                        <sc-if value="{{r.picked}}" hint-placeholder-val="{{ false }}">
                          <span
                            style="position: absolute; right: 2px; top: 2px; width: 20px; height: 20px; border-radius: 50%; background: #F2F6FA; color: #0B1520; font: 700 11px/20px Inter, sans-serif; text-align: center"
                            >{{r.order}}</span
                          >
                        </sc-if>
                      </button>
                    </sc-for>
                  </div>
                  <div
                    style="display: flex; align-items: center; justify-content: center; gap: 16px"
                  >
                    <div aria-label="{{runeProgress}}" role="img" style="display: flex; gap: 10px">
                      <sc-for list="{{dots}}" as="d" hint-placeholder-count="4">
                        <span
                          style="width: 12px; height: 12px; border-radius: 50%; background: {{d.bg}}; display: block; transition: background .15s"
                        ></span>
                      </sc-for>
                    </div>
                    <button
                      class="hx-chip"
                      type="button"
                      onClick="{{clearRunes}}"
                      style="min-height: 44px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: #9CCBF0; font: 500 14px Inter, sans-serif; cursor: pointer"
                    >
                      Start over
                    </button>
                  </div>
                  <sc-if value="{{hasError}}" hint-placeholder-val="{{ false }}">
                    <p
                      role="alert"
                      style="margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(229,72,77,0.12); border: 1px solid rgba(229,72,77,0.4); color: #FF9EA2; font-size: 14px"
                    >
                      {{error}}
                    </p>
                  </sc-if>
                  <sc-if value="{{loading}}" hint-placeholder-val="{{ false }}">
                    <p style="margin: 0; text-align: center; font-size: 14px; color: #9CCBF0">
                      Checking your runes…
                    </p>
                  </sc-if>
                </div>
              </sc-if>

              <sc-if value="{{isSignup}}" hint-placeholder-val="{{ false }}">
                <form
                  class="hx-rise"
                  onSubmit="{{signup}}"
                  novalidate="novalidate"
                  style="display: flex; flex-direction: column; gap: 18px"
                >
                  <div
                    style="display: flex; align-items: center; gap: 16px; padding: 14px; border-radius: 16px; background: #0F141B; border: 1px solid #222B37"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 64 64"
                      style="width: 64px; height: 64px; flex: none; filter: drop-shadow(0 0 10px {{tokenGlow}}); transition: filter .3s"
                    >
                      <polygon
                        points="32,2 58,17 58,47 32,62 6,47 6,17"
                        fill="#1A2330"
                        stroke="{{tokenColor}}"
                        stroke-width="2.5"
                        stroke-linejoin="round"
                        style="transition: stroke .3s"
                      ></polygon>
                      <text
                        x="32"
                        y="41"
                        text-anchor="middle"
                        font-family="Cinzel, serif"
                        font-size="24"
                        font-weight="700"
                        fill="#F2F6FA"
                      >
                        {{tokenInitial}}
                      </text>
                    </svg>
                    <div
                      style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px"
                    >
                      <p
                        style="margin: 0; font-family: Cinzel, serif; font-size: 20px; font-weight: 600; color: #F2F6FA; overflow: hidden; text-overflow: ellipsis; white-space: nowrap"
                      >
                        {{tokenName}}
                      </p>
                      <p style="margin: 0; font-size: 13px; color: #9AA6B6">
                        Grade {{nGrade}} riddles
                      </p>
                      <div
                        aria-label="{{forgeAria}}"
                        role="img"
                        style="display: flex; align-items: center; gap: 6px"
                      >
                        <sc-for list="{{forge}}" as="f" hint-placeholder-count="4">
                          <svg viewBox="0 0 14 16" style="width: 14px; height: 16px">
                            <polygon
                              points="7,1 13,4.5 13,11.5 7,15 1,11.5 1,4.5"
                              fill="{{f.fill}}"
                              stroke="{{f.stroke}}"
                              stroke-width="1.2"
                              style="transition: fill .2s"
                            ></polygon>
                          </svg>
                        </sc-for>
                        <span style="font-size: 12px; color: #9AA6B6; margin-left: 4px"
                          >{{forgeLabel}}</span
                        >
                      </div>
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 6px">
                    <label for="hx-nname" style="font-size: 13px; font-weight: 500; color: #C9D3DE"
                      >Hero name</label
                    >
                    <input
                      id="hx-nname"
                      class="hx-input"
                      type="text"
                      autocomplete="username"
                      maxlength="20"
                      placeholder="Pick something fun"
                      value="{{nName}}"
                      onInput="{{onNName}}"
                      onFocus="{{fNName}}"
                      onBlur="{{fBlur}}"
                      style="height: 48px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; border: 1px solid #2E3846; background: #0F141B; color: #F2F6FA; font: 400 15px Inter, sans-serif"
                    />
                    <p style="margin: 0; font-size: 12px; color: #8E9AAA">
                      Friends will see this name. Don't use your real name.
                    </p>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 6px">
                    <label for="hx-npass" style="font-size: 13px; font-weight: 500; color: #C9D3DE"
                      >Password</label
                    >
                    <input
                      id="hx-npass"
                      class="hx-input"
                      type="password"
                      autocomplete="new-password"
                      placeholder="At least 8 characters"
                      value="{{nPass}}"
                      onInput="{{onNPass}}"
                      onFocus="{{fNPass}}"
                      onBlur="{{fBlur}}"
                      style="height: 48px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; border: 1px solid #2E3846; background: #0F141B; color: #F2F6FA; font: 400 15px Inter, sans-serif"
                    />
                    <div style="display: flex; align-items: center; gap: 10px">
                      <div
                        style="flex: 1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px"
                      >
                        <sc-for list="{{segs}}" as="g" hint-placeholder-count="4">
                          <span
                            style="height: 4px; border-radius: 2px; background: {{g.bg}}; display: block; transition: background .2s"
                          ></span>
                        </sc-for>
                      </div>
                      <span
                        style="font-size: 12px; font-weight: 600; color: {{strengthColor}}; min-width: 64px; text-align: right"
                        >{{strengthLabel}}</span
                      >
                    </div>
                  </div>
                  <fieldset
                    style="margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 8px"
                  >
                    <legend
                      style="padding: 0; margin-bottom: 8px; font-size: 13px; font-weight: 500; color: #C9D3DE"
                    >
                      School grade — sets your first riddles
                    </legend>
                    <div
                      style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px"
                    >
                      <sc-for list="{{grades}}" as="gr" hint-placeholder-count="4">
                        <button
                          class="hx-chip"
                          type="button"
                          aria-pressed="{{gr.selected}}"
                          onClick="{{gr.pick}}"
                          style="min-height: 44px; border-radius: 12px; border: 1px solid {{gr.border}}; background: {{gr.bg}}; color: #E6EBF2; font: 600 15px Inter, sans-serif; cursor: pointer"
                        >
                          {{gr.label}}
                        </button>
                      </sc-for>
                    </div>
                  </fieldset>
                  <div style="display: flex; flex-direction: column; gap: 6px">
                    <label for="hx-parent" style="font-size: 13px; font-weight: 500; color: #C9D3DE"
                      >Parent or guardian email</label
                    >
                    <input
                      id="hx-parent"
                      class="hx-input"
                      type="email"
                      autocomplete="email"
                      placeholder="grown-up@example.com"
                      value="{{nParent}}"
                      onInput="{{onNParent}}"
                      onFocus="{{fBlur}}"
                      style="height: 48px; box-sizing: border-box; padding: 0 14px; border-radius: 12px; border: 1px solid #2E3846; background: #0F141B; color: #F2F6FA; font: 400 15px Inter, sans-serif"
                    />
                    <p style="margin: 0; font-size: 12px; color: #8E9AAA">
                      A grown-up confirms the account and sees progress reports.
                    </p>
                  </div>
                  <sc-if value="{{hasError}}" hint-placeholder-val="{{ false }}">
                    <p
                      role="alert"
                      style="margin: 0; padding: 10px 12px; border-radius: 10px; background: rgba(229,72,77,0.12); border: 1px solid rgba(229,72,77,0.4); color: #FF9EA2; font-size: 14px"
                    >
                      {{error}}
                    </p>
                  </sc-if>
                  <button
                    class="hx-btn"
                    type="submit"
                    disabled="{{loading}}"
                    style="height: 52px; border: 0; border-radius: 14px; background: {{accent}}; color: #0B1520; font: 700 16px Inter, sans-serif; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: {{forgeGlow}}"
                  >
                    <sc-if value="{{loading}}" hint-placeholder-val="{{ false }}">
                      <svg
                        aria-hidden="true"
                        class="hx-spin"
                        viewBox="0 0 24 24"
                        style="width: 18px; height: 18px"
                        fill="none"
                        stroke="#0B1520"
                        stroke-width="2.4"
                        stroke-linecap="round"
                      >
                        <path d="M12 3a9 9 0 1 1-9 9"></path>
                      </svg>
                      Forging your hero…
                    </sc-if>
                    <sc-if value="{{idle}}" hint-placeholder-val="{{ true }}">Create hero</sc-if>
                  </button>
                </form>
              </sc-if>

              <div
                style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-top: 4px; border-top: 1px solid #1F2732"
              >
                <div style="display: flex; gap: 14px; font-size: 12px; padding-top: 12px">
                  <a href="#" style="text-decoration: none">Terms</a>
                  <a href="#" style="text-decoration: none">Privacy</a>
                </div>
                <button
                  class="hx-chip"
                  type="button"
                  onClick="{{toggleLang}}"
                  aria-label="Change language"
                  style="min-height: 44px; margin-top: 4px; display: flex; align-items: center; gap: 6px; padding: 0 10px; border: 0; border-radius: 10px; background: transparent; color: #C9D3DE; font: 600 12px Inter, sans-serif; cursor: pointer"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    style="width: 16px; height: 16px"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                  >
                    <circle cx="12" cy="12" r="9"></circle>
                    <path
                      d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"
                    ></path>
                  </svg>
                  {{lang}}
                </button>
              </div>
            </div>
          </sc-if>
        </div>
      </div>
    </x-dc>
    <script
      type="text/x-dc"
      data-dc-script
      data-props='{"accent":{"editor":"color","default":"#7FB8E6","options":["#7FB8E6","#8FD3B6","#C9A7F0","#F2C46D"]},"$preview":{"width":390,"height":844}}'
    >
      class Component extends DCLogic {
        constructor(props) {
          super(props);
          this.state = {
            mode: 'signin', user: '', pass: '', show: false, remember: true, caps: false,
            error: '', errTick: 0, loading: false, done: false, who: '',
            runes: [], runeHero: '', nName: '', nPass: '', nGrade: 4, nParent: '', lang: 'EN',
            mx: -999, my: -999, gx: 0, gy: 0, focus: '', blink: false, ripples: [], tip: 0
          };
          this.rid = 0;
        }
        componentDidMount() {
          this.tipTimer = setInterval(() => this.setState({ tip: (this.state.tip + 1) % 3 }), 5000);
          this.blinkTimer = setInterval(() => {
            this.setState({ blink: true });
            this.blinkOff = setTimeout(() => this.setState({ blink: false }), 140);
          }, 4300);
        }
        componentWillUnmount() {
          clearTimeout(this.timer); clearInterval(this.tipTimer); clearInterval(this.blinkTimer); clearTimeout(this.blinkOff);
          if (this.raf) cancelAnimationFrame(this.raf);
        }
        fail(msg) { this.setState({ error: msg, errTick: this.state.errTick + 1 }); }
        finish(who) {
          this.setState({ loading: true, error: '' });
          clearTimeout(this.timer);
          this.timer = setTimeout(() => this.setState({ loading: false, done: true, who: who }), 1300);
        }
        renderVals() {
          const s = this.state;
          const accent = this.props.accent ?? '#7FB8E6';
          const modes = ['signin', 'rune', 'signup'];
          const tabs = [['signin', 'Sign in'], ['rune', 'Hero code'], ['signup', 'New hero']].map((p) => ({
            label: p[1], selected: s.mode === p[0], fg: s.mode === p[0] ? '#F2F6FA' : '#9AA6B6',
            pick: () => this.setState({ mode: p[0], error: '', runes: [], loading: false })
          }));
          const heroColors = { Mira: '#8FD3B6', Tarek: '#F2C46D' };
          const recent = ['Mira', 'Tarek'].map((n) => {
            const sel = s.mode === 'rune' ? s.runeHero === n : s.user === n;
            return {
              name: n, initial: n[0], selected: sel, color: heroColors[n], border: sel ? accent : '#2A3340',
              pick: () => (s.mode === 'rune' ? this.setState({ runeHero: n, runes: [], error: '' }) : this.setState({ user: n, error: '' }))
            };
          });

          // emblem eyes: follow pointer, read along while typing, close while a hidden password is typed
          let ex = s.gx, ey = s.gy;
          if (s.focus === 'user' || s.focus === 'nname') {
            const len = (s.focus === 'user' ? s.user : s.nName).length;
            ex = -4 + Math.min(len, 18) / 18 * 8; ey = 3;
          }
          if (s.focus === 'pass' && s.show) { ex = 4.5; ey = 2; }
          const closed = s.blink || (s.focus === 'pass' && !s.show) || s.focus === 'npass';

          const defs = [
            { id: 'star', label: 'Star', d: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z' },
            { id: 'moon', label: 'Moon', d: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
            { id: 'leaf', label: 'Leaf', d: 'M5 19C5 10 11 5 20 4c-1 9-6 15-15 15zM5 19l7-7' },
            { id: 'flame', label: 'Flame', d: 'M12 3c3 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z' },
            { id: 'drop', label: 'Drop', d: 'M12 3l6 8a7 7 0 1 1-12 0z' },
            { id: 'bolt', label: 'Bolt', d: 'M13 2L4 14h7l-1 8 9-12h-7z' },
            { id: 'sun', label: 'Sun', d: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8' }
          ];
          const pos = [[78, 72], [137, 38], [137, 106], [78, 140], [19, 106], [19, 38], [78, 4]];
          const runes = defs.map((r, i) => {
            const idx = s.runes.indexOf(r.id);
            const picked = idx >= 0;
            return {
              d: r.d, x: pos[i][0], y: pos[i][1], picked: picked, order: idx + 1,
              aria: r.label + ' rune' + (picked ? ', chosen ' + (idx + 1) : ''),
              fill: picked ? '#22374D' : '#141A23', stroke: picked ? accent : '#33404F', ink: picked ? '#F2F6FA' : '#B4C3D3',
              pick: () => {
                if (s.loading) return;
                if (!s.runeHero) { this.fail('First choose who is playing.'); return; }
                if (picked || s.runes.length >= 4) return;
                const next = s.runes.concat([r.id]);
                this.setState({ runes: next, error: '' });
                if (next.length === 4) this.finish(s.runeHero);
              }
            };
          });
          const runePath = s.runes.map((id) => {
            const i = defs.findIndex((d) => d.id === id);
            return (pos[i][0] + 34) + ',' + (pos[i][1] + 36);
          }).join(' ');
          const dots = [0, 1, 2, 3].map((i) => ({ bg: i < s.runes.length ? accent : '#2A3340' }));

          const p = s.nPass;
          let score = 0;
          if (p.length >= 8) score++;
          if (p.length >= 12) score++;
          if (/[0-9]/.test(p)) score++;
          if (/[^A-Za-z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) score++;
          if (p.length > 0 && p.length < 8) score = Math.min(score, 1);
          const sColors = ['#3A4452', '#E5484D', '#F5A524', '#7FB8E6', '#5FD4A0'];
          const sLabels = ['', 'Weak', 'Okay', 'Strong', 'Legendary'];
          const segs = [0, 1, 2, 3].map((i) => ({ bg: i < score ? sColors[score] : '#2A3340' }));
          const gradeColors = { 2: '#8FD3B6', 3: '#F2C46D', 4: '#7FB8E6', 5: '#C9A7F0' };
          const grades = [2, 3, 4, 5].map((g) => ({
            label: String(g), selected: s.nGrade === g,
            bg: s.nGrade === g ? '#22374D' : '#151B24', border: s.nGrade === g ? gradeColors[g] : '#2A3340',
            pick: () => this.setState({ nGrade: g })
          }));
          const emailOk = /.+@.+\..+/.test(s.nParent);
          const steps = [!!s.nName.trim(), score >= 2, true, emailOk];
          const ready = steps.filter(Boolean).length;
          const tokenColor = gradeColors[s.nGrade];
          const forge = steps.map((ok) => ({ fill: ok ? tokenColor : 'transparent', stroke: ok ? tokenColor : '#3A4452' }));

          const tips = [
            'Every step takes Will. Spend it wisely.',
            'Every riddle you solve makes your hero stronger.',
            'Friends can join your adventure at any time.'
          ];
          const tipDots = tips.map((t, i) => ({
            w: i === s.tip ? 24 : 8, bg: i === s.tip ? accent : '#3A4452', aria: 'Show tip ' + (i + 1),
            pick: () => {
              clearInterval(this.tipTimer);
              this.setState({ tip: i });
              this.tipTimer = setInterval(() => this.setState({ tip: (this.state.tip + 1) % 3 }), 5000);
            }
          }));

          return {
            accent: accent, tabs: tabs, tabIndex: modes.indexOf(s.mode), recent: recent,
            runes: runes, runePath: runePath, dots: dots, segs: segs, grades: grades,
            done: s.done, notDone: !s.done, who: s.who,
            isSignin: s.mode === 'signin', isRune: s.mode === 'rune', isSignup: s.mode === 'signup',
            user: s.user, pass: s.pass, nName: s.nName, nPass: s.nPass, nParent: s.nParent, nGrade: s.nGrade,
            passType: s.show ? 'text' : 'password', show: s.show, hide: !s.show, showAria: s.show ? 'Hide password' : 'Show password',
            caps: s.caps, remember: s.remember, switchBg: s.remember ? accent : '#2E3846', knobLeft: s.remember ? 19 : 3,
            error: s.error, hasError: !!s.error, loading: s.loading, idle: !s.loading,
            strengthLabel: p.length === 0 ? '' : sLabels[Math.max(score, 1)], strengthColor: sColors[Math.max(score, 1)],
            runeProgress: s.runes.length + ' of 4 runes chosen', lang: s.lang,
            eyeT: ex.toFixed(1) + 'px, ' + ey.toFixed(1) + 'px', openOp: closed ? 0 : 1, closedOp: closed ? 1 : 0,
            beat: s.loading ? 0.5 : (s.focus ? 1.5 : 2.4),
            shakeClass: s.errTick === 0 ? '' : (s.errTick % 2 ? 'hx-shakeA' : 'hx-shakeB'),
            spotX: s.mx + 60, spotY: s.my + 60, ripples: s.ripples,
            tipText: tips[s.tip], tipClass: s.tip % 2 ? 'hx-fadeB' : 'hx-fadeA', tipDots: tipDots,
            signinGlow: s.user && s.pass ? '0 0 0 4px rgba(127,184,230,0.18), 0 10px 30px rgba(127,184,230,0.35)' : '0 8px 24px rgba(127,184,230,0.2)',
            tokenName: s.nName.trim() || 'Your hero', tokenInitial: (s.nName.trim()[0] || '?').toUpperCase(),
            tokenColor: tokenColor, tokenGlow: ready === 4 ? tokenColor : 'rgba(0,0,0,0)',
            forge: forge, forgeLabel: ready === 4 ? 'Ready!' : ready + ' / 4', forgeAria: ready + ' of 4 steps done',
            forgeGlow: ready === 4 ? '0 0 0 4px rgba(127,184,230,0.18), 0 10px 30px rgba(127,184,230,0.35)' : 'none',

            onMove: (e) => {
              const root = e.currentTarget;
              const r = root.getBoundingClientRect();
              const em = root.querySelector('[data-emblem]');
              let gx = 0, gy = 0;
              if (em) {
                const er = em.getBoundingClientRect();
                const dx = e.clientX - (er.left + er.width / 2);
                const dy = e.clientY - (er.top + er.height * 0.39);
                const d = Math.max(1, Math.hypot(dx, dy));
                const k = Math.min(1, d / 220);
                gx = dx / d * 4.5 * k; gy = dy / d * 3.5 * k;
              }
              this.pend = { mx: e.clientX - r.left, my: e.clientY - r.top, gx: gx, gy: gy };
              if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.setState(this.pend); });
            },
            onLeave: () => this.setState({ mx: -999, my: -999, gx: 0, gy: 0 }),
            onDown: (e) => {
              if (e.target.closest && e.target.closest('[data-card]')) return;
              const r = e.currentTarget.getBoundingClientRect();
              const id = ++this.rid;
              const rp = { id: id, x: e.clientX - r.left - 60, y: e.clientY - r.top - 60 };
              this.setState({ ripples: this.state.ripples.concat([rp]).slice(-6) });
              setTimeout(() => this.setState({ ripples: this.state.ripples.filter((q) => q.id !== id) }), 950);
            },
            fUser: () => this.setState({ focus: 'user' }),
            fPass: () => this.setState({ focus: 'pass' }),
            fNName: () => this.setState({ focus: 'nname' }),
            fNPass: () => this.setState({ focus: 'npass' }),
            fBlur: () => this.setState({ focus: '' }),
            keepFocus: (e) => e.preventDefault(),
            onUser: (e) => this.setState({ user: e.target.value, error: '' }),
            onPass: (e) => this.setState({ pass: e.target.value, error: '' }),
            onKey: (e) => this.setState({ caps: !!(e.getModifierState && e.getModifierState('CapsLock')) }),
            onNName: (e) => this.setState({ nName: e.target.value, error: '' }),
            onNPass: (e) => this.setState({ nPass: e.target.value, error: '' }),
            onNParent: (e) => this.setState({ nParent: e.target.value, error: '' }),
            toggleShow: () => this.setState({ show: !s.show }),
            toggleRemember: () => this.setState({ remember: !s.remember }),
            toggleLang: () => this.setState({ lang: s.lang === 'EN' ? 'UA' : 'EN' }),
            clearRunes: () => this.setState({ runes: [], error: '' }),
            reset: () => { clearTimeout(this.timer); this.setState({ done: false, loading: false, runes: [], pass: '', error: '' }); },
            passkey: () => this.finish(s.user.trim() || 'hero'),
            submit: (e) => {
              e.preventDefault();
              if (s.loading) return;
              if (!s.user.trim()) { this.fail('Enter your hero name to continue.'); return; }
              if (!s.pass) { this.fail('Enter your password.'); return; }
              this.finish(s.user.trim());
            },
            signup: (e) => {
              e.preventDefault();
              if (s.loading) return;
              if (!s.nName.trim()) { this.fail('Choose a hero name.'); return; }
              if (score < 2) { this.fail('Make the password a little stronger.'); return; }
              if (!emailOk) { this.fail('Add a grown-up’s email so they can confirm.'); return; }
              this.finish(s.nName.trim());
            }
          };
        }
      }
    </script>
  </body>
</html>
```
