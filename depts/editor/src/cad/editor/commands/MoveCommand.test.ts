import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs } from '../../model/CadElement';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { DocumentHistory } from './DocumentHistory';
import { MoveCommand } from './MoveCommand';

const { element: E, vertex: V } = sampleIds;

const doc = parseDocument(samplePlan);
/** Deterministic ids for vertex copies. */
const ids = () => {
    let n = 0;
    return () => `clone-${++n}`;
};
const element = (d: CadDocument, id: string) => d.elements.find((e) => e.id === id)!;
const vertex = (d: CadDocument, id: string): Point => {
    const { x, y } = d.vertices.find((v) => v.id === id)!;
    return { x, y };
};
/** Positions of an element's vertices, in reference order. */
const positions = (d: CadDocument, id: string) => vertexRefs(element(d, id)).map((ref) => vertex(d, ref));

describe('MoveCommand', () => {
    it('moves every vertex of the elements once, also where they share one', () => {
        const { document } = new MoveCommand([E['door-leaf'], E['door-swing']], { x: 100, y: 50 }, ids()).execute(doc);
        // Hinge and open end are shared by leaf and swing
        expect(vertex(document, V['d-hinge'])).toEqual({ x: 1100, y: 290 });
        expect(vertex(document, V['d-open'])).toEqual({ x: 1100, y: 1190 });
        expect(vertex(document, V['d-closed'])).toEqual({ x: 2000, y: 290 });
        expect(document.vertices).toHaveLength(doc.vertices.length);
    });

    it('detaches elements that are not moved onto a copy of the shared vertex', () => {
        // The axis runs from the outer corner w-o1 to the inner corner w-i1 of the moved wall
        const { document, changedElementIds } = new MoveCommand([E['wall-inner']], { x: 100, y: 50 }, ids()).execute(doc);
        expect(positions(document, E['wall-inner'])[0]).toEqual({ x: 340, y: 290 });
        expect(element(document, E['wall-inner'])).toEqual(element(doc, E['wall-inner']));
        expect(vertexRefs(element(document, E.axis))).toEqual([V['w-o1'], 'clone-1']);
        expect(positions(document, E.axis)).toEqual(positions(doc, E.axis));
        expect(changedElementIds).toEqual([E['wall-inner'], E.axis]);
    });

    it('makes one copy per vertex, so the neighbours stay connected to each other', () => {
        // Moving only the leaf: the swing shares the hinge (its centre) and the open end
        const { document } = new MoveCommand([E['door-leaf']], { x: 10, y: 0 }, ids()).execute(doc);
        expect(vertexRefs(element(document, E['door-swing']))).toEqual(['clone-1', V['d-closed'], 'clone-2']);
        expect(positions(document, E['door-swing'])).toEqual(positions(doc, E['door-swing']));
        expect(document.vertices).toHaveLength(doc.vertices.length + 2);
    });

    it('restores the document exactly on undo, also after an inexact sum', () => {
        const command = new MoveCommand([E['wall-inner'], E.table], { x: 0.1, y: -0.7 }, ids());
        const moved = command.execute(doc).document;
        expect(command.undo(moved).document).toEqual(doc);
    });

    it('repeats the same result on redo', () => {
        const command = new MoveCommand([E['door-leaf']], { x: 10, y: 0 }, ids());
        const first = command.execute(doc).document;
        const again = command.execute(command.undo(first).document).document;
        expect(again).toEqual(first);
    });
});

describe('DocumentHistory', () => {
    it('undoes and redoes commands in order and tells the listeners', () => {
        const history = new DocumentHistory(doc);
        const changes: string[][] = [];
        history.subscribe((change) => changes.push([...change.changedElementIds]));
        history.execute(new MoveCommand([E.table], { x: 100, y: 0 }, ids()));
        history.execute(new MoveCommand([E.table], { x: 0, y: 100 }, ids()));
        expect(positions(history.document, E.table)).toEqual([{ x: 4100, y: 1900 }]);
        expect(history.undo()?.label).toBe('MOVE');
        expect(positions(history.document, E.table)).toEqual([{ x: 4100, y: 1800 }]);
        history.undo();
        expect(history.document).toEqual(doc);
        expect(history.undo()).toBeNull();
        history.redo();
        expect(positions(history.document, E.table)).toEqual([{ x: 4100, y: 1800 }]);
        expect(changes).toHaveLength(5);
    });

    it('drops the undone commands when a new one runs', () => {
        const history = new DocumentHistory(doc);
        history.execute(new MoveCommand([E.table], { x: 100, y: 0 }, ids()));
        history.undo();
        expect(history.redoCommand).not.toBeNull();
        history.execute(new MoveCommand([E.sofa], { x: 0, y: 100 }, ids()));
        expect(history.redoCommand).toBeNull();
        expect(history.redo()).toBeNull();
    });
});
