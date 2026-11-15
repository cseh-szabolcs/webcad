import { describe, expect, it } from 'vitest';
import { initialPreference, resolveTheme } from './theme';

describe('resolveTheme', () => {
    it('follows the system setting for "system"', () => {
        expect(resolveTheme('system', true)).toBe('dark');
        expect(resolveTheme('system', false)).toBe('light');
    });

    it('overrides the system setting with an explicit choice', () => {
        expect(resolveTheme('light', true)).toBe('light');
        expect(resolveTheme('dark', false)).toBe('dark');
    });
});

describe('initialPreference', () => {
    it('takes the choice remembered by the browser first', () => {
        expect(initialPreference('system', 'dark')).toBe('system');
        expect(initialPreference('light', 'dark')).toBe('light');
    });

    it('falls back to the setting, and to the system without one', () => {
        expect(initialPreference(null, 'dark')).toBe('dark');
        expect(initialPreference('bogus', 'light')).toBe('light');
        expect(initialPreference(null, null)).toBe('system');
    });
});
