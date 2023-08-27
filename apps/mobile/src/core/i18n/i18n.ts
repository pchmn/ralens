import 'intl-pluralrules';

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { NativeModules, Platform } from 'react-native';

import enTranslations from './en.json';
import frTranslations from './fr.json';

const resources = {
  en: {
    translation: enTranslations,
  },
  fr: {
    translation: frTranslations,
  },
};

i18next.use(initReactI18next).init({
  resources,
  lng: getDeviceLocale(),
  interpolation: {
    escapeValue: false,
  },
  fallbackLng: 'en',
});

export function getDeviceLocale() {
  const locale: string =
    Platform.OS === 'ios'
      ? NativeModules.SettingsManager.settings.AppleLocale || NativeModules.SettingsManager.settings.AppleLanguages[0] // iOS 13
      : NativeModules.I18nManager.localeIdentifier;

  return locale ? locale.replace(/_/g, '-') : 'en';
}

export { i18next };
