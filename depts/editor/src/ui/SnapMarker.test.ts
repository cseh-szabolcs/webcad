import { describe, expect, it } from 'vitest';
import { SNAP_MODES } from 'app/cad/editor/snapping/SnapMode';
import { markerPath, snapTooltipText } from './SnapMarker';

describe('markerPath', () => {
    it('draws the endpoint square and the intersection cross around the centre', () => {
        expect(markerPath('END', 5)).toBe('M-5 -5H5V5H-5Z');
        expect(markerPath('INT', 5)).toBe('M-5 -5L5 5M-5 5L5 -5');
    });

    it('gives every mode its own shape', () => {
        expect(new Set(SNAP_MODES.map((mode) => markerPath(mode, 5))).size).toBe(SNAP_MODES.length);
    });
});

describe('snapTooltipText', () => {
    it('names the mode, with the Tab position while Tab chose the point', () => {
        expect(snapTooltipText('INT')).toBe('Schnittpunkt');
        expect(snapTooltipText('INT', { index: 1, count: 3 })).toBe('Schnittpunkt (Tab 2/3)');
    });
});
