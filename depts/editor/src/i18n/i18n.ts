import i18next from 'i18next';
import { de, type Translations } from './locales/de';
import { en } from './locales/en';

/** Languages of the editor; German is the reference and the fallback. */
export type Language = 'de' | 'en';

export const LANGUAGES: readonly Language[] = ['de', 'en'];

declare module 'i18next' {
    interface CustomTypeOptions {
        resources: { translation: Translations };
    }
}

const STORAGE_KEY = 'webcad.language';

/**
 * The editor's i18next instance, independent of React, so the editor core and the DOM layers
 * translate with it too (React components through `useTranslation`). Initialized at once,
 * as the texts are bundled.
 */
export const i18n = i18next.createInstance();

i18n.init({
    resources: { de: { translation: de }, en: { translation: en } },
    lng: readLanguage(),
    fallbackLng: 'de',
    supportedLngs: LANGUAGES,
    initAsync: false,
    // React and textContent escape on their own; prompts contain < and >
    interpolation: { escapeValue: false },
});

export const t = i18n.t.bind(i18n);

/** The active language. */
export function currentLanguage(): Language {
    return i18n.resolvedLanguage === 'en' ? 'en' : 'de';
}

/** Switches the language and remembers it per browser. */
export function setLanguage(language: Language): void {
    void i18n.changeLanguage(language);
    try {
        window.localStorage.setItem(STORAGE_KEY, language);
    } catch {
        // Storage blocked (private mode): the choice just is not remembered
    }
}

/** Remembered choice, else the browser language (German for any German locale), else English. */
export function readLanguage(): Language {
    // Only in the browser (Node warns about its global localStorage)
    if (typeof window !== 'undefined') {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored === 'de' || stored === 'en') {
                return stored;
            }
        } catch {
            // Storage blocked: fall back to the browser language
        }
    }
    const browser = typeof navigator === 'undefined' ? '' : navigator.language;
    return browser.toLowerCase().startsWith('de') ? 'de' : 'en';
}

i18n.on('languageChanged', () => {
    if (typeof document !== 'undefined') {
        document.documentElement.lang = currentLanguage();
    }
});
if (typeof document !== 'undefined') {
    document.documentElement.lang = currentLanguage();
}
