import { describe, expect, it } from 'vitest';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { parseDocument } from '../../persistence/CadSerializer';
import { findSnap, snapPoints, type SnapPoint } from './snapPoints';

const { vertex: V, element: E, layer: L } = sampleIds;

const doc = parseDocument(samplePlan);
const round = (n: number) => Math.round(n * 1000) / 1000;
const derivedOf = (id: string) =>
    snapPoints(doc)
        .filter((p): p is Exclude<SnapPoint, { kind: 'vertex' }> => p.kind !== 'vertex' && p.elementId === id)
        .map((p) => ({ kind: p.kind, x: round(p.x), y: round(p.y) }));

describe('snapPoints', () => {
    it('lists every vertex once', () => {
        const vertices = snapPoints(doc).filter((p) => p.kind === 'vertex');
        expect(vertices.map((p) => p.kind === 'vertex' && p.vertexId)).toEqual(doc.vertices.map((v) => v.id));
    });

    it('derives the midpoint of a line', () => {
        expect(derivedOf(E.window)).toEqual([{ kind: 'midpoint', x: 4250, y: 3880 }]);
    });

    it('derives segment midpoints of a polyline, including the closing one', () => {
        expect(derivedOf(E['wall-outer'])).toEqual([
            { kind: 'midpoint', x: 3000, y: 0 },
            { kind: 'midpoint', x: 6000, y: 2000 },
            { kind: 'midpoint', x: 3000, y: 4000 },
            { kind: 'midpoint', x: 0, y: 2000 },
        ]);
    });

    it('derives the point halfway along an arc', () => {
        expect(derivedOf(E['door-swing'])).toEqual([{ kind: 'midpoint', x: 1636.396, y: 876.396 }]);
    });

    it('derives the four quadrant points of an ellipse', () => {
        expect(derivedOf(E.table)).toEqual([
            { kind: 'quadrant', x: 4600, y: 1800 },
            { kind: 'quadrant', x: 4000, y: 2400 },
            { kind: 'quadrant', x: 3400, y: 1800 },
            { kind: 'quadrant', x: 4000, y: 1200 },
        ]);
    });

    it('leaves out elements on hidden or locked layers', () => {
        for (const change of [{ visible: false }, { locked: true }]) {
            const layers = doc.layers.map((layer) => (layer.id === L.furniture ? { ...layer, ...change } : layer));
            const points = snapPoints({ ...doc, layers });
            expect(points.some((p) => p.kind === 'vertex' && p.vertexId === V['t-center'])).toBe(false);
            expect(points.some((p) => p.kind === 'quadrant')).toBe(false);
        }
    });
});

describe('findSnap', () => {
    it('returns the nearest snap point within the radius', () => {
        expect(findSnap(doc, { x: 6005, y: 3995 }, 10, V['win-1'])).toMatchObject({ kind: 'vertex', vertexId: V['w-o3'] });
        expect(findSnap(doc, { x: 4253, y: 3877 }, 10, V['win-1'])).toBeNull();
        expect(findSnap(doc, { x: 4253, y: 3877 }, 10, V['t-center'])).toMatchObject({ kind: 'midpoint', elementId: E.window });
        expect(findSnap(doc, { x: 6020, y: 4000 }, 10, V['win-1'])).toBeNull();
    });

    it('prefers a vertex over a derived point at the same distance', () => {
        // Window midpoint (4250, 3880) and a vertex placed on top of it
        const vertices = doc.vertices.map((v) => (v.id === V['t-center'] ? { ...v, x: 4250, y: 3880 } : v));
        expect(findSnap({ ...doc, vertices }, { x: 4252, y: 3880 }, 10, V['s-1'])).toMatchObject({
            kind: 'vertex',
            vertexId: V['t-center'],
        });
    });

    it('skips the dragged vertex and the derived points of elements using it', () => {
        expect(findSnap(doc, { x: 6005, y: 3995 }, 10, V['w-o3'])).toBeNull();
        // The table quadrant moves with its dragged centre
        expect(findSnap(doc, { x: 4602, y: 1800 }, 10, V['t-center'])).toBeNull();
        expect(findSnap(doc, { x: 4602, y: 1800 }, 10, V['win-1'])).toMatchObject({ kind: 'quadrant', side: 'right' });
    });
});
