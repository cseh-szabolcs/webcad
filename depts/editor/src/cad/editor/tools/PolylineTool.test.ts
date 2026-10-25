import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import type { PolylineElement } from '../../model/CadElement';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import type { EditorPointerEvent } from '../EditorPointerEvent';
import { DocumentHistory } from '../commands/DocumentHistory';
import { SelectionEditor } from '../SelectionEditor';
import { DEFAULT_DYNAMIC_INPUT_SETTINGS } from '../../../settings/editorSettings';

const { element: E } = sampleIds;

/** One screen pixel is 2 mm (Y flipped), so the 10 px aperture reaches 20 mm. */
const at = (modelPoint: Point, change: Partial<EditorPointerEvent> = {}): EditorPointerEvent => ({
    viewPoint: { x: modelPoint.x / 2, y: -modelPoint.y / 2 },
    modelPoint,
    pixelSize: 2,
    button: 0,
    shiftKey: false,
    altKey: false,
    ...change,
});
/** Empty space between the door, the sofa and the rug, where nothing snaps. */
const A = { x: 1500, y: 1500 };
const B = { x: 2500, y: 1500 };
const C = { x: 2500, y: 2300 };

const START_PROMPT = 'Startpunkt angeben:';
const NEXT_PROMPT = 'Nächsten Punkt angeben oder [Zurück]:';
const NEXT_CLOSE_PROMPT = 'Nächsten Punkt angeben oder [Schließen/sehnenLänge/Zurück]:';
const LENGTH_PROMPT = 'Länge der Linie angeben:';

const setup = () => {
    const history = new DocumentHistory(parseDocument(samplePlan));
    const editor = new SelectionEditor(history);
    return { editor, history, polylines: () => newPolylines(history.document) };
};
const click = (editor: SelectionEditor, point: Point, change: Partial<EditorPointerEvent> = {}) => {
    editor.pointerMove(at(point, change));
    editor.pointerDown(at(point, change));
    editor.pointerUp(at(point, change));
};
/** Types text and ends it with Enter. */
const type = (editor: SelectionEditor, text: string) => {
    for (const key of text) {
        editor.keyDown({ key });
    }
    editor.keyDown({ key: 'Enter' });
};
const sampleIdsSet = new Set<string>(Object.values(E));
/** Polylines that are not in the sample plan, as their points and closed flag. */
function newPolylines(doc: CadDocument): { points: Point[]; closed: boolean }[] {
    const vertex = (id: string) => {
        const { x, y } = doc.vertices.find((v) => v.id === id)!;
        return { x, y };
    };
    return doc.elements
        .filter((element): element is PolylineElement => element.type === 'polyline' && !sampleIdsSet.has(element.id))
        .map((polyline) => ({ points: polyline.vertexIds.map(vertex), closed: polyline.closed }));
}

