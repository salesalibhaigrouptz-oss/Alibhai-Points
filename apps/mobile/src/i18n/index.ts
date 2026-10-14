import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import sw from './sw.json';
import en from './en.json';

const LANGUAGE_KEY = '@alibhai_points_language';

export const LANGUAGE_SW = 'sw';
export const LANGUAGE_EN = 'en';

const resources = {
  sw: { translation: sw },
  en: { translation: en },
};

const initI18n = async () => {
  const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
  const language = savedLanguage || LANGUAGE_SW;

  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: LANGUAGE_SW,
    interpolation: {
      escapeValue: false,
    },
  });
};

export const saveLanguage = async (language: string) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
  await i18n.changeLanguage(language);
};

export const getCurrentLanguage = () => i18n.language;

export default initI18n;
