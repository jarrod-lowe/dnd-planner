import I18n, { type Parser } from 'sveltekit-i18n';

/** Supported locales */
export const locales = ['en', 'en-x-tlh'] as const;
export type Locale = (typeof locales)[number];

/**
 * Translation payloads are free-form key/value maps (`{ name }`, `{ count }`,
 * `{ current, max }`, …). The library's default payload type only allows
 * `default`, which would reject every real placeholder at the call sites.
 */
export type TranslationPayload = Record<string, unknown>;

/** Loader configuration for sveltekit-i18n */
const config = {
  fallbackLocale: 'en',
  loaders: [
    {
      locale: 'en',
      key: '',
      loader: async () => (await import('./en/common.json')).default
    },
    {
      locale: 'en-x-tlh',
      key: '',
      loader: async () => (await import('./en-x-tlh/common.json')).default
    }
  ]
};

/** Initialize the i18n instance */
export const i18n = new I18n<Parser.Params<TranslationPayload>>(config);

/** Export the translation function store */
export const t = i18n.t;

/** Export the locale store */
export const locale = i18n.locale;

/** Export the loading store */
export const isLoading = i18n.loading;

/** Export the initialized store */
export const initialized = i18n.initialized;

/** Export the loadTranslations function */
export const loadTranslations = i18n.loadTranslations;

/**
 * Detects the user's preferred locale based on browser language preferences.
 * Returns the first matching locale from our supported list, or 'en' as fallback.
 */
export function detectLocale(): Locale {
  // Check if running in browser
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  // Get browser language preferences
  const browserLanguages = navigator.languages || [navigator.language];

  // Find first matching locale
  for (const lang of browserLanguages) {
    // Check for exact match first (e.g., 'en-x-tlh')
    if (locales.includes(lang as Locale)) {
      return lang as Locale;
    }
    // Extract the primary language code (e.g., 'en' from 'en-US')
    const primaryLang = lang.split('-')[0].toLowerCase();
    if (locales.includes(primaryLang as Locale)) {
      return primaryLang as Locale;
    }
  }

  // Fallback to English
  return 'en';
}
