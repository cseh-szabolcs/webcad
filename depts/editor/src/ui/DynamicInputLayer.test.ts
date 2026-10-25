import { describe, expect, it } from 'vitest';
import { angleArcGeometry, boundMarkerPath, dimensionGeometry } from './DynamicInputLayer';

describe('dimensionGeometry', () => {
    it('offsets the dimension line of a horizontal line upwards, with extension lines and ticks', () => {
        const geometry = dimensionGeometry({ x: 0, y: 100 }, { x: 200, y: 100 })!;
        // Dimension line, then the extension lines at both points, then a tick at each end
        expect(geometry.path).toBe(
            'M0 76L200 76' + 'M0 97L0 72' + 'M200 97L200 72' + 'M-2.83 78.83L2.83 73.17' + 'M197.17 78.83L202.83 73.17',
        );
        expect(geometry.label).toEqual({ x: 100, y: 76 });
    });

    it('keeps the dimension on the upper side whichever way the line runs, left of a vertical one', () => {
        expect(dimensionGeometry({ x: 200, y: 100 }, { x: 0, y: 100 })!.label).toEqual({ x: 100, y: 76 });
        expect(dimensionGeometry({ x: 0, y: 0 }, { x: 0, y: 100 })!.label).toEqual({ x: -24, y: 50 });
        expect(dimensionGeometry({ x: 0, y: 100 }, { x: 0, y: 0 })!.label).toEqual({ x: -24, y: 50 });
    });

    it('draws nothing for a line shorter than a pixel', () => {
        expect(dimensionGeometry({ x: 5, y: 5 }, { x: 5.5, y: 5 })).toBeNull();
    });
});

describe('angleArcGeometry', () => {
    it('draws the reference line and the arc counter-clockwise to the line (Y up in the model)', () => {
        // Straight up on screen is 90° in the model
        const geometry = angleArcGeometry({ x: 0, y: 0 }, { x: 0, y: -100 })!;
        expect(geometry.path).toBe('M0 0H64M60 0A60 60 0 0 0 0 -60');
        expect(geometry.label.x).toBeCloseTo(74 * Math.SQRT1_2);
        expect(geometry.label.y).toBeCloseTo(-74 * Math.SQRT1_2);
    });

    it('takes the large arc beyond 180° and runs through a near point', () => {
        // Down on screen is 270°, 30 px away
        expect(angleArcGeometry({ x: 0, y: 0 }, { x: 0, y: 30 })!.path).toBe('M0 0H34M30 0A30 30 0 1 0 0 30');
        expect(angleArcGeometry({ x: 0, y: 0 }, { x: 0.2, y: 0 })).toBeNull();
    });
});

describe('boundMarkerPath', () => {
    it('draws an x around the point', () => {
        expect(boundMarkerPath({ x: 10, y: 20 })).toBe('M6 16L14 24M6 24L14 16');
    });
});
