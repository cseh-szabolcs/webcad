import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultTheme } from './defaultTheme';

function root(theme?: string): HTMLElement {
    return { dataset: theme === undefined ? {} : { defaultTheme: theme } } as unknown as HTMLElement;
}

describe('defaultTheme', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('takes the theme the page names', () => {
        vi.stubEnv('VITE_THEME', 'light');
        expect(defaultTheme(root('dark'), null)).toBe('dark');
    });

    it('falls back to VITE_THEME, then to the setting', () => {
        vi.stubEnv('VITE_THEME', 'dark');
        expect(defaultTheme(root(''), null)).toBe('dark');
        vi.stubEnv('VITE_THEME', '');
        expect(defaultTheme(root(), 'light')).toBe('light');
        expect(defaultTheme(null, null)).toBeNull();
    });

    it('ignores an unknown value', () => {
        vi.stubEnv('VITE_THEME', '');
        expect(defaultTheme(root('system'), null)).toBeNull();
    });
});