describe('PolylineTool (PLINIE)', () => {
    it('starts by name or alias and drops the pickfirst selection', () => {
        for (const name of ['PL', 'plinie', 'PLINE']) {
            const { editor } = setup();
            click(editor, { x: 3000, y: 0 });
            expect(editor.snapshot.highlighted.size).toBe(1);
            type(editor, name);
            expect(editor.snapshot).toMatchObject({ command: 'PLINE', prompt: START_PROMPT, cursor: 'point', grips: [] });
            expect(editor.snapshot.highlighted.size).toBe(0);
        }
    });

    it('previews the segments so far and the one to the cursor, the document unchanged', () => {
        const { editor, polylines, history } = setup();
        const before = history.document;
        editor.startCommand('PLINE');
        click(editor, A);
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: A, preview: { kind: 'polyline', points: [A] } });
        click(editor, B);
        editor.pointerMove(at({ x: 2000, y: 2000 }));
        expect(editor.snapshot).toMatchObject({
            prompt: NEXT_CLOSE_PROMPT,
            from: B,
            preview: { kind: 'polyline', points: [A, B] },
            previewPoint: { x: 2000, y: 2000 },
        });
        expect(history.document).toBe(before);
        expect(polylines()).toEqual([]);
    });

    it('adds one polyline with its own vertices when it ends, as one undo step', () => {
        const { editor, polylines, history } = setup();
        editor.startCommand('PLINE');
        click(editor, A);
        click(editor, B);
        click(editor, C);
        editor.keyDown({ key: 'Enter' });
        expect(polylines()).toEqual([{ points: [A, B, C], closed: false }]);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', canUndo: true });
        const added = history.document.elements.at(-1) as PolylineElement;
        expect(added).toMatchObject({ layerId: null, groupId: null, styleId: null });
        expect(new Set(added.vertexIds).size).toBe(3);
        expect(editor.undo()).toBe(true);
        expect(polylines()).toEqual([]);
        expect(editor.snapshot.message).toBe('Rückgängig: PLINIE');
        expect(editor.redo()).toBe(true);
        expect(polylines()).toEqual([{ points: [A, B, C], closed: false }]);
    });

    it('does not snap to its own segments before it ends', () => {
        const { editor } = setup();
        editor.startCommand('PLINE');
        click(editor, A);
        click(editor, B);
        editor.pointerMove(at({ x: 2004, y: 1506 }));
        expect(editor.snapshot.snap).toBeNull();
    });

    it('adds no segment for a point on the last one', () => {
        const { editor, polylines } = setup();
        editor.startCommand('PLINE');
        click(editor, A);
        click(editor, A);
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, preview: { points: [A] } });
        click(editor, B);
        click(editor, B);
        editor.keyDown({ key: 'Enter' });
        expect(polylines()).toEqual([{ points: [A, B], closed: false }]);
    });

    it('measures typed points, direct distances and polar paths from the last point', () => {
        const { editor, polylines } = setup();
        editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: false });
        editor.startCommand('PLINE');
        type(editor, '1500,1500');
        type(editor, '@1000,0');
        editor.pointerMove(at({ x: 2508, y: 2000 }));
        expect(editor.snapshot.polar).toMatchObject({ angle: 90, point: { x: 2500, y: 2000 } });
        type(editor, '800');
        editor.keyDown({ key: 'Enter' });
        expect(polylines()).toEqual([{ points: [A, B, C], closed: false }]);
    });

    it('takes distance and angle from the last point with Dynamic Input', () => {
        const { editor, polylines } = setup();
        editor.startCommand('PLINE');
        type(editor, '1500,1500');
        expect(editor.snapshot.dynamicInput).toMatchObject({ layout: 'dimension', format: 'polar', relative: true });
        type(editor, '1000<0');
        editor.keyDown({ key: 'Enter' });
        expect(polylines()).toEqual([{ points: [A, B], closed: false }]);
    });

    it('takes back the last segment with "Zurück", down to the start point', () => {
        const { editor, polylines, history } = setup();
        editor.startCommand('PLINE');
        click(editor, A);
        click(editor, B);
        click(editor, C);
        type(editor, 'z');
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_CLOSE_PROMPT, from: B, preview: { points: [A, B] } });
        type(editor, 'Zurück');
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: A, preview: { points: [A] } });
        type(editor, 'Z');
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, message: 'Alle Segmente bereits zurückgenommen.' });
        // A start point alone adds nothing
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.command).toBeNull();
        expect(polylines()).toEqual([]);
        expect(history.undoCommand).toBeNull();
    });

    it('closes from one segment on and ends', () => {
        const { editor, polylines } = setup();
        editor.startCommand('PLINE');
        click(editor, A);
        type(editor, 's');
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
        click(editor, B);
        click(editor, C);
        type(editor, 'S');
        expect(polylines()).toEqual([{ points: [A, B, C], closed: true }]);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:' });
    });

    it('closes onto the start point without repeating it', () => {
        const { editor, polylines } = setup();
        editor.startCommand('PLINE');
        click(editor, A);
        click(editor, B);
        click(editor, C);
        click(editor, A);
        type(editor, 'Schließen');
        expect(polylines()).toEqual([{ points: [A, B, C], closed: true }]);
    });

    it('adds a segment of a typed length in the direction of the last one with "sehnenLänge"', () => {
        const { editor, polylines } = setup();
        editor.startCommand('PLINE');
        click(editor, A);
        click(editor, B);
        type(editor, 'L');
        expect(editor.snapshot).toMatchObject({ prompt: LENGTH_PROMPT, from: B, cursor: 'point' });
        // DYN shows the distance alone, on a dimension from the last point
        editor.pointerMove(at({ x: 2500, y: 1800 }));
        expect(editor.snapshot.dynamicInput).toMatchObject({
            layout: 'dimension',
            format: 'distance',
            fields: [{ kind: 'distance', text: '300.00' }],
        });
        expect(editor.snapshot).toMatchObject({
            preview: { kind: 'polyline', points: [A, B], direction: { x: 1, y: 0 } },
            previewPoint: { x: 2500, y: 1800 },
        });
        type(editor, '500');
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_CLOSE_PROMPT, from: { x: 3000, y: 1500 } });
        editor.keyDown({ key: 'Enter' });
        expect(polylines()).toEqual([{ points: [A, B, { x: 3000, y: 1500 }], closed: false }]);
    });

    it('takes the length as the distance from the last point to a point given', () => {
        const { editor, polylines } = setup();
        editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: false });
        editor.startCommand('PLINE');
        type(editor, '1500,1500');
        // Diagonal, so the length goes on at 3:4
        type(editor, '@300,400');
        type(editor, 'Länge');
        click(editor, { x: 1800, y: 2400 });
        expect(editor.snapshot.prompt).toBe(NEXT_CLOSE_PROMPT);
        type(editor, 'sehnenlänge');
        type(editor, '@0,-1000');
        editor.keyDown({ key: 'Enter' });
        const [{ points }] = polylines();
        expect(points.slice(0, 2)).toEqual([A, { x: 1800, y: 1900 }]);
        expect(points[2].x).toBeCloseTo(2100);
        expect(points[2].y).toBeCloseTo(2300);
        expect(points[3].x).toBeCloseTo(2700);
        expect(points[3].y).toBeCloseTo(3100);
    });

    it('takes only a positive length, and no option at the length prompt', () => {
        const { editor, polylines } = setup();
        editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: false });
        editor.startCommand('PLINE');
        click(editor, A);
        // Not before the first segment
        type(editor, 'l');
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
        click(editor, B);
        type(editor, 'l');
        for (const text of ['0', '-200']) {
            type(editor, text);
            expect(editor.snapshot).toMatchObject({ prompt: LENGTH_PROMPT, message: 'Wert muss positiv und ungleich Null sein.' });
        }
        click(editor, B);
        expect(editor.snapshot).toMatchObject({ prompt: LENGTH_PROMPT, message: 'Wert muss positiv und ungleich Null sein.' });
        for (const text of ['z', '']) {
            type(editor, text);
            expect(editor.snapshot).toMatchObject({
                prompt: LENGTH_PROMPT,
                message: 'Erfordert numerischen Abstand oder zweiten Punkt.',
            });
        }
        // Esc ends the command, keeping the polyline
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        expect(polylines()).toEqual([{ points: [A, B], closed: false }]);
    });

    it('ends with Enter, a right click or Esc, keeping the polyline', () => {
        for (const end of ['enter', 'right', 'esc'] as const) {
            const { editor, polylines } = setup();
            editor.startCommand('PLINE');
            click(editor, A);
            click(editor, B);
            click(editor, C);
            if (end === 'enter') {
                editor.keyDown({ key: 'Enter' });
            } else if (end === 'right') {
                click(editor, { x: 2000, y: 2000 }, { button: 2 });
            } else {
                editor.keyDown({ key: 'Escape' });
            }
            expect(editor.snapshot).toMatchObject({
                command: null,
                message: end === 'esc' ? '*Abbruch*' : null,
                canUndo: true,
            });
            expect(polylines()).toEqual([{ points: [A, B, C], closed: false }]);
        }
    });

    it('ends at the start point with Esc, without a polyline', () => {
        const { editor, polylines } = setup();
        editor.startCommand('PLINE');
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*', canUndo: false });
        expect(polylines()).toEqual([]);
    });

    it('repeats with Enter at "Befehl:" and continues from the last polyline or line with Enter at the start point', () => {
        const { editor, polylines } = setup();
        editor.startCommand('PLINE');
        click(editor, A);
        click(editor, B);
        editor.keyDown({ key: 'Enter' });
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ command: 'PLINE', prompt: START_PROMPT });
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: B });
        click(editor, C);
        editor.keyDown({ key: 'Enter' });
        // From a line drawn by LINIE too
        editor.startCommand('LINE');
        click(editor, C);
        click(editor, A);
        editor.keyDown({ key: 'Enter' });
        editor.startCommand('PLINE');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: A });
        click(editor, B);
        editor.keyDown({ key: 'Enter' });
        expect(polylines()).toEqual([
            { points: [A, B], closed: false },
            { points: [B, C], closed: false },
            { points: [A, B], closed: false },
        ]);
    });

    it('continues a closed polyline at its start point, and reports when there is nothing to continue', () => {
        const { editor } = setup();
        editor.startCommand('PLINE');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({
            prompt: START_PROMPT,
            message: 'Keine Linie oder kein Bogen zum Fortsetzen.',
        });
        click(editor, A);
        click(editor, B);
        click(editor, C);
        type(editor, 's');
        editor.startCommand('PLINE');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: A });
        editor.keyDown({ key: 'Escape' });
        // Not once the polyline is undone
        editor.undo();
        editor.startCommand('PLINE');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.message).toBe('Keine Linie oder kein Bogen zum Fortsetzen.');
    });

    it('cancels another running command when started', () => {
        const { editor, polylines } = setup();
        editor.startCommand('LINE');
        editor.startCommand('PLINE');
        expect(editor.snapshot).toMatchObject({ command: 'PLINE', prompt: START_PROMPT });
        // The same command keeps running
        click(editor, A);
        editor.startCommand('PLINE');
        expect(editor.snapshot).toMatchObject({ command: 'PLINE', prompt: NEXT_PROMPT });
        // Another one ends it, keeping what was drawn
        click(editor, B);
        editor.startCommand('MOVE');
        expect(editor.snapshot.command).toBe('MOVE');
        expect(polylines()).toEqual([{ points: [A, B], closed: false }]);
    });
});
