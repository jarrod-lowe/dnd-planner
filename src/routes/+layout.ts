import { loadTranslations } from '$lib/i18n';
import type { LayoutLoad } from './$types';

export const prerender = true;

export const load: LayoutLoad = async ({ url }) => {
  const { pathname } = url;

  // Use English as the initial locale (can be enhanced to detect from cookie/session)
  const initLocale = 'en';

  // Load translations for the current route
  await loadTranslations(initLocale, pathname);

  return {};
};
