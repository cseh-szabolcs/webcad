import { describe, expect, it } from 'vitest';
import { ucsIconPath } from './UcsIcon';

describe('ucsIconPath', () => {
    it('draws the square around the origin and both axes from its edge', () => {
        expect(ucsIconPath(40, 8)).toBe('M-4 -4H4V4H-4ZM4 0H40M0 -4V-40');
    });
});
