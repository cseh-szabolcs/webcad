import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import { newStyle } from '../../model/ElementStyle';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { DocumentHistory } from './DocumentHistory';
import { applyDocumentPatch, diffDocuments, type DocumentPatch } from './DocumentPatch';
import { AddStyleCommand, AssignStyleCommand, RemoveStyleCommand, UpdateStyleCommand } from './StyleCommands';

const { element: E, style: S } = sampleIds;
const doc = parseDocument(samplePlan);
const styleOf = (d: CadDocument, id: string) => d.elements.find((element) => element.id === id)!.styleId;
const walls = doc.elements.filter((element) => element.styleId === S.wall).map((element) => element.id);

describe('AddStyleCommand', () => {
    it('adds the style, and undo removes it', () => {
        const history = new DocumentHistory(doc);
        history.execute(new AddStyleCommand(newStyle('new', 'Stil1')));
        expect(history.document.styles.at(-1)).toEqual({ id: 'new', name: 'Stil1', color: null, linetype: null, lineweight: null, transparency: null, fillColor: null });
        history.undo();
        expect(history.document).toEqual(doc);
    });
});

describe('UpdateStyleCommand', () => {
    it('changes the properties given and reports the elements that have the style', () => {
        const command = new UpdateStyleCommand(S.wall, { color: '#ff0000', lineweight: null });
        const { document, changedElementIds } = command.execute(doc);
        expect(changedElementIds).toEqual(walls);
        expect(document.styles[0]).toEqual({ ...doc.styles[0], color: '#ff0000', lineweight: null });
        expect(command.undo(document)).toEqual({ document: doc, changedElementIds: walls });
    });

    it('puts back only what it changed, and changes nothing for a style that is gone', () => {
        const history = new DocumentHistory(doc);
        history.execute(new UpdateStyleCommand(S.wall, { color: '#ff0000' }));
        history.applyRemote(new UpdateStyleCommand(S.wall, { name: 'Wand' }).execute(history.document), 'somebody');
        history.undo();
        expect(history.document.styles[0]).toMatchObject({ color: '#1f2937', name: 'Wand' });
        expect(new UpdateStyleCommand('gone', { color: '#ff0000' }).execute(doc).document).toBe(doc);
    });
});

describe('RemoveStyleCommand', () => {
    it('takes the style from its elements, and undo gives it back', () => {
        const history = new DocumentHistory(doc);
        history.execute(new RemoveStyleCommand(S.wall));
        expect(history.document.styles.map((style) => style.name)).toEqual(['Thin', 'Hidden', 'Furniture']);
        expect(walls.map((id) => styleOf(history.document, id))).toEqual(walls.map(() => null));
        history.undo();
        expect(history.document).toEqual(doc);
    });

    it('leaves on undo an element that got another style meanwhile', () => {
        const history = new DocumentHistory(doc);
        history.execute(new RemoveStyleCommand(S.wall));
        history.applyRemote(new AssignStyleCommand([E['wall-outer']], S.thin).execute(history.document), 'somebody');
        history.undo();
        expect(styleOf(history.document, E['wall-outer'])).toBe(S.thin);
        expect(styleOf(history.document, E['wall-inner'])).toBe(S.wall);
    });
});

describe('AssignStyleCommand', () => {
    it('gives the elements the style and reports those it changed', () => {
        const command = new AssignStyleCommand([E.window, E.sofa, E['wall-outer']], S.wall);
        const { document, changedElementIds } = command.execute(doc);
        // The outer wall has it already
        expect(changedElementIds).toEqual([E.window, E.sofa]);
        expect([E.window, E.sofa].map((id) => styleOf(document, id))).toEqual([S.wall, S.wall]);
        expect(command.undo(document)).toEqual({ document: doc, changedElementIds: [E.window, E.sofa] });
    });

    it('takes the style away with null, and changes nothing for a style that is gone', () => {
        const { document } = new AssignStyleCommand([E.sofa], null).execute(doc);
        expect(styleOf(document, E.sofa)).toBeNull();
        expect(new AssignStyleCommand([E.sofa], 'gone').execute(doc).document).toBe(doc);
    });
});

describe('styles in document patches', () => {
    it('carry the changes of the styles, their undo and their redo', () => {
        const sender = new DocumentHistory(doc);
        const receiver = new DocumentHistory(doc);
        const patches: DocumentPatch[] = [];
        sender.subscribe(({ before, document, changedElementIds }) => {
            const patch = diffDocuments(before, document, changedElementIds)!;
            patches.push(patch);
            receiver.applyRemote(applyDocumentPatch(receiver.document, JSON.parse(JSON.stringify(patch)))!, 'm1');
        });
        // The styles in any order, which says nothing
        const content = (d: CadDocument) => ({ styles: [...d.styles].sort((a, b) => a.id.localeCompare(b.id)), elements: d.elements });
        const same = () => expect(content(receiver.document)).toEqual(content(sender.document));

        sender.execute(new AddStyleCommand(newStyle('new', 'Stil1')));
        sender.execute(new AssignStyleCommand([E.window], 'new'));
        sender.execute(new UpdateStyleCommand('new', { color: '#ff0000', fillColor: '#00ff00' }));
        same();
        expect(patches[2]).toMatchObject({ styles: [{ id: 'new', color: '#ff0000' }], elements: [], changedElementIds: [E.window] });
        sender.execute(new RemoveStyleCommand(S.wall));
        same();
        expect(patches[3].removedStyleIds).toEqual([S.wall]);
        while (sender.undo()) {
            same();
        }
        while (sender.redo()) {
            same();
        }
    });

    it('are not applied where an element would be left with a style that is not there', () => {
        const removed = diffDocuments(doc, new RemoveStyleCommand(S.wall).execute(doc).document, [])!;
        // Here the walls still have the style
        expect(applyDocumentPatch(doc, { ...removed, elements: [] })).toBeNull();
    });
});
