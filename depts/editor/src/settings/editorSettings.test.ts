import { describe, expect, it } from 'vitest';
import { DEFAULT_TRACKING_MODES, withOrtho, withPolar } from './editorSettings';

describe('Ortho and polar tracking', () => {
    it('switches polar tracking off when Ortho goes on, keeping its angles', () => {
        const polar = { enabled: true, incrementAngle: 45, additionalAngles: [30] };
        expect(withOrtho({ ortho: false, polar }, true)).toEqual({ ortho: true, polar: { ...polar, enabled: false } });
    });

    it('leaves polar tracking off when Ortho goes off', () => {
        const modes = withOrtho(DEFAULT_TRACKING_MODES, true);
        expect(withOrtho(modes, false)).toEqual({ ortho: false, polar: modes.polar });
    });

    it('switches Ortho off when polar tracking goes on, but not for other changes', () => {
        const modes = withOrtho(DEFAULT_TRACKING_MODES, true);
        expect(withPolar(modes, { ...modes.polar, incrementAngle: 30 }).ortho).toBe(true);
        expect(withPolar(modes, { ...modes.polar, enabled: true })).toEqual({
            ortho: false,
            polar: { ...modes.polar, enabled: true },
        });
    });
});
