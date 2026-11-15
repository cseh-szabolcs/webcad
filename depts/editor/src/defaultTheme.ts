import type { DisplayTheme } from 'app/cad/renderer/displayColor';
import { DEFAULT_EDITOR_SETTINGS } from 'app/settings/editorSettings';

/**
 * Light or dark mode until the browser remembers a choice: `data-default-theme` on `#root` (the
 * Symfony page, EDITOR_THEME), else `VITE_THEME`, else the setting `theme`; null = the system's.
 */
export function defaultTheme(
    root: HTMLElement | null = document.getElementById('root'),
    setting: DisplayTheme | null = DEFAULT_EDITOR_SETTINGS.theme,
): DisplayTheme | null {
    const value = root?.dataset.defaultTheme || import.meta.env.VITE_THEME;
    return value === 'light' || value === 'dark' ? value : setting;
}
