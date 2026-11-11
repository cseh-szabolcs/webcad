import { describe, expect, it } from 'vitest';
import { rotationAbout } from '../../geometry/similarity';
import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs } from '../../model/CadElement';
import type { DocumentIndex } from '../../model/DocumentIndex';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { CopyCommand } from './CopyCommand';
import { translateElement } from './MoveCommand';
import { transformElement } from './TransformCommand';

const { element: E, vertex: V, group: G } = sampleIds;

const doc = parseDocument(samplePlan);
const ids = () => {
    let n = 0;
    return () => `copy-${++n}`;
};
const vertex = (d: CadDocument, id: string): Point => {
    const { x, y } = d.vertices.find((v) => v.id === id)!;
    return { x, y };
};
/** Edits that move the elements by (100, 0). */
const moved = (elementIds: string[]) => (index: DocumentIndex) =>
    elementIds.map((id) => translateElement(index.elements.get(id)!, index, { x: 100, y: 0 }));

describe('CopyCommand', () => {
    it('adds a copy on its own vertices and leaves the original', () => {
        const { document, changedElementIds } = new CopyCommand('GRIP_MOVE', moved([E.window]), ids()).execute(doc);
        expect(document.elements).toHaveLength(doc.elements.length + 1);
        expect(document.elements.slice(0, -1)).toEqual(doc.elements);
        const copy = document.elements.at(-1)!;
        expect(copy).toMatchObject({ type: 'line', styleId: sampleIds.style.thin, layerId: sampleIds.layer.openings });
        expect(changedElementIds).toEqual([copy.id]);
        expect(vertexRefs(copy).map((id) => vertex(document, id))).toEqual([
            { x: 3600, y: 3880 },
            { x: 5100, y: 3880 },
        ]);
        expect(vertex(document, V['win-1'])).toEqual({ x: 3500, y: 3880 });
    });

    it('lets copies share the copy of a vertex their originals share', () => {
        const { document } = new CopyCommand('GRIP_MOVE', moved([E.table, E.rug]), ids()).execute(doc);
        const [table, rug] = document.elements.slice(-2);
        expect(vertexRefs(table)).toEqual(vertexRefs(rug));
        expect(vertexRefs(table)).not.toEqual([V['t-center']]);
        expect(document.vertices).toHaveLength(doc.vertices.length + 1);
    });

    it('puts the copies of grouped elements into a group of their own', () => {
        const { document } = new CopyCommand('GRIP_MOVE', moved([E['door-leaf'], E['door-swing']]), ids()).execute(doc);
        const [leaf, swing] = document.elements.slice(-2);
        expect(leaf.groupId).toBe(swing.groupId);
        expect(leaf.groupId).not.toBe(G['door-d1']);
        expect(document.groups).toEqual([...doc.groups, { id: leaf.groupId, name: 'Door D1' }]);
        // Hinge and open end are shared, the closed end is the swing's alone
        expect(document.vertices).toHaveLength(doc.vertices.length + 3);
    });

    it('copies what the edit changes of the element itself', () => {
        const turned = (index: DocumentIndex) => [
            transformElement(index.elements.get(E.rug)!, index, rotationAbout({ x: 4000, y: 1800 }, 90)),
        ];
        const { document } = new CopyCommand('GRIP_ROTATE', turned, ids()).execute(doc);
        expect(document.elements.at(-1)).toMatchObject({ type: 'ellipse', radiusX: 1000, rotation: Math.PI / 2 });
        expect(document.elements.find((e) => e.id === E.rug)).toMatchObject({ rotation: 0 });
    });

    it('removes the copies on undo and makes the same ones on redo', () => {
        const command = new CopyCommand('GRIP_MOVE', moved([E['door-leaf'], E['door-swing']]), ids());
        const first = command.execute(doc).document;
        const undone = command.undo(first);
        expect(undone.document).toEqual(doc);
        expect(undone.changedElementIds).toHaveLength(2);
        expect(command.execute(undone.document).document).toEqual(first);
    });
});
