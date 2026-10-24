import { describe, expect, it } from 'vitest';
import { crosshairParts } from './CrosshairCursor';

const AREA = { width: 1000, height: 600 };
const SETTINGS = { crosshairSize: 5, pickboxSize: 5, showPickbox: true, apertureSize: 10, showApertureBox: false };

describe('crosshairParts', () => {
    it('puts the minus sign off the top right corner of the pick box, 3 px thick', () => {
        // Pick box spans -5…5; 3 px gap, then the sign, as wide as the box
        const { minus } = crosshairParts(SETTINGS, AREA);
        expect(minus).toEqual({ x: 9, y: -11, width: 11, height: 3 });
    });

    it('keeps the minus sign clear of the crosshair lines', () => {
        const { lines, minus } = crosshairParts({ ...SETTINGS, crosshairSize: 20, showPickbox: false }, AREA);
        const overlaps = (a: { x: number; y: number; width: number; height: number }) =>
            a.x < minus.x + minus.width && minus.x < a.x + a.width && a.y < minus.y + minus.height && minus.y < a.y + a.height;
        expect(lines.some(overlaps)).toBe(false);
    });

    it('draws four arms that stop at the pick box', () => {
        // 5 % of the larger side (1000 px) = 50 px in total, so 25 px from the centre
        const { lines, box } = crosshairParts(SETTINGS, AREA);
        expect(box).toEqual({ x: -5, y: -5, width: 11, height: 11 });
        expect(lines).toEqual([
            { x: -25, y: 0, width: 20, height: 1 },
            { x: 6, y: 0, width: 20, height: 1 },
            { x: 0, y: -25, width: 1, height: 20 },
            { x: 0, y: 6, width: 1, height: 20 },
        ]);
    });

    it('draws two continuous lines without the pick box', () => {
        const { lines, box } = crosshairParts({ ...SETTINGS, showPickbox: false }, AREA);
        expect(box).toBeNull();
        expect(lines).toEqual([
            { x: -25, y: 0, width: 51, height: 1 },
            { x: 0, y: -25, width: 1, height: 51 },
        ]);
    });

    it('reaches every edge at 100 %, wherever the cursor is', () => {
        const { lines } = crosshairParts({ ...SETTINGS, crosshairSize: 100, showPickbox: false }, AREA);
        expect(lines[0]).toEqual({ x: -1000, y: 0, width: 2001, height: 1 });
        expect(lines[1]).toEqual({ x: 0, y: -1000, width: 1, height: 2001 });
    });

    it('shows only the pick box when the crosshair is smaller than it', () => {
        const { lines, box } = crosshairParts({ ...SETTINGS, crosshairSize: 1 }, AREA);
        expect(lines).toEqual([]);
        expect(box).not.toBeNull();
    });

    it('shows only the pick box while objects are selected', () => {
        const { lines, box } = crosshairParts({ ...SETTINGS, showPickbox: false }, AREA, 'select');
        expect(lines).toEqual([]);
        expect(box).toEqual({ x: -5, y: -5, width: 11, height: 11 });
    });

    it('draws continuous lines without the pick box at point prompts', () => {
        const { lines, box } = crosshairParts(SETTINGS, AREA, 'point');
        expect(box).toBeNull();
        expect(lines).toEqual([
            { x: -25, y: 0, width: 51, height: 1 },
            { x: 0, y: -25, width: 1, height: 51 },
        ]);
    });

    it('stops the lines at the aperture box at point prompts when it is shown', () => {
        const { lines, box } = crosshairParts({ ...SETTINGS, showApertureBox: true }, AREA, 'point');
        expect(box).toEqual({ x: -10, y: -10, width: 21, height: 21 });
        expect(lines[0]).toEqual({ x: -25, y: 0, width: 15, height: 1 });
        expect(lines[1]).toEqual({ x: 11, y: 0, width: 15, height: 1 });
    });
});
