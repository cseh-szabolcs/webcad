import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../model/CadDocument';
import type { Point } from '../model/Point';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { DocumentHistory } from './commands/DocumentHistory';
import type { EditorPointerEvent } from './EditorPointerEvent';
import { SelectionEditor } from './SelectionEditor';

const { layer: L } = sampleIds;

/** One screen pixel is 2 mm (Y flipped). */
const at = (modelPoint: Point): EditorPointerEvent => ({
    viewPoint: { x: modelPoint.x / 2, y: -modelPoint.y / 2 },
    modelPoint,
    pixelSize: 2,
    button: 0,
    shiftKey: false,
    altKey: false,
});
/** Empty space between the door, the sofa and the rug, where nothing snaps. */
const A = { x: 1500, y: 1500 };
const B = { x: 2500, y: 1500 };
const C = { x: 2500, y: 2300 };

const setup = (doc: CadDocument = parseDocument(samplePlan)) => {
    const history = new DocumentHistory(doc);
    return { editor: new SelectionEditor(history), history };
};
const click = (editor: SelectionEditor, point: Point) => {
    editor.pointerMove(at(point));
    editor.pointerDown(at(point));
    editor.pointerUp(at(point));
};
const lastLayer = (history: DocumentHistory) => history.document.elements.at(-1)!.layerId;
const layerOf = (history: DocumentHistory, id: string) => history.document.layers.find((layer) => layer.id === id)!;
const BUSY = 'Layer lassen sich nur ändern, solange kein Befehl läuft.';

describe('SelectionEditor current layer', () => {
    it('starts with layer 0 of the first floor', () => {
        expect(setup().editor.snapshot.currentLayerId).toBe(L['0']);
    });

    it('puts what is drawn on the current layer', () => {
        const { editor, history } = setup();
        expect(editor.setCurrentLayer(L.walls)).toBe(true);
        expect(editor.snapshot.currentLayerId).toBe(L.walls);
        editor.startCommand('CIRCLE');
        click(editor, A);
        click(editor, B);
        expect(history.document.elements.at(-1)).toMatchObject({ type: 'circle', layerId: L.walls, styleId: null });
    });

    it('takes the layer current at each segment while LINIE runs', () => {
        const { editor, history } = setup();
        editor.startCommand('LINE');
        click(editor, A);
        click(editor, B);
        expect(lastLayer(history)).toBe(L['0']);
        editor.setCurrentLayer(L.furniture);
        click(editor, C);
        expect(lastLayer(history)).toBe(L.furniture);
    });

    it('shows a hidden layer that becomes the current one, as one undo step', () => {
        const doc = parseDocument(samplePlan);
        const hidden = { ...doc, layers: doc.layers.map((layer) => (layer.id === L.walls ? { ...layer, visible: false } : layer)) };
        const { editor, history } = setup(hidden);
        expect(editor.setCurrentLayer(L.walls)).toBe(true);
        expect(editor.snapshot.currentLayerId).toBe(L.walls);
        expect(layerOf(history, L.walls).visible).toBe(true);
        expect(editor.undo()).toBe(true);
        expect(layerOf(history, L.walls).visible).toBe(false);
        expect(editor.snapshot).toMatchObject({ currentLayerId: L['0'], message: 'Rückgängig: LAYER' });
    });

    it('refuses an unknown layer, and a hidden one while a command runs', () => {
        const doc = parseDocument(samplePlan);
        const hidden = { ...doc, layers: doc.layers.map((layer) => (layer.id === L.walls ? { ...layer, visible: false } : layer)) };
        const { editor, history } = setup(hidden);
        expect(editor.setCurrentLayer('nope')).toBe(false);
        editor.startCommand('LINE');
        expect(editor.setCurrentLayer(L.walls)).toBe(false);
        expect(editor.snapshot).toMatchObject({ currentLayerId: L['0'], message: BUSY });
        expect(layerOf(history, L.walls).visible).toBe(false);
    });

    it('goes back to layer 0 when the current layer is hidden by a change', () => {
        const { editor, history } = setup();
        editor.setCurrentLayer(L.walls);
        const { document } = history;
        history.applyRemote(
            { document: { ...document, layers: document.layers.map((layer) => (layer.id === L.walls ? { ...layer, visible: false } : layer)) }, changedElementIds: [] },
            'somebody',
        );
        expect(editor.snapshot.currentLayerId).toBe(L['0']);
    });
});

