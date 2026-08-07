import { createI18n } from 'vue-i18n';
import type { CompileError, MessageCompiler, MessageContext } from 'vue-i18n';
import IntlMessageFormat from 'intl-messageformat';
import enUi from '@/locales/en/ui.json';
import enContent from '@/locales/en/content.json';
import ukUi from '@/locales/uk/ui.json';
import ukContent from '@/locales/uk/content.json';
import { resolveInitialLocale } from './locale';
import { toPseudoLocale } from './pseudo-locale';

// ICU instead of vue-i18n's built-in message syntax: its default pluralizer
// only knows singular/plural, but uk needs CLDR's 4 categories
// (one/few/many/other — "1 гоблін" / "2 гобліни" / "5 гоблінів"), which ICU's
// compiler already implements for uk out of the box.
const messageCompiler: MessageCompiler = (message, { locale, key, onError }) => {
  if (typeof message !== 'string') {
    onError?.(new Error('i18n message compiler only supports string messages') as CompileError);
    return () => key;
  }

  const formatter = new IntlMessageFormat(message, locale);
  return (ctx: MessageContext) => formatter.format(ctx.values) as string;
};

// Left as an object-literal (not annotated as Record<string, ...>) so
// createI18n() below can infer its Composition-mode overload correctly —
// widening the type breaks that inference and silently degrades
// `i18n.global.locale` from a writable ref to a plain string.
const messages = {
  en: { ...enUi, ...enContent },
  uk: { ...ukUi, ...ukContent },
};

// QA-only pseudo-locale (see pseudo-locale.ts) — generated from en at
// dev-time, never hand-maintained, never shipped to prod (dev-only, and not
// exposed in settings-overlay.vue's switcher). Flip to it locally by
// visiting the app with ?pseudo=1 in the URL: accented/expanded text makes
// both un-t()-wrapped strings and layout overflow from longer translations
// obvious at a glance. Attached via a cast so it doesn't widen `messages`'s
// inferred type (see comment above).
if (import.meta.env.DEV) {
  (messages as Record<string, unknown>)['qa-pseudo'] = toPseudoLocale(messages.en);
}

const usePseudoLocale =
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('pseudo') === '1';

export const i18n = createI18n({
  legacy: false,
  locale: usePseudoLocale ? 'qa-pseudo' : resolveInitialLocale(),
  fallbackLocale: 'en',
  messageCompiler,
  messages,
});
