import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { buildElementShapes } from './ElementShapes';
import { rectFromCorners } from '../../geometry/selectionGeometry';
import { pickAt, pickCrossing, pickLasso, pickWindow } from './picking';

const { element: E, layer: L } = sampleIds;

const doc = parseDocument(samplePlan);
const shapes = buildElementShapes(doc);
const withLayer = (layerId: string, change: { visible?: boolean; locked?: boolean }): CadDocument => ({
    ...doc,
    layers: doc.layers.map((layer) => (layer.id === layerId ? { ...layer, ...change } : layer)),
});

describe('buildElementShapes', () => {
    it('lists elements in drawing order, elements without a layer first', () => {
        expect(shapes.map((shape) => shape.id)).toEqual([
            E.axis,
            E['wall-outer'],
            E['wall-inner'],
            E['door-leaf'],
            E['door-swing'],
            E.window,
            E.curtain,
            E.table,
            E.sofa,
            E.rug,
        ]);
    });

    it('leaves out elements on hidden and locked layers', () => {
        const ids = (d: CadDocument) => buildElementShapes(d).map((shape) => shape.id);
        expect(ids(withLayer(L.furniture, { visible: false }))).not.toContain(E.table);
        expect(ids(withLayer(L.furniture, { locked: true }))).not.toContain(E.sofa);
        expect(ids(withLayer(L.furniture, { locked: true }))).toContain(E.window);
    });
});

describe('pickAt', () => {
    it('picks an outline within the tolerance', () => {
        expect(pickAt(shapes, { x: 3000, y: 4 }, 5)).toBe(E['wall-outer']);
        expect(pickAt(shapes, { x: 3000, y: 10 }, 5)).toBeNull();
    });

    it('picks curves on their outline but not inside a filled shape', () => {
        expect(pickAt(shapes, { x: 4600, y: 1802 }, 5)).toBe(E.table);
        expect(pickAt(shapes, { x: 4000, y: 2000 }, 5)).toBeNull();
        expect(pickAt(shapes, { x: 1600, y: 2600 }, 5)).toBe(E.sofa);
        expect(pickAt(shapes, { x: 1600, y: 3000 }, 5)).toBeNull();
    });

    it('prefers the element drawn on top', () => {
        // Shared end point of door leaf and door swing
        expect(pickAt(shapes, { x: 1000, y: 1140 }, 5)).toBe(E['door-swing']);
        // The axis (no layer) lies below the wall at the origin
        expect(pickAt(shapes, { x: 0, y: 0 }, 5)).toBe(E['wall-outer']);
        expect(pickAt(shapes, { x: 120, y: 120 }, 5)).toBe(E.axis);
    });

    it('does not pick elements on locked layers', () => {
        const locked = buildElementShapes(withLayer(L.furniture, { locked: true }));
        expect(pickAt(locked, { x: 4600, y: 1800 }, 5)).toBeNull();
    });
});

describe('pickWindow and pickCrossing', () => {
    const rect = (x1: number, y1: number, x2: number, y2: number) => rectFromCorners({ x: x1, y: y1 }, { x: x2, y: y2 });

    it('window-selects everything inside, in drawing order', () => {
        expect(pickWindow(shapes, rect(-100, -100, 6100, 4100))).toEqual(shapes.map((shape) => shape.id));
    });

    it('window-selects only elements lying completely inside', () => {
        // Around the table; the rug (x 3000–5000, y 1100–2500) sticks out
        expect(pickWindow(shapes, rect(3300, 1100, 4700, 2500))).toEqual([E.table]);
    });

    it('cross-selects elements that are inside or cut', () => {
        expect(pickCrossing(shapes, rect(3300, 1100, 4700, 2500))).toEqual([E.table, E.rug]);
    });

    it('does not cross-select outlines that only surround the rectangle', () => {
        expect(pickCrossing(shapes, rect(3900, 1700, 4100, 1900))).toEqual([]);
    });
});

describe('pickLasso', () => {
    /** Triangle around the table (x 3400–4600, y 1200–2400) whose tip cuts the rug. */
    const triangle = [
        { x: 3300, y: 1150 },
        { x: 4700, y: 1150 },
        { x: 4000, y: 2600 },
    ];
    /** Concave lasso: an arch whose top bar holds window and curtain, its notch over the table. */
    const arch = [
        { x: 3300, y: 1000 },
        { x: 3300, y: 3950 },
        { x: 5100, y: 3950 },
        { x: 5100, y: 1000 },
        { x: 4800, y: 1000 },
        { x: 4800, y: 3000 },
        { x: 3600, y: 3000 },
        { x: 3600, y: 1000 },
    ];

    it('window-selects only elements completely inside the polygon', () => {
        // The triangle is too narrow at the top for the whole circle
        expect(pickLasso(shapes, triangle, 'window')).toEqual([]);
        expect(pickLasso(shapes, arch, 'window')).toEqual([E.window, E.curtain]);
    });

    it('cross-selects elements the polygon cuts', () => {
        expect(pickLasso(shapes, triangle, 'crossing')).toEqual([E.table, E.rug]);
    });

    it('cross-selects what a concave lasso cuts', () => {
        // Inner wall, window and curtain run through the top bar; table and rug are cut by the arms
        expect(pickLasso(shapes, arch, 'crossing')).toEqual([E['wall-inner'], E.window, E.curtain, E.table, E.rug]);
    });

    it('selects nothing with fewer than three points', () => {
        expect(pickLasso(shapes, triangle.slice(0, 2), 'crossing')).toEqual([]);
    });
});
