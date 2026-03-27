// context/LanguageContext.tsx

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_LANGUAGE, Language, LANGUAGES } from "@/constants/languages";

const STORAGE_KEY = "agri_language";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANGUAGE,
  setLanguage: async () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  // On mount, restore persisted language choice
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((savedCode) => {
        if (savedCode) {
          const found = LANGUAGES.find((l) => l.code === savedCode);
          if (found) setLanguageState(found);
        }
      })
      .catch(() => {
        // If AsyncStorage fails, silently fall back to default
      });
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang.code);
    } catch {
      // Persist failure is non-critical — state is already updated
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  return useContext(LanguageContext);
}
