import { describe, expect, it } from 'vitest';
import { newLayer } from '../../model/Layer';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { DocumentHistory } from './DocumentHistory';
import { AddLayerCommand, RemoveLayerCommand, UpdateLayerCommand } from './LayerCommands';

const { layer: L, floor: F } = sampleIds;
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
