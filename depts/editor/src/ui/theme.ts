import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import type { DisplayTheme } from 'app/cad/renderer/displayColor';

/** What the user picked; 'system' follows the operating system's light/dark setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'webcad.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(preference: ThemePreference, systemDark: boolean): DisplayTheme {
    if (preference === 'system') {
        return systemDark ? 'dark' : 'light';
    }
    return preference;
}

/** The choice remembered by this browser, else the setting `theme`, else 'system'. */
export function initialPreference(stored: string | null, setting: DisplayTheme | null): ThemePreference {
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
    }
    return setting ?? 'system';
}

/**
 * Light/dark mode of the whole editor. Only a choice of the user is remembered per browser, so
 * the setting `theme` applies until one is made; the resolved theme is set as `data-theme` on
 * <html>, where the CSS colour tokens pick it up.
 */
export function useTheme(setting: DisplayTheme | null): {
    preference: ThemePreference;
    setPreference: (preference: ThemePreference) => void;
    theme: DisplayTheme;
} {
    const [preference, setPreferenceState] = useState<ThemePreference>(() => initialPreference(readStored(), setting));
    const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
    const theme = resolveTheme(preference, systemDark);

    useEffect(() => {
        const query = window.matchMedia(DARK_QUERY);
        const onChange = () => setSystemDark(query.matches);
        query.addEventListener('change', onChange);
        return () => query.removeEventListener('change', onChange);
    }, []);

    // Before the browser paints, so the page never flashes in the other theme
    useLayoutEffect(() => {
        document.documentElement.dataset.theme = theme;
    }, [theme]);

    const setPreference = useCallback((next: ThemePreference) => {
        setPreferenceState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Storage blocked (private mode): the choice just is not remembered
        }
    }, []);

    return { preference, setPreference, theme };
}

function readStored(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        // Storage blocked: fall back to the setting
        return null;
    }
}
