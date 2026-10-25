import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import type { LineElement } from '../../model/CadElement';
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

const FIRST_PROMPT = 'Ersten Punkt angeben:';
const NEXT_PROMPT = 'Nächsten Punkt angeben oder [Zurück]:';
const NEXT_CLOSE_PROMPT = 'Nächsten Punkt angeben oder [Schließen/Zurück]:';

const setup = () => {
    const history = new DocumentHistory(parseDocument(samplePlan));
    const editor = new SelectionEditor(history);
    return { editor, history, lines: () => newLines(history.document) };
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
/** Lines that are not in the sample plan, as [start, end]. */
function newLines(doc: CadDocument): [Point, Point][] {
    const vertex = (id: string) => {
        const { x, y } = doc.vertices.find((v) => v.id === id)!;
        return { x, y };
    };
    return doc.elements
        .filter((element): element is LineElement => element.type === 'line' && !sampleIdsSet.has(element.id))
        .map((line) => [vertex(line.startVertexId), vertex(line.endVertexId)]);
}

describe('LineTool (LINIE)', () => {
    it('starts by name or alias and drops the pickfirst selection', () => {
        for (const name of ['L', 'linie', 'LINE']) {
            const { editor } = setup();
            click(editor, { x: 3000, y: 0 });
            expect(editor.snapshot.highlighted.size).toBe(1);
            type(editor, name);
            expect(editor.snapshot).toMatchObject({ command: 'LINE', prompt: FIRST_PROMPT, cursor: 'point', grips: [] });
            expect(editor.snapshot.highlighted.size).toBe(0);
        }
    });

    it('adds a separate line with every next point at once and asks again', () => {
        const { editor, lines, history } = setup();
        editor.startCommand('LINE');
        click(editor, A);
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: A, preview: 'line', previewPoint: A });
        expect(lines()).toEqual([]);
        click(editor, B);
        expect(lines()).toEqual([[A, B]]);
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: B });
        click(editor, C);
        expect(lines()).toEqual([
            [A, B],
            [B, C],
        ]);
        expect(editor.snapshot.prompt).toBe(NEXT_CLOSE_PROMPT);
        // Each segment has its own vertices
        const vertexIds = history.document.elements
            .filter((element): element is LineElement => element.type === 'line' && !sampleIdsSet.has(element.id))
            .flatMap((line) => [line.startVertexId, line.endVertexId]);
        expect(new Set(vertexIds).size).toBe(4);
    });

    it('previews the line to the point a click would take', () => {
        const { editor } = setup();
        editor.startCommand('LINE');
        click(editor, A);
        editor.pointerMove(at({ x: 1800, y: 1700 }));
        expect(editor.snapshot).toMatchObject({ from: A, preview: 'line', previewPoint: { x: 1800, y: 1700 } });
    });

    it('draws nothing for a point on the last one', () => {
        const { editor, lines } = setup();
        editor.startCommand('LINE');
        click(editor, A);
        click(editor, A);
        expect(lines()).toEqual([]);
        expect(editor.snapshot.prompt).toBe(NEXT_PROMPT);
    });

    it('snaps to the segments just drawn', () => {
        const { editor } = setup();
        editor.startCommand('LINE');
        click(editor, A);
        click(editor, B);
        editor.pointerMove(at({ x: 2004, y: 1506 }));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'MID', point: { x: 2000, y: 1500 } });
        editor.pointerMove(at({ x: 1506, y: 1504 }));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'END', point: A });
    });

    it('measures typed points and direct distances from the last point', () => {
        const { editor, lines } = setup();
        editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: false });
        editor.startCommand('LINE');
        type(editor, '1500,1500');
        type(editor, '@1000,0');
        type(editor, '@800<90');
        editor.pointerMove(at({ x: 2000, y: 2300 }));
        type(editor, '500');
        expect(lines()).toEqual([
            [A, B],
            [B, C],
            [C, { x: 2000, y: 2300 }],
        ]);
    });

    it('takes distance and angle from the last point with Dynamic Input', () => {
        const { editor, lines } = setup();
        editor.startCommand('LINE');
        type(editor, '1500,1500');
        expect(editor.snapshot.dynamicInput).toMatchObject({ layout: 'dimension', format: 'polar', relative: true });
        type(editor, '1000<0');
        expect(lines()).toEqual([[A, B]]);
    });

    it('follows a polar path from the last point', () => {
        const { editor, lines } = setup();
        editor.startCommand('LINE');
        click(editor, A);
        click(editor, B);
        editor.pointerMove(at({ x: 2508, y: 2000 }));
        expect(editor.snapshot.polar).toMatchObject({ angle: 90, point: { x: 2500, y: 2000 } });
        click(editor, { x: 2508, y: 2000 });
        expect(lines()[1]).toEqual([B, { x: 2500, y: 2000 }]);
    });

    it('takes back the last segment with "Zurück", down to the first point', () => {
        const { editor, lines, history } = setup();
        editor.startCommand('LINE');
        click(editor, A);
        click(editor, B);
        click(editor, C);
        type(editor, 'z');
        expect(lines()).toEqual([[A, B]]);
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: B });
        type(editor, 'Zurück');
        expect(lines()).toEqual([]);
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: A });
        type(editor, 'Z');
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, message: 'Alle Segmente bereits zurückgenommen.' });
        // Nothing to redo: the segments taken back are gone
        editor.keyDown({ key: 'Enter' });
        expect(history.redoCommand).toBeNull();
        expect(history.undoCommand).toBeNull();
    });

    it('closes the series from two segments on and ends', () => {
        const { editor, lines } = setup();
        editor.startCommand('LINE');
        click(editor, A);
        click(editor, B);
        type(editor, 's');
        expect(editor.snapshot).toMatchObject({
            prompt: NEXT_PROMPT,
            message: 'Punkt oder Option-Schlüsselwort erforderlich.',
        });
        click(editor, C);
        type(editor, 'S');
        expect(lines()).toEqual([
            [A, B],
            [B, C],
            [C, A],
        ]);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:' });
    });

    it('ends with Enter, a right click or Esc, keeping the lines as one undo step', () => {
        for (const end of ['enter', 'right', 'esc'] as const) {
            const { editor, lines } = setup();
            editor.startCommand('LINE');
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
            expect(lines()).toHaveLength(2);
            expect(editor.undo()).toBe(true);
            expect(lines()).toEqual([]);
            expect(editor.snapshot.message).toBe('Rückgängig: LINIE');
            expect(editor.redo()).toBe(true);
            expect(lines()).toHaveLength(2);
        }
    });

    it('takes a right click as Enter: continues at the first point, ends the typed text', () => {
        const { editor, lines } = setup();
        editor.startCommand('LINE');
        click(editor, A);
        click(editor, B);
        editor.keyDown({ key: 'Enter' });
        editor.startCommand('LINE');
        click(editor, A, { button: 2 });
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: B });
        click(editor, C);
        click(editor, A);
        for (const key of 's') {
            editor.keyDown({ key });
        }
        click(editor, A, { button: 2 });
        expect(lines()).toEqual([
            [A, B],
            [B, C],
            [C, A],
            [A, B],
        ]);
        expect(editor.snapshot.command).toBeNull();
    });

    it('ends at the first point with Esc, without a line', () => {
        const { editor, lines } = setup();
        editor.startCommand('LINE');
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*', canUndo: false });
        expect(lines()).toEqual([]);
    });

    it('repeats with Enter at "Befehl:" and continues from the last line with Enter at the first point', () => {
        const { editor, lines } = setup();
        editor.startCommand('LINE');
        click(editor, A);
        click(editor, B);
        editor.keyDown({ key: 'Enter' });
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ command: 'LINE', prompt: FIRST_PROMPT });
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ prompt: NEXT_PROMPT, from: B });
        click(editor, C);
        expect(lines()).toEqual([
            [A, B],
            [B, C],
        ]);
    });

    it('reports when there is no line to continue', () => {
        const { editor } = setup();
        editor.startCommand('LINE');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({
            prompt: FIRST_PROMPT,
            message: 'Keine Linie oder kein Bogen zum Fortsetzen.',
        });
        // Also once the last line is undone
        click(editor, A);
        click(editor, B);
        editor.keyDown({ key: 'Enter' });
        editor.undo();
        editor.startCommand('LINE');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.message).toBe('Keine Linie oder kein Bogen zum Fortsetzen.');
    });

    it('cancels another running command when started', () => {
        const { editor } = setup();
        editor.startCommand('MOVE');
        editor.startCommand('LINE');
        expect(editor.snapshot).toMatchObject({ command: 'LINE', prompt: FIRST_PROMPT });
        // The same command keeps running
        click(editor, A);
        editor.startCommand('LINE');
        expect(editor.snapshot).toMatchObject({ command: 'LINE', prompt: NEXT_PROMPT });
    });
});
