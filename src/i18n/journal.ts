// Strings for: journal. English is the source; every other language should have the same keys.
const en = {} as const;

const strings: Record<'en' | 'es' | 'de' | 'fr' | 'it' | 'pt', Partial<Record<keyof typeof en, string>>> = { en, es: {}, de: {}, fr: {}, it: {}, pt: {} };
export default strings;
