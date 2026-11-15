import { describe, expect, it } from 'vitest';
import { newLayer } from '../../model/Layer';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { DocumentHistory } from './DocumentHistory';
import { AddLayerCommand, ChangeElementLayerCommand, RemoveLayerCommand, UpdateLayerCommand } from './LayerCommands';
import { applyDocumentPatch, diffDocuments } from './DocumentPatch';

const { layer: L, floor: F, element: E } = sampleIds;
const doc = parseDocument(samplePlan);
const names = (history: DocumentHistory) => history.document.layers.map((layer) => layer.name);
const layer = (history: DocumentHistory, id: string) => history.document.layers.find((candidate) => candidate.id === id)!;

describe('AddLayerCommand', () => {
    it('adds the layer on top, and undo removes it', () => {
        const history = new DocumentHistory(doc);
        history.execute(new AddLayerCommand(newLayer('new', F.ground, 'Layer1')));
        expect(names(history)).toEqual(['0', 'Walls', 'Doors & windows', 'Furniture', 'Layer1']);
        history.undo();
        expect(history.document).toEqual(doc);
        history.redo();
        expect(names(history).at(-1)).toBe('Layer1');
    });
});

describe('UpdateLayerCommand', () => {
    it('changes the properties given and reports no element as changed', () => {
        const command = new UpdateLayerCommand(L.walls, { color: '#ff0000', transparency: 40 });
        const { document, changedElementIds } = command.execute(doc);
        expect(changedElementIds).toEqual([]);
        expect(document.layers[1]).toEqual({ ...doc.layers[1], color: '#ff0000', transparency: 40 });
        expect(document.elements).toBe(doc.elements);
        expect(command.undo(document).document).toEqual(doc);
    });

    it('puts back only what it changed', () => {
        const history = new DocumentHistory(doc);
        history.execute(new UpdateLayerCommand(L.walls, { visible: false }));
        // Somebody else renames the layer meanwhile
        history.applyRemote(new UpdateLayerCommand(L.walls, { name: 'Wände' }).execute(history.document), 'somebody');
        history.undo();
        expect(layer(history, L.walls)).toMatchObject({ visible: true, name: 'Wände' });
        history.redo();
        expect(layer(history, L.walls)).toMatchObject({ visible: false, name: 'Wände' });
    });

    it('changes nothing for a layer that is gone', () => {
        const command = new UpdateLayerCommand('gone', { visible: false });
        expect(command.execute(doc).document).toBe(doc);
        expect(command.undo(doc).document).toBe(doc);
    });
});

describe('RemoveLayerCommand', () => {
    it('removes an empty layer, and undo puts it back at its place', () => {
        const empty = newLayer('empty', F.ground, 'Empty');
        const start = { ...doc, layers: doc.layers.toSpliced(2, 0, empty) };
        const history = new DocumentHistory(start);
        history.execute(new RemoveLayerCommand('empty'));
        expect(history.document.layers).toEqual(doc.layers);
        history.undo();
        expect(history.document).toEqual(start);
    });

    it('leaves a layer with elements', () => {
        const command = new RemoveLayerCommand(L.walls);
        expect(command.execute(doc).document).toBe(doc);
        expect(command.undo(doc).document).toBe(doc);
    });
});

describe('ChangeElementLayerCommand', () => {
    const layerOf = (history: DocumentHistory, id: string) => history.document.elements.find((element) => element.id === id)!.layerId;

    it('puts the elements on the layer and reports those it moved', () => {
        const command = new ChangeElementLayerCommand([E.sofa, E.window, E.table], L.furniture);
        const { document, changedElementIds } = command.execute(doc);
        // The sofa and the table are there already
        expect(changedElementIds).toEqual([E.window]);
        expect(document.elements.find((element) => element.id === E.window)).toMatchObject({ layerId: L.furniture, styleId: null });
        expect(document.elements.map(({ id }) => id)).toEqual(doc.elements.map(({ id }) => id));
        expect(command.undo(document)).toEqual({ document: doc, changedElementIds: [E.window] });
    });

    it('puts each element back on the layer it came from', () => {
        const history = new DocumentHistory(doc);
        history.execute(new ChangeElementLayerCommand([E.sofa, E.window, E['wall-outer']], L['0']));
        expect([E.sofa, E.window, E['wall-outer']].map((id) => layerOf(history, id))).toEqual([L['0'], L['0'], L['0']]);
        history.undo();
        expect(history.document).toEqual(doc);
        history.redo();
        expect(layerOf(history, E.sofa)).toBe(L['0']);
    });

    it('leaves on undo what somebody else has moved on meanwhile', () => {
        const history = new DocumentHistory(doc);
        history.execute(new ChangeElementLayerCommand([E.sofa, E.window], L['0']));
        history.applyRemote(new ChangeElementLayerCommand([E.sofa], L.walls).execute(history.document), 'somebody');
        history.undo();
        expect(layerOf(history, E.sofa)).toBe(L.walls);
        expect(layerOf(history, E.window)).toBe(L.openings);
    });

    it('changes nothing for a layer that is gone or elements that are there already', () => {
        expect(new ChangeElementLayerCommand([E.sofa], 'gone').execute(doc).document).toBe(doc);
        expect(new ChangeElementLayerCommand([E.sofa, 'gone'], L.furniture).execute(doc).document).toBe(doc);
    });

    it('travels as a patch of the moved elements', () => {
        const { document, changedElementIds } = new ChangeElementLayerCommand([E.window], L.walls).execute(doc);
        const patch = diffDocuments(doc, document, changedElementIds)!;
        expect(patch).toMatchObject({ elements: [{ element: { id: E.window, layerId: L.walls } }], layers: [], changedElementIds: [E.window] });
        expect(applyDocumentPatch(doc, patch)!.document).toEqual(document);
    });
});
