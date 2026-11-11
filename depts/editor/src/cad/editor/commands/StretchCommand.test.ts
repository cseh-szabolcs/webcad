import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs } from '../../model/CadElement';
import { indexDocument } from '../../model/DocumentIndex';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { selectionGrips, type Grip } from '../selection/grips';
import { StretchCommand } from './StretchCommand';

const { element: E, vertex: V } = sampleIds;

const doc = parseDocument(samplePlan);
const index = indexDocument(doc);
/** Deterministic ids for vertex copies. */
const ids = () => {
    let n = 0;
    return () => `copy-${++n}`;
};
const element = (d: CadDocument, id: string) => d.elements.find((e) => e.id === id)!;
const vertex = (d: CadDocument, id: string): Point => {
    const { x, y } = d.vertices.find((v) => v.id === id)!;
    return { x, y };
};
/** The grip at `point` of the given elements selected together. */
const grip = (elementIds: string[], point: Point): Grip =>
    selectionGrips(
        elementIds.map((id) => index.elements.get(id)!),
        index,
    ).find((g) => Math.hypot(g.point.x - point.x, g.point.y - point.y) < 1e-6)!;

describe('StretchCommand', () => {
    it('changes the element of the grip and names its undo step', () => {
        const command = new StretchCommand([grip([E.window], { x: 5000, y: 3880 })], { x: 200, y: 0 }, ids());
        const { document, changedElementIds } = command.execute(doc);
        expect(vertex(document, V['win-2'])).toEqual({ x: 5200, y: 3880 });
        expect(vertex(document, V['win-1'])).toEqual({ x: 3500, y: 3880 });
        expect(changedElementIds).toEqual([E.window]);
        expect(command.label).toBe('GRIP_STRETCH');
    });

    it('leaves an element that is not stretched on a copy of the shared vertex', () => {
        // The axis ends on the inner wall corner w-i1
        const command = new StretchCommand([grip([E['wall-inner']], { x: 240, y: 240 })], { x: 100, y: 100 }, ids());
        const { document, changedElementIds } = command.execute(doc);
        expect(vertex(document, V['w-i1'])).toEqual({ x: 340, y: 340 });
        expect(vertexRefs(element(document, E.axis))).toEqual([V['w-o1'], 'copy-1']);
        expect(vertex(document, 'copy-1')).toEqual({ x: 240, y: 240 });
        expect(changedElementIds).toEqual([E['wall-inner'], E.axis]);
    });

    it('stretches the selected elements that share the grip together', () => {
        // Table and rug share their centre
        const command = new StretchCommand([grip([E.table, E.rug], { x: 4000, y: 1800 })], { x: 100, y: 0 }, ids());
        const { document } = command.execute(doc);
        expect(vertex(document, V['t-center'])).toEqual({ x: 4100, y: 1800 });
        expect(document.vertices).toHaveLength(doc.vertices.length);
        expect(element(document, E.rug)).toEqual(element(doc, E.rug));
    });

    it('moves only the table when the rug is not selected', () => {
        const command = new StretchCommand([grip([E.table], { x: 4000, y: 1800 })], { x: 100, y: 0 }, ids());
        const { document } = command.execute(doc);
        expect(vertex(document, V['t-center'])).toEqual({ x: 4100, y: 1800 });
        expect(element(document, E.rug)).toMatchObject({ centerVertexId: 'copy-1' });
        expect(vertex(document, 'copy-1')).toEqual({ x: 4000, y: 1800 });
    });

    it('keeps a shared vertex shared where the stretched elements agree on it', () => {
        // The open end of the door: the leaf's end and the end of the swing, along its circle to 180°
        const open = grip([E['door-leaf'], E['door-swing']], { x: 1000, y: 1140 });
        const { document } = new StretchCommand([open], { x: -900, y: -900 }, ids()).execute(doc);
        expect(vertex(document, V['d-open'])).toEqual({ x: 100, y: 240 });
        expect(vertexRefs(element(document, E['door-leaf']))).toEqual([V['d-hinge'], V['d-open']]);
        expect(vertexRefs(element(document, E['door-swing']))).toEqual([V['d-hinge'], V['d-closed'], V['d-open']]);
        expect(document.vertices).toHaveLength(doc.vertices.length);
    });

    it('leaves the other element on a copy where a stretched one takes the shared vertex elsewhere', () => {
        // The swing's middle to (1900, 1140) moves its centre off the hinge, where the leaf stays
        const r = 900 / Math.SQRT2;
        const mid = grip([E['door-leaf'], E['door-swing']], { x: 1000 + r, y: 240 + r });
        const { document } = new StretchCommand([mid], { x: 900 - r, y: 900 - r }, ids()).execute(doc);
        const swing = element(document, E['door-swing']);
        const centre = vertex(document, vertexRefs(swing)[0]);
        expect([Math.round(centre.x), Math.round(centre.y)]).toEqual([1450, 690]);
        const [start, end] = vertexRefs(element(document, E['door-leaf'])).map((id) => vertex(document, id));
        expect([start, end]).toEqual([
            { x: 1000, y: 240 },
            { x: 1000, y: 1140 },
        ]);
        expect(document.vertices).toHaveLength(doc.vertices.length + 1);
    });

    it('restores the document exactly on undo and repeats the result on redo', () => {
        const command = new StretchCommand([grip([E['wall-inner']], { x: 240, y: 240 })], { x: 0.1, y: -0.7 }, ids());
        const first = command.execute(doc).document;
        const undone = command.undo(first);
        expect(undone.document).toEqual(doc);
        expect(undone.changedElementIds).toEqual([E['wall-inner'], E.axis]);
        expect(command.execute(undone.document).document).toEqual(first);
    });

    it('changes nothing where the grip cannot go', () => {
        const command = new StretchCommand([grip([E.table], { x: 4600, y: 1800 })], { x: -600, y: 0 }, ids());
        expect(command.execute(doc).document).toEqual(doc);
    });
});
