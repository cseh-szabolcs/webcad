import { describe, expect, it, vi } from 'vitest';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { AddLineCommand } from './AddLineCommand';
import { DocumentHistory } from './DocumentHistory';

const doc = parseDocument(samplePlan);
/** Deterministic ids. */
const ids = (prefix: string) => {
    let n = 0;
    return () => `${prefix}-${++n}`;
};

describe('AddLineCommand', () => {
    it('adds a line with two vertices of its own, and undo removes them exactly', () => {
        const command = new AddLineCommand({ x: 1, y: 2 }, { x: 3, y: 4 }, ids('a'));
        const { document, changedElementIds } = command.execute(doc);
        expect(changedElementIds).toEqual([command.lineId]);
        expect(document.vertices.slice(-2)).toEqual([
            { id: 'a-1', x: 1, y: 2 },
            { id: 'a-2', x: 3, y: 4 },
        ]);
        expect(document.elements.at(-1)).toEqual({
            id: 'a-3',
            type: 'line',
            layerId: null,
            groupId: null,
            styleId: null,
            startVertexId: 'a-1',
            endVertexId: 'a-2',
        });
        expect(command.undo(document).document).toEqual(doc);
        // Redo gives the same ids
        expect(command.execute(doc).document).toEqual(document);
    });
});

describe('DocumentHistory', () => {
    it('reverts the last step without keeping it for redo', () => {
        const history = new DocumentHistory(doc);
        const listener = vi.fn();
        history.subscribe(listener);
        history.execute(new AddLineCommand({ x: 0, y: 0 }, { x: 1, y: 0 }, ids('a')));
        expect(history.revertLast()).not.toBeNull();
        expect(history.document).toEqual(doc);
        expect(history.undoCommand).toBeNull();
        expect(history.redoCommand).toBeNull();
        expect(listener).toHaveBeenCalledTimes(2);
        expect(history.revertLast()).toBeNull();
    });

    it('combines the last steps into one, without changing the document', () => {
        const history = new DocumentHistory(doc);
        history.execute(new AddLineCommand({ x: 0, y: 0 }, { x: 1, y: 0 }, ids('a')));
        history.execute(new AddLineCommand({ x: 1, y: 0 }, { x: 1, y: 1 }, ids('b')));
        history.execute(new AddLineCommand({ x: 1, y: 1 }, { x: 0, y: 0 }, ids('c')));
        const after = history.document;
        const listener = vi.fn();
        history.subscribe(listener);
        history.combineLast(2, 'LINE');
        expect(listener).not.toHaveBeenCalled();
        expect(history.document).toBe(after);
        history.undo();
        expect(history.document.elements.map((e) => e.id).slice(-1)).toEqual(['a-3']);
        expect(listener.mock.calls[0][0].changedElementIds).toEqual(['c-3', 'b-3']);
        history.undo();
        expect(history.document).toEqual(doc);
        history.redo();
        history.redo();
        expect(history.document).toEqual(after);
    });
});
