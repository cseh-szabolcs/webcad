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

    it('refuses a layer that is unknown or hidden', () => {
        const doc = parseDocument(samplePlan);
        const hidden = { ...doc, layers: doc.layers.map((layer) => (layer.id === L.walls ? { ...layer, visible: false } : layer)) };
        const { editor } = setup(hidden);
        expect(editor.setCurrentLayer(L.walls)).toBe(false);
        expect(editor.setCurrentLayer('nope')).toBe(false);
        expect(editor.snapshot.currentLayerId).toBe(L['0']);
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
