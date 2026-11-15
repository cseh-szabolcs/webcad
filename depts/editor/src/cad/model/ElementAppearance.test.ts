import { describe, expect, it } from 'vitest';
import { BY_LAYER, commonAppearance } from './ElementAppearance';

describe('commonAppearance', () => {
    it('gives the values all elements share, and undefined where they differ', () => {
        const red = { ...BY_LAYER, color: '#ff0000', lineweight: 50 as const };
        const thin = { ...BY_LAYER, color: '#ff0000', lineweight: 13 as const };
        expect(commonAppearance([red, thin])).toEqual({ color: '#ff0000', linetype: null, lineweight: undefined, transparency: null });
        expect(commonAppearance([red, BY_LAYER])).toEqual({ color: undefined, linetype: null, lineweight: undefined, transparency: null });
    });

    it('overrides nothing for no elements', () => {
        expect(commonAppearance([])).toEqual(BY_LAYER);
    });
});
