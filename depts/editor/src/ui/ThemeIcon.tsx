import type { ThemePreference } from './theme';

/** Paths of the usual icons in a 24×24 box: sun, moon and monitor. */
const ICON_PATHS: Record<ThemePreference, string> = {
    light: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M6.34 17.66l-1.41 1.41 M19.07 4.93l-1.41 1.41',
    dark: 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z',
    system: 'M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M8 20h8 M12 16v4',
};

/** Icon of a theme choice, drawn in the text colour. */
export function ThemeIcon({ theme }: { theme: ThemePreference }) {
    return (
        <svg className="theme-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICON_PATHS[theme]} />
        </svg>
    );
}