describe('SelectionEditor layer changes', () => {
    it('adds a layer with the next free name and makes it current', () => {
        const { editor, history } = setup();
        const id = editor.addLayer(() => 'new-1')!;
        expect(id).toBe('new-1');
        expect(history.document.layers.at(-1)).toEqual({
            id,
            floorId: sampleIds.floor.ground,
            name: 'Layer1',
            visible: true,
            locked: false,
            color: '#000000',
            linetype: 'continuous',
            transparency: 0,
            lineweight: 25,
            description: '',
        });
        expect(editor.snapshot.currentLayerId).toBe(id);
        expect(layerOf(history, editor.addLayer()!).name).toBe('Layer2');
        // Without the layer, layer 0 is current again
        editor.undo();
        editor.undo();
        expect(history.document.layers).toHaveLength(4);
        expect(editor.snapshot.currentLayerId).toBe(L['0']);
    });

    it('changes properties as one undo step, tidied', () => {
        const { editor, history } = setup();
        const changes = { name: '  Wände ', color: '#FF0000', linetype: 'dashDot', transparency: 120.4, lineweight: 100, description: 'tragend' } as const;
        expect(editor.updateLayer(L.walls, changes)).toBe(true);
        expect(layerOf(history, L.walls)).toMatchObject({ name: 'Wände', color: '#ff0000', linetype: 'dashDot', transparency: 90, lineweight: 100, description: 'tragend' });
        expect(editor.undo()).toBe(true);
        expect(layerOf(history, L.walls)).toMatchObject({ name: 'Walls', color: '#1f2937', linetype: 'continuous', transparency: 0, lineweight: 50, description: '' });
        expect(editor.snapshot.canUndo).toBe(false);
    });

    it('makes no step of what stays the same', () => {
        const { editor } = setup();
        expect(editor.updateLayer(L.walls, { name: 'Walls', visible: true, color: '#1F2937' })).toBe(true);
        expect(editor.snapshot.canUndo).toBe(false);
    });

    it('refuses a name another layer has, and any other name for layer 0', () => {
        const { editor, history } = setup();
        expect(editor.updateLayer(L.walls, { name: 'furniture' })).toBe(false);
        expect(editor.snapshot.message).toBe('Ein Layer mit diesem Namen ist bereits vorhanden.');
        expect(editor.updateLayer(L['0'], { name: 'Null' })).toBe(false);
        expect(editor.snapshot.message).toBe('Der Layer 0 kann nicht umbenannt werden.');
        expect(history.document.layers.map((layer) => layer.name)).toEqual(['0', 'Walls', 'Doors & windows', 'Furniture']);
    });

    it('hides and locks a layer, but never hides the current one', () => {
        const { editor, history } = setup();
        expect(editor.updateLayer(L.walls, { visible: false, locked: true })).toBe(true);
        expect(layerOf(history, L.walls)).toMatchObject({ visible: false, locked: true });
        expect(editor.updateLayer(L['0'], { visible: false })).toBe(false);
        expect(editor.snapshot.message).toBe('Der aktuelle Layer kann nicht ausgeblendet werden.');
        expect(editor.updateLayer(L['0'], { locked: true })).toBe(true);
    });

    it('drops the selection of what a layer hides', () => {
        const { editor } = setup();
        // On the sofa's outline, away from its corners
        const point = { x: 1600, y: 2600 };
        editor.pointerMove(at(point));
        editor.pointerDown(at(point));
        editor.pointerUp(at(point));
        expect(editor.snapshot.highlighted).toEqual(new Set([sampleIds.element.sofa]));
        editor.updateLayer(L.furniture, { visible: false });
        expect(editor.snapshot.highlighted.size).toBe(0);
    });

    it('removes an empty layer, and keeps layer 0, the current layer and layers with objects', () => {
        const { editor, history } = setup();
        const id = editor.addLayer()!;
        expect(editor.removeLayer(id)).toBe(false);
        expect(editor.snapshot.message).toBe('Der aktuelle Layer kann nicht gelöscht werden.');
        editor.setCurrentLayer(L['0']);
        expect(editor.removeLayer(L.walls)).toBe(false);
        expect(editor.snapshot.message).toBe('Der Layer enthält Objekte und kann nicht gelöscht werden.');
        expect(editor.removeLayer(L['0'])).toBe(false);
        expect(editor.snapshot.message).toBe('Der Layer 0 kann nicht gelöscht werden.');
        expect(editor.removeLayer(id)).toBe(true);
        expect(history.document.layers).toHaveLength(4);
        expect(editor.undo()).toBe(true);
        expect(history.document.layers.at(-1)!.id).toBe(id);
    });

    it('changes no layer while a command runs', () => {
        const { editor, history } = setup();
        const before = history.document;
        editor.startCommand('LINE');
        expect(editor.addLayer()).toBeNull();
        expect(editor.updateLayer(L.walls, { visible: false })).toBe(false);
        expect(editor.removeLayer(L.walls)).toBe(false);
        expect(editor.snapshot.message).toBe(BUSY);
        expect(history.document).toBe(before);
    });
});

