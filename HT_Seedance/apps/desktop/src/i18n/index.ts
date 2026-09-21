import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './locales/en/common.json';
import viCommon from './locales/vi/common.json';
import enAccounts from './locales/en/accounts.json';
import viAccounts from './locales/vi/accounts.json';
import enErrors from './locales/en/errors.json';
import viErrors from './locales/vi/errors.json';
export type Language = 'vi' | 'en';
const saved = localStorage.getItem('ht-language');
const detected: Language =
  saved === 'vi' || saved === 'en'
    ? saved
    : navigator.language.toLowerCase().startsWith('vi')
      ? 'vi'
      : 'en';
const missing = new Set<string>();
void i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, accounts: enAccounts, errors: enErrors },
    vi: { common: viCommon, accounts: viAccounts, errors: viErrors },
  },
  lng: detected,
  fallbackLng: 'en',
  supportedLngs: ['vi', 'en'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (_languages, namespace, key) => {
    const id = `${namespace}:${key}`;
    if (import.meta.env.DEV && !missing.has(id)) {
      missing.add(id);
      console.warn(`Missing translation: ${id}`);
    }
  },
});
i18n.on('languageChanged', (language) => {
  localStorage.setItem('ht-language', language);
  document.documentElement.lang = language;
});
document.documentElement.lang = detected;
export const formatDate = (value: string | Date, language = i18n.language) =>
  new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
export const formatNumber = (value: number, language = i18n.language) =>
  new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US').format(value);
export const translateStatus = (status: string) =>
  i18n.t(`status.${status}`, { defaultValue: status });
export default i18n;
