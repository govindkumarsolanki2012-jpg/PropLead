import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, TranslationDictionary, translations } from '../i18n/translations';
import { LeadStatus, LeadPriority, RequirementType } from '../types';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationDictionary, params?: Record<string, string | number>) => string;
  translateStatus: (status: LeadStatus) => string;
  translatePriority: (priority: LeadPriority) => string;
  translateRequirement: (req: RequirementType) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'proplead_app_language';

interface LanguageProviderProps {
  children: React.ReactNode;
  initialLanguage?: Language;
  onLanguageChange?: (lang: Language) => void;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  initialLanguage,
  onLanguageChange,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (initialLanguage) return initialLanguage;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'hi' || saved === 'hinglish') {
        return saved as Language;
      }
    } catch {
      // ignore
    }
    return 'en';
  });

  // Sync if initialLanguage prop changes externally
  useEffect(() => {
    if (initialLanguage && (initialLanguage === 'en' || initialLanguage === 'hi' || initialLanguage === 'hinglish')) {
      setLanguageState(initialLanguage);
    }
  }, [initialLanguage]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
  }, [onLanguageChange]);

  const t = useCallback((key: keyof TranslationDictionary, params?: Record<string, string | number>): string => {
    const dict = translations[language] || translations.en;
    let text = dict[key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }
    return text;
  }, [language]);

  const translateStatus = useCallback((status: LeadStatus): string => {
    const keyMap: Record<LeadStatus, keyof TranslationDictionary> = {
      new: 'status_new',
      contacted: 'status_contacted',
      site_visit_scheduled: 'status_site_visit_scheduled',
      site_visit_completed: 'status_site_visit_completed',
      negotiation: 'status_negotiation',
      advance_paid: 'status_advance_paid',
      closed: 'status_closed',
      lost: 'status_lost',
    };
    const key = keyMap[status];
    return key ? t(key) : status;
  }, [t]);

  const translatePriority = useCallback((priority: LeadPriority): string => {
    const keyMap: Record<LeadPriority, keyof TranslationDictionary> = {
      hot: 'priority_hot',
      warm: 'priority_warm',
      cold: 'priority_cold',
    };
    const key = keyMap[priority];
    return key ? t(key) : priority;
  }, [t]);

  const translateRequirement = useCallback((req: RequirementType): string => {
    const keyMap: Record<RequirementType, keyof TranslationDictionary> = {
      buy: 'req_buy',
      rent: 'req_rent',
      sell: 'req_sell',
      lease: 'req_lease',
    };
    const key = keyMap[req];
    return key ? t(key) : req;
  }, [t]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        translateStatus,
        translatePriority,
        translateRequirement,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    const fallbackT = (key: keyof TranslationDictionary, params?: Record<string, string | number>): string => {
      let text = translations.en[key] || key;
      if (params) {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        });
      }
      return text;
    };
    return {
      language: 'en',
      setLanguage: () => {},
      t: fallbackT,
      translateStatus: (s) => s,
      translatePriority: (p) => p,
      translateRequirement: (r) => r,
    };
  }
  return context;
};

export const useTranslation = useLanguage;
