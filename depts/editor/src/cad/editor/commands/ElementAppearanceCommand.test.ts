import { describe, expect, it } from 'vitest';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { DocumentHistory } from './DocumentHistory';
import { applyDocumentPatch, diffDocuments } from './DocumentPatch';
import { ElementAppearanceCommand } from './ElementAppearanceCommand';

const { element: E } = sampleIds;
const doc = parseDocument(samplePlan);
const element = (history: DocumentHistory, id: string) => history.document.elements.find((candidate) => candidate.id === id)!;

describe('ElementAppearanceCommand', () => {
    it('sets what the elements override and reports those it changed', () => {
        const command = new ElementAppearanceCommand([E.window, E.curtain], { color: '#b45309', linetype: 'dashed' });
        const { document, changedElementIds } = command.execute(doc);
        expect(changedElementIds).toEqual([E.window, E.curtain]);
        expect(document.elements.find(({ id }) => id === E.window)).toMatchObject({ color: '#b45309', linetype: 'dashed', lineweight: null });
        // The curtain had the colour already and keeps its lineweight
        expect(document.elements.find(({ id }) => id === E.curtain)).toMatchObject({ color: '#b45309', linetype: 'dashed', lineweight: 50 });
        expect(command.undo(document).document).toEqual(doc);
    });

    it('takes the value of the layer again with null', () => {
        const history = new DocumentHistory(doc);
        history.execute(new ElementAppearanceCommand([E.curtain], { color: null, lineweight: null }));
        expect(element(history, E.curtain)).toMatchObject({ color: null, lineweight: null });
        history.undo();
        expect(history.document).toEqual(doc);
    });

    it('changes nothing where the elements have the values already', () => {
        const command = new ElementAppearanceCommand([E.curtain, 'gone'], { color: '#b45309' });
        expect(command.execute(doc)).toEqual({ document: doc, changedElementIds: [] });
    });

    it('leaves on undo what somebody else changed meanwhile', () => {
        const history = new DocumentHistory(doc);
        history.execute(new ElementAppearanceCommand([E.window], { color: '#ff0000', lineweight: 100 }));
        history.applyRemote(new ElementAppearanceCommand([E.window], { color: '#00ff00' }).execute(history.document), 'somebody');
        history.undo();
        expect(element(history, E.window)).toMatchObject({ color: '#00ff00', lineweight: null });
    });

    it('travels as a patch of the changed elements', () => {
        const { document, changedElementIds } = new ElementAppearanceCommand([E.window], { transparency: 40 }).execute(doc);
        const patch = diffDocuments(doc, document, changedElementIds)!;
        expect(patch).toMatchObject({ elements: [{ element: { id: E.window, transparency: 40 } }], changedElementIds: [E.window] });
        expect(applyDocumentPatch(doc, patch)!.document).toEqual(document);
    });
});
