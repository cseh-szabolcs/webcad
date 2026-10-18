import { describe, expect, it } from 'vitest';
import { MAX_SCALE, Viewport } from './Viewport';

function expectPoint(actual: { x: number; y: number }, expected: { x: number; y: number }) {
    expect(actual.x).toBeCloseTo(expected.x, 9);
    expect(actual.y).toBeCloseTo(expected.y, 9);
}

describe('Viewport', () => {
    const vp = new Viewport(0.5, { x: 100, y: 400 });

    it('maps model to view and back', () => {
        const p = { x: 1234.5, y: -987.25 };
        expectPoint(vp.viewToModel(vp.modelToView(p)), p);
    });

    it('flips the Y axis (model Y up, view Y down)', () => {
        expectPoint(vp.modelToView({ x: 0, y: 0 }), { x: 100, y: 400 });
        expectPoint(vp.modelToView({ x: 200, y: 200 }), { x: 200, y: 300 });
    });

    it('keeps the anchor point fixed when zooming', () => {
        const anchor = { x: 320, y: 240 };
        const before = vp.viewToModel(anchor);
        const zoomed = vp.zoomAt(anchor, 3);
        expect(zoomed.scale).toBeCloseTo(1.5);
        expectPoint(zoomed.viewToModel(anchor), before);
    });

    it('clamps the scale', () => {
        expect(vp.zoomAt({ x: 0, y: 0 }, 1e9).scale).toBe(MAX_SCALE);
    });

    it('pans in view pixels', () => {
        expectPoint(vp.panBy(10, -20).offset, { x: 110, y: 380 });
    });

    it('fits bounds centred into the view', () => {
        const fitted = Viewport.fitBounds({ x: 0, y: 0, width: 6000, height: 4000 }, { width: 800, height: 600 }, 0);
        expect(fitted.scale).toBeCloseTo(800 / 6000);
        expectPoint(fitted.modelToView({ x: 3000, y: 2000 }), { x: 400, y: 300 });
        expectPoint(fitted.modelToView({ x: 0, y: 4000 }), { x: 0, y: 300 - (4000 * 800) / 6000 / 2 });
    });

    it('fits degenerate bounds without dividing by zero', () => {
        const fitted = Viewport.fitBounds({ x: 5, y: 5, width: 0, height: 0 }, { width: 100, height: 100 });
        expect(fitted.scale).toBe(1);
        expectPoint(fitted.modelToView({ x: 5, y: 5 }), { x: 50, y: 50 });
    });

    it('produces a matrix that agrees with modelToView', () => {
        const [a, b, c, d, tx, ty] = vp.toMatrix();
        const p = { x: 42, y: 17 };
        expectPoint({ x: a * p.x + c * p.y + tx, y: b * p.x + d * p.y + ty }, vp.modelToView(p));
    });
});
