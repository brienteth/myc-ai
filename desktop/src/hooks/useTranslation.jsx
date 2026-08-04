import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const TranslationContext = createContext();

export function TranslationProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('myc_language') || 'tr';
  });

  useEffect(() => {
    localStorage.setItem('myc_language', lang);
  }, [lang]);

  const t = (key) => {
    return translations[lang]?.[key] || key;
  };

  return (
    <TranslationContext.Provider value={{ t, lang, setLang }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  return useContext(TranslationContext);
}
