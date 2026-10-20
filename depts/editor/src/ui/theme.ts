import { useEffect, useLayoutEffect, useState } from 'react';
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

/**
 * Light/dark mode of the whole editor. The preference is remembered per browser; the
 * resolved theme is set as `data-theme` on <html>, where the CSS colour tokens pick it up.
 */
export function useTheme(): {
    preference: ThemePreference;
    setPreference: (preference: ThemePreference) => void;
    theme: DisplayTheme;
} {
    const [preference, setPreference] = useState<ThemePreference>(readPreference);
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

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, preference);
        } catch {
            // Storage blocked (private mode): the choice just is not remembered
        }
    }, [preference]);

    return { preference, setPreference, theme };
}

function readPreference(): ThemePreference {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
            return stored;
        }
    } catch {
        // Storage blocked: fall back to the system setting
    }
    return 'system';
}
