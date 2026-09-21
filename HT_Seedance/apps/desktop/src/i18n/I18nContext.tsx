import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from './index';
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
export const useI18n = () => {
  const { i18n, t } = useTranslation();
  return {
    language: (i18n.resolvedLanguage ?? 'en') as Language,
    setLanguage: (value: Language) => void i18n.changeLanguage(value),
    t,
  };
};
