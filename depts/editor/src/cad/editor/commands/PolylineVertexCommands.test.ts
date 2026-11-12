import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import type { PolylineElement } from '../../model/CadElement';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { AddPolylineVertexCommand, RemovePolylineVertexCommand } from './PolylineVertexCommands';

const { element: E, vertex: V } = sampleIds;

const doc = parseDocument(samplePlan);
const vertexIds = (d: CadDocument, id: string) => (d.elements.find((e) => e.id === id) as PolylineElement).vertexIds;

describe('AddPolylineVertexCommand', () => {
    it('adds a vertex at the place given and takes it away again on undo', () => {
        const command = new AddPolylineVertexCommand(E.sofa, 1, { x: 1600, y: 2300 }, () => 'new');
        const { document, changedElementIds } = command.execute(doc);
        expect(vertexIds(document, E.sofa)).toEqual([V['s-1'], 'new', V['s-2'], V['s-3'], V['s-4']]);
        expect(document.vertices.at(-1)).toEqual({ id: 'new', x: 1600, y: 2300 });
        expect(changedElementIds).toEqual([E.sofa]);
        expect(command.label).toBe('GRIP_ADD_VERTEX');
        expect(command.undo(document).document).toEqual(doc);
        expect(command.execute(doc).document).toEqual(document);
    });
});

describe('RemovePolylineVertexCommand', () => {
    it('takes the vertex out of the polyline and the document', () => {
        const command = new RemovePolylineVertexCommand(E.sofa, 1);
        const { document, changedElementIds } = command.execute(doc);
        expect(vertexIds(document, E.sofa)).toEqual([V['s-1'], V['s-3'], V['s-4']]);
        expect(document.vertices.some((vertex) => vertex.id === V['s-2'])).toBe(false);
        expect(changedElementIds).toEqual([E.sofa]);
        expect(command.label).toBe('GRIP_REMOVE_VERTEX');
        expect(command.undo(document).document).toEqual(doc);
    });

    it('leaves a vertex that something else still uses', () => {
        // The axis ends on the inner wall's first corner
        const command = new RemovePolylineVertexCommand(E['wall-inner'], 0);
        const { document } = command.execute(doc);
        expect(vertexIds(document, E['wall-inner'])).toEqual([V['w-i2'], V['w-i3'], V['w-i4']]);
        expect(document.vertices).toEqual(doc.vertices);
        expect(command.undo(document).document).toEqual(doc);
    });

    it('changes nothing for a place the polyline does not have', () => {
        const command = new RemovePolylineVertexCommand(E.sofa, 9);
        expect(command.execute(doc).document).toBe(doc);
        expect(command.undo(doc).document).toBe(doc);
    });
});
