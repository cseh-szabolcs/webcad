import { describe, expect, it } from 'vitest';
import samplePlan from '../../__fixtures__/sample-plan.json';
import type { CadDocument } from '../../model/CadDocument';
import { parseDocument } from '../../persistence/CadSerializer';
import type { Command } from './Command';
import { CommandManager } from './CommandManager';

const doc = parseDocument(samplePlan);

/** Appends its label to the document name, so the order of operations is visible. */
function rename(label: string): Command {
    return {
        label,
        execute: (d: CadDocument) => ({ document: { ...d, name: `${d.name}+${label}` }, changedElementIds: [] }),
        undo: (d: CadDocument) => ({ document: { ...d, name: d.name.replace(new RegExp(`\\+${label}$`), '') }, changedElementIds: [] }),
    };
}

describe('CommandManager', () => {
    it('undoes and redoes in order', () => {
        const history = new CommandManager();
        let d = history.execute(rename('a'), doc).document;
        d = history.execute(rename('b'), d).document;
        expect(d.name).toBe('Sample room+a+b');
        expect(history.undoLabel).toBe('b');

        d = history.undo(d)!.document;
        expect(d.name).toBe('Sample room+a');
        expect(history.redoLabel).toBe('b');

        d = history.undo(d)!.document;
        expect(d.name).toBe('Sample room');
        expect(history.canUndo).toBe(false);

        d = history.redo(d)!.document;
        expect(d.name).toBe('Sample room+a');
        expect(history.canRedo).toBe(true);
    });

    it('clears the redo stack on a new command', () => {
        const history = new CommandManager();
        let d = history.execute(rename('a'), doc).document;
        d = history.undo(d)!.document;
        history.execute(rename('b'), d);
        expect(history.canRedo).toBe(false);
        expect(history.redoLabel).toBeNull();
    });

    it('returns null when there is nothing to undo or redo', () => {
        const history = new CommandManager();
        expect(history.undo(doc)).toBeNull();
        expect(history.redo(doc)).toBeNull();
    });

    it('clears both stacks', () => {
        const history = new CommandManager();
        const d = history.execute(rename('a'), doc).document;
        history.execute(rename('b'), d);
        history.undo(d);
        history.clear();
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(false);
    });
});
