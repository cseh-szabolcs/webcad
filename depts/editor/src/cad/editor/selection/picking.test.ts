import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { buildElementShapes } from './ElementShapes';
import { pickAt } from './picking';

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
