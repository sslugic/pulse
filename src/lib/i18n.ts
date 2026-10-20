import { getLocales } from 'expo-localization';

import { STRINGS } from '@/i18n';

// Pulse follows the phone's language (iOS also lets people pick one just for Pulse in Settings →
// Pulse → Language). English is the source; any string missing in a translation falls back to it.

export const LANGUAGES = ['en', 'es', 'de', 'fr', 'it', 'pt'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', es: 'Spanish', de: 'German', fr: 'French', it: 'Italian', pt: 'Portuguese' };

function detect(): Language {
  for (const l of getLocales()) {
    const code = l.languageCode as Language | null;
    if (code && (LANGUAGES as readonly string[]).includes(code)) return code;
  }
  return 'en';
}

/** The app's language for this launch. */
export const language: Language = detect();
/** BCP 47 tag for number and date formatting in the app's language. */
export const locale = getLocales().find((l) => l.languageCode === language)?.languageTag ?? language;

type Vars = Record<string, string | number>;

/**
 * Translated text for a key like "arcade.title". `{name}` placeholders are filled from `vars`.
 * Plurals: pass `count` and keep `key_one` / `key_other` variants; `t('x', { count })` picks one.
 */
export function t(key: string, vars?: Vars): string {
  const dot = key.indexOf('.');
  const ns = STRINGS[key.slice(0, dot) as keyof typeof STRINGS] as Record<string, Record<string, string>> | undefined;
  const k = key.slice(dot + 1);
  const pick = (lang: string) => {
    const table = ns?.[lang];
    if (!table) return undefined;
    if (vars && typeof vars.count === 'number') {
      const form = new Intl.PluralRules(lang).select(vars.count);
      return table[`${k}_${form}`] ?? table[`${k}_other`] ?? table[k];
    }
    return table[k];
  };
  const text = pick(language) ?? pick('en') ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : text;
}