describe('SelectionEditor: the selection on another layer', () => {
    /** On the sofa's outline, away from its corners; on the window, a line. */
    const SOFA = { x: 1600, y: 2600 };
    const WINDOW = { x: 4250, y: 3880 };
    const elementLayer = (history: DocumentHistory, id: string) => history.document.elements.find((element) => element.id === id)!.layerId;
    const pick = (editor: SelectionEditor, point: Point) => {
        editor.pointerMove(at(point));
        editor.pointerDown(at(point));
        editor.pointerUp(at(point));
    };

    it('puts the selected objects on the layer as one undo step, and keeps them selected and the current layer', () => {
        const { editor, history } = setup();
        pick(editor, SOFA);
        pick(editor, WINDOW);
        expect(editor.moveSelectionToLayer(L.walls)).toBe(true);
        expect([sampleIds.element.sofa, sampleIds.element.window].map((id) => elementLayer(history, id))).toEqual([L.walls, L.walls]);
        expect(editor.snapshot).toMatchObject({ currentLayerId: L['0'], message: '2 auf den Layer „Walls“ gelegt.' });
        expect(editor.snapshot.highlighted).toEqual(new Set([sampleIds.element.sofa, sampleIds.element.window]));
        expect(editor.undo()).toBe(true);
        expect(history.document).toEqual(parseDocument(samplePlan));
        expect(editor.snapshot.canUndo).toBe(false);
    });

    it('makes no step where the objects are on the layer already', () => {
        const { editor } = setup();
        pick(editor, SOFA);
        expect(editor.moveSelectionToLayer(L.furniture)).toBe(true);
        expect(editor.snapshot).toMatchObject({ canUndo: false, message: '0 auf den Layer „Furniture“ gelegt.' });
    });

    it('says so when the layer is hidden, where the objects cannot stay selected', () => {
        const { editor, history } = setup();
        editor.updateLayer(L.walls, { visible: false });
        pick(editor, SOFA);
        expect(editor.moveSelectionToLayer(L.walls)).toBe(true);
        expect(elementLayer(history, sampleIds.element.sofa)).toBe(L.walls);
        expect(editor.snapshot.message).toBe('1 auf den ausgeblendeten Layer „Walls“ gelegt.');
        expect(editor.snapshot.highlighted.size).toBe(0);
    });

    it('does nothing without a selection, for an unknown layer or while a command runs', () => {
        const { editor, history } = setup();
        const before = history.document;
        expect(editor.moveSelectionToLayer(L.walls)).toBe(false);
        pick(editor, SOFA);
        expect(editor.moveSelectionToLayer('nope')).toBe(false);
        editor.startCommand('MOVE');
        expect(editor.moveSelectionToLayer(L.walls)).toBe(false);
        expect(history.document).toBe(before);
    });
});

describe('SelectionEditor: what the selection overrides', () => {
    const SOFA = { x: 1600, y: 2600 };
    const WINDOW = { x: 4250, y: 3880 };
    const element = (history: DocumentHistory, id: string) => history.document.elements.find((candidate) => candidate.id === id)!;
    const pick = (editor: SelectionEditor, point: Point) => {
        editor.pointerMove(at(point));
        editor.pointerDown(at(point));
        editor.pointerUp(at(point));
    };

    it('sets the values on the selected objects as one undo step, tidied, and keeps them selected', () => {
        const { editor, history } = setup();
        pick(editor, SOFA);
        pick(editor, WINDOW);
        expect(editor.setSelectionAppearance({ color: '#FF0000', lineweight: 100, transparency: 120.4 })).toBe(true);
        for (const id of [sampleIds.element.sofa, sampleIds.element.window]) {
            expect(element(history, id)).toMatchObject({ color: '#ff0000', linetype: null, lineweight: 100, transparency: 90 });
        }
        expect(editor.snapshot.highlighted.size).toBe(2);
        expect(editor.undo()).toBe(true);
        expect(editor.snapshot.message).toBe('Rückgängig: EIGENSCHAFTEN');
        expect(history.document).toEqual(parseDocument(samplePlan));
    });

    it('takes the value of the layer again with null, and makes no step of what stays the same', () => {
        const { editor, history } = setup();
        pick(editor, WINDOW);
        expect(editor.setSelectionAppearance({ color: null })).toBe(true);
        expect(editor.snapshot.canUndo).toBe(false);
        editor.setSelectionAppearance({ linetype: 'center' });
        editor.setSelectionAppearance({ linetype: null });
        expect(element(history, sampleIds.element.window).linetype).toBeNull();
    });

    it('leaves out values that are none', () => {
        const { editor } = setup();
        pick(editor, WINDOW);
        expect(editor.setSelectionAppearance({ color: 'red', lineweight: 26 as never })).toBe(true);
        expect(editor.snapshot.canUndo).toBe(false);
    });

    it('does nothing without a selection or while a command runs', () => {
        const { editor, history } = setup();
        const before = history.document;
        expect(editor.setSelectionAppearance({ color: '#ff0000' })).toBe(false);
        pick(editor, WINDOW);
        editor.startCommand('MOVE');
        expect(editor.setSelectionAppearance({ color: '#ff0000' })).toBe(false);
        expect(history.document).toBe(before);
    });
});
