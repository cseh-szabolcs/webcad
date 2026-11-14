import { describe, expect, it, vi } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { AddCircleCommand } from './AddCircleCommand';
import { AddLineCommand } from './AddLineCommand';
import type { DocumentCommand } from './DocumentCommand';
import { DocumentHistory } from './DocumentHistory';
import { applyDocumentPatch, diffDocuments, patchSize, type DocumentPatch } from './DocumentPatch';
import { MoveCommand } from './MoveCommand';
import { SubtractCommand } from './SubtractCommand';

const { element: E } = sampleIds;

const doc = parseDocument(samplePlan);
const ids = (prefix: string) => {
    let n = 0;
    return () => `${prefix}-${++n}`;
};
const byId = <T extends { id: string }>(items: readonly T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
/** Vertices and groups in any order, the elements in theirs: what two editors must agree on. */
const content = (d: CadDocument) => ({ vertices: byId(d.vertices), groups: byId(d.groups), elements: d.elements });
/** Sends each step of `sender` to a second document as a patch, as the collaboration does. */
function mirrored(sender: DocumentHistory, receiver: DocumentHistory) {
    const patches: DocumentPatch[] = [];
    sender.subscribe(({ before, document, changedElementIds }) => {
        const patch = diffDocuments(before, document, changedElementIds)!;
        patches.push(patch);
        // As it travels: nothing but JSON
        receiver.applyRemote(applyDocumentPatch(receiver.document, JSON.parse(JSON.stringify(patch)))!, 'm1');
    });
    return patches;
}

describe('document patches', () => {
    it('carry a command, its undo and its redo to another document', () => {
        const sender = new DocumentHistory(doc);
        const receiver = new DocumentHistory(doc);
        mirrored(sender, receiver);
        const circle = new AddCircleCommand({ x: 2600, y: 3050 }, 200, ids('circle'));
        const steps: DocumentCommand[] = [
            new AddLineCommand({ x: 1, y: 2 }, { x: 3, y: 4 }, ids('line')),
            new MoveCommand([E.sofa, E.table], { x: 100, y: -50 }, ids('move')),
            circle,
            // Removes elements and vertices and puts new outlines where the sofa was
            new SubtractCommand([E.sofa], [circle.circleId], 'DIFFERENZ', 'SUBTRACT', ids('new')),
        ];

        for (const step of steps) {
            sender.execute(step);
            expect(content(receiver.document)).toEqual(content(sender.document));
        }
        while (sender.undo()) {
            expect(content(receiver.document)).toEqual(content(sender.document));
        }
        expect(content(receiver.document)).toEqual(content(doc));
        while (sender.redo()) {
            expect(content(receiver.document)).toEqual(content(sender.document));
        }
    });

    it('name only what changed, and the elements to draw anew', () => {
        const sender = new DocumentHistory(doc);
        const patches = mirrored(sender, new DocumentHistory(doc));

        sender.execute(new MoveCommand([E.table], { x: 10, y: 0 }, ids('move')));

        const [patch] = patches;
        expect(patch.planId).toBe(doc.id);
        // Also a neighbour that left a vertex it shared with the table
        expect(patch.changedElementIds).toContain(E.table);
        expect(patch.removedElementIds).toEqual([]);
        expect(patchSize(patch)).toBeLessThan(doc.vertices.length);
    });

    it('are none where nothing changed', () => {
        expect(diffDocuments(doc, { ...doc, vertices: [...doc.vertices] }, [])).toBeNull();
    });

    it('put a new element behind the one it follows', () => {
        const [first, second] = doc.elements;
        const added = { ...first, id: 'added' };
        const after = { ...doc, elements: [first, added, ...doc.elements.slice(1)] };

        const patch = diffDocuments(doc, after, ['added'])!;

        expect(patch.elements).toEqual([{ element: added, after: first.id }]);
        expect(applyDocumentPatch(doc, patch)!.document.elements.slice(0, 3)).toEqual([first, added, second]);
    });

    it('are not applied to another plan', () => {
        const patch = diffDocuments(doc, new AddLineCommand({ x: 1, y: 2 }, { x: 3, y: 4 }).execute(doc).document, [])!;

        expect(applyDocumentPatch({ ...doc, id: 'another-plan' }, patch)).toBeNull();
    });

    it('are not applied where an element would be left without a vertex', () => {
        const moved = new AddLineCommand({ x: 1, y: 2 }, { x: 3, y: 4 }, ids('line'));
        const withLine = moved.execute(doc).document;
        // The line of somebody who never told this document of its vertices
        const patch = diffDocuments(doc, withLine, [moved.lineId])!;
        expect(applyDocumentPatch(doc, { ...patch, vertices: [] })).toBeNull();
        // A vertex taken from under an element that is still there
        const used = doc.vertices[0].id;
        expect(applyDocumentPatch(doc, { ...patch, removedVertexIds: [used] })).toBeNull();
    });
});

describe('DocumentHistory.applyRemote', () => {
    it('tells the listeners who made the change and is no undo step', () => {
        const history = new DocumentHistory(doc);
        const listener = vi.fn();
        history.subscribe(listener);
        const mine = new AddLineCommand({ x: 1, y: 2 }, { x: 3, y: 4 }, ids('mine'));
        const theirs = new AddLineCommand({ x: 5, y: 6 }, { x: 7, y: 8 }, ids('theirs'));

        history.execute(mine);
        history.applyRemote(theirs.execute(history.document), 'm1');

        expect(listener.mock.calls.map(([change]) => change.origin)).toEqual([null, 'm1']);
        expect(listener.mock.calls[1][0].before.elements).toHaveLength(doc.elements.length + 1);
        // Undo takes back the own line and leaves theirs
        expect(history.undo()).toBe(mine);
        expect(history.undoCommand).toBeNull();
        expect(history.document.elements.map(({ id }) => id)).toContain(theirs.lineId);
        expect(history.document.elements.map(({ id }) => id)).not.toContain(mine.lineId);
    });
});
