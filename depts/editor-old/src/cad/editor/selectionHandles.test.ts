import { describe, expect, it } from 'vitest';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { parseDocument } from '../persistence/CadSerializer';
import { selectionHandles } from './selectionHandles';

const { vertex: V, element: E } = sampleIds;

const doc = parseDocument(samplePlan);
const handleIds = (...ids: string[]) => selectionHandles(doc, new Set(ids)).map((v) => v.id);

describe('selectionHandles', () => {
    it('returns the vertices of each element type', () => {
        expect(handleIds(E['door-leaf'])).toEqual([V['d-hinge'], V['d-open']]);
        expect(handleIds(E['door-swing'])).toEqual([V['d-hinge'], V['d-closed'], V['d-open']]);
        expect(handleIds(E.sofa)).toEqual([V['s-1'], V['s-2'], V['s-3'], V['s-4']]);
    });

    it('adds four side handles to an ellipse, after its centre', () => {
        expect(selectionHandles(doc, new Set([E.table]))).toEqual([
            { kind: 'vertex', id: V['t-center'], vertexId: V['t-center'], x: 4000, y: 1800 },
            { kind: 'radius', id: `${E.table}#right`, elementId: E.table, side: 'right', x: 4600, y: 1800 },
            { kind: 'radius', id: `${E.table}#top`, elementId: E.table, side: 'top', x: 4000, y: 2400 },
            { kind: 'radius', id: `${E.table}#left`, elementId: E.table, side: 'left', x: 3400, y: 1800 },
            { kind: 'radius', id: `${E.table}#bottom`, elementId: E.table, side: 'bottom', x: 4000, y: 1200 },
        ]);
    });

    it('places the side handles of an ellipse on its own radii', () => {
        const elements = doc.elements.map((e) => (e.type === 'ellipse' ? { ...e, radiusY: 300 } : e));
        const handles = selectionHandles({ ...doc, elements }, new Set([E.table]));
        expect(handles.filter((h) => h.kind === 'radius').map(({ x, y }) => ({ x, y }))).toEqual([
            { x: 4600, y: 1800 },
            { x: 4000, y: 2100 },
            { x: 3400, y: 1800 },
            { x: 4000, y: 1500 },
        ]);
    });

    it('lists shared vertices once', () => {
        expect(handleIds(E['door-leaf'], E['door-swing'])).toEqual([V['d-hinge'], V['d-closed'], V['d-open']]);
    });

    it('returns nothing for an empty selection', () => {
        expect(handleIds()).toEqual([]);
    });
});
