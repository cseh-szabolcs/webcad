import { describe, expect, it } from 'vitest';
import { crosshairParts } from './CrosshairCursor';

const AREA = { width: 1000, height: 600 };

describe('crosshairParts', () => {
    it('draws four arms that stop at the pick box', () => {
        // 5 % of the larger side (1000 px) = 50 px in total, so 25 px from the centre
        const { lines, pickbox } = crosshairParts({ crosshairSize: 5, pickboxSize: 5, showPickbox: true }, AREA);
        expect(pickbox).toEqual({ x: -5, y: -5, width: 11, height: 11 });
        expect(lines).toEqual([
            { x: -25, y: 0, width: 20, height: 1 },
            { x: 6, y: 0, width: 20, height: 1 },
            { x: 0, y: -25, width: 1, height: 20 },
            { x: 0, y: 6, width: 1, height: 20 },
        ]);
    });

    it('draws two continuous lines without the pick box', () => {
        const { lines, pickbox } = crosshairParts({ crosshairSize: 5, pickboxSize: 5, showPickbox: false }, AREA);
        expect(pickbox).toBeNull();
        expect(lines).toEqual([
            { x: -25, y: 0, width: 51, height: 1 },
            { x: 0, y: -25, width: 1, height: 51 },
        ]);
    });

    it('reaches every edge at 100 %, wherever the cursor is', () => {
        const { lines } = crosshairParts({ crosshairSize: 100, pickboxSize: 5, showPickbox: false }, AREA);
        expect(lines[0]).toEqual({ x: -1000, y: 0, width: 2001, height: 1 });
        expect(lines[1]).toEqual({ x: 0, y: -1000, width: 1, height: 2001 });
    });

    it('shows only the pick box when the crosshair is smaller than it', () => {
        const { lines, pickbox } = crosshairParts({ crosshairSize: 1, pickboxSize: 5, showPickbox: true }, AREA);
        expect(lines).toEqual([]);
        expect(pickbox).not.toBeNull();
    });
});
