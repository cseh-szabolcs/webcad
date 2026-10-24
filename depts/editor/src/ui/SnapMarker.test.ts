import { describe, expect, it } from 'vitest';
import { SNAP_MODES } from 'app/cad/editor/snapping/SnapMode';
import { markerPath, polarTooltipText, previewPath, snapTooltipText } from './SnapMarker';

describe('markerPath', () => {
    it('draws the endpoint square and the intersection cross around the centre', () => {
        expect(markerPath('END', 5)).toBe('M-5 -5H5V5H-5Z');
        expect(markerPath('INT', 5)).toBe('M-5 -5L5 5M-5 5L5 -5');
    });

    it('gives every mode its own shape', () => {
        expect(new Set(SNAP_MODES.map((mode) => markerPath(mode, 5))).size).toBe(SNAP_MODES.length);
    });

    it('draws the geometric centre as a circle with a dot in the middle', () => {
        expect(markerPath('GCE', 5)).toBe(markerPath('CEN', 5) + 'M-1 0A1 1 0 1 0 1 0A1 1 0 1 0 -1 0Z');
        // The dot keeps at least 0.5 px radius
        expect(markerPath('GCE', 1, { x: 10, y: 20 })).toBe(
            markerPath('CEN', 1, { x: 10, y: 20 }) + 'M9.5 20A0.5 0.5 0 1 0 10.5 20A0.5 0.5 0 1 0 9.5 20Z',
        );
    });

    it('draws the marker around a given centre', () => {
        expect(markerPath('END', 5, { x: 100, y: 50 })).toBe('M95 45H105V55H95Z');
        expect(markerPath('QUA', 2, { x: 10, y: 20 })).toBe('M10 18L12 20L10 22L8 20Z');
    });
});

describe('previewPath', () => {
    it('draws all preview markers in one path, smaller than the snap marker', () => {
        const markers = [
            { viewPoint: { x: 100, y: 50 }, mode: 'END' as const },
            { viewPoint: { x: 20, y: 30 }, mode: 'INT' as const },
        ];
        // Snap marker half size 5 → preview half size 3
        expect(previewPath(markers, 5)).toBe('M97 47H103V53H97Z' + 'M17 27L23 33M17 33L23 27');
        expect(previewPath([], 5)).toBe('');
    });

    it('keeps the markers at least 1 px', () => {
        expect(previewPath([{ viewPoint: { x: 0, y: 0 }, mode: 'END' }], 1)).toBe('M-1 -1H1V1H-1Z');
    });
});

describe('snapTooltipText', () => {
    it('names the mode, with the Tab position while Tab chose the point', () => {
        expect(snapTooltipText('INT')).toBe('Schnittpunkt');
        expect(snapTooltipText('INT', { index: 1, count: 3 })).toBe('Schnittpunkt (Tab 2/3)');
    });
});

describe('polarTooltipText', () => {
    it('gives the distance with two decimals and the angle', () => {
        expect(polarTooltipText(125.4, 45)).toBe('Polar: 125.40 < 45°');
        expect(polarTooltipText(1000, 22.5)).toBe('Polar: 1000.00 < 22.5°');
    });
});
