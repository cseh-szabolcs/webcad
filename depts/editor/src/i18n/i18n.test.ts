import { afterEach, describe, expect, it } from 'vitest';
import { snapModeLabel } from 'app/cad/editor/snapping/SnapMode';
import { polarTooltipText, snapTooltipText } from 'app/ui/SnapMarker';
import { i18n, readLanguage, t } from './i18n';
import { de } from './locales/de';
import { en } from './locales/en';

/** Every key path of a translation tree, e.g. "prompt.idle". */
function keys(tree: object, prefix = ''): string[] {
    return Object.entries(tree).flatMap(([key, value]) =>
        typeof value === 'string' ? [prefix + key] : keys(value as object, `${prefix}${key}.`),
    );
}

/** Interpolation names in a text, e.g. ["count", "total"]. */
function placeholders(text: string): string[] {
    return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
}

describe('i18n', () => {
    afterEach(async () => {
        await i18n.changeLanguage('de');
    });

    it('has the same keys and placeholders in both languages', () => {
        expect(keys(en)).toEqual(keys(de));
        for (const key of keys(de)) {
            expect(placeholders(i18n.t(key as never, { lng: 'en' })), key).toEqual(placeholders(i18n.t(key as never, { lng: 'de' })));
        }
    });

    it('interpolates without escaping, as prompts contain < and >', () => {
        expect(t('prompt.basePoint')).toBe('Basispunkt angeben oder [Verschiebung] <Verschiebung>:');
        expect(t('message.undone', { command: '<x>' })).toBe('Rückgängig: <x>');
    });

    it('switches the snap texts to English', async () => {
        await i18n.changeLanguage('en');
        expect(snapModeLabel('CEN')).toBe('Center');
        expect(snapTooltipText('INT', { index: 1, count: 3 })).toBe('Intersection (Tab 2/3)');
        expect(polarTooltipText(125.4, 45)).toBe('Polar: 125.40 < 45°');
    });

    it('takes a German browser language, else English, without remembered choice', () => {
        const language = Object.getOwnPropertyDescriptor(globalThis.navigator, 'language');
        try {
            Object.defineProperty(globalThis.navigator, 'language', { value: 'de-AT', configurable: true });
            expect(readLanguage()).toBe('de');
            Object.defineProperty(globalThis.navigator, 'language', { value: 'fr-FR', configurable: true });
            expect(readLanguage()).toBe('en');
        } finally {
            if (language) {
                Object.defineProperty(globalThis.navigator, 'language', language);
            } else {
                delete (globalThis.navigator as { language?: string }).language;
            }
        }
    });
});
