import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import type { CircleElement } from '../../model/CadElement';
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

const CENTER_PROMPT = 'Zentrum für Kreis angeben oder [3P/2P]:';
const RADIUS_PROMPT = 'Radius für Kreis angeben oder [Durchmesser]:';
const DIAMETER_PROMPT = 'Durchmesser für Kreis angeben:';

/** Without Dynamic Input, so typed coordinates are absolute. */
const setup = (dynamicInput = false) => {
    const history = new DocumentHistory(parseDocument(samplePlan));
    const editor = new SelectionEditor(history);
    editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: dynamicInput });
    return { editor, history, circles: () => newCircles(history.document) };
};
const click = (editor: SelectionEditor, point: Point) => {
    editor.pointerMove(at(point));
    editor.pointerDown(at(point));
    editor.pointerUp(at(point));
};
/** Types text and ends it with Enter. */
const type = (editor: SelectionEditor, text: string) => {
    for (const key of text) {
        editor.keyDown({ key });
    }
    editor.keyDown({ key: 'Enter' });
};
const round = (n: number) => Math.round(n * 1000) / 1000 + 0;
const sampleIdsSet = new Set<string>(Object.values(E));
/** Circles that are not in the sample plan, as centre and radius (rounded). */
function newCircles(doc: CadDocument): { center: Point; radius: number }[] {
    return doc.elements
        .filter((element): element is CircleElement => element.type === 'circle' && !sampleIdsSet.has(element.id))
        .map((circle) => {
            const { x, y } = doc.vertices.find((v) => v.id === circle.centerVertexId)!;
            return { center: { x: round(x), y: round(y) }, radius: round(circle.radius) };
        });
}

describe('CircleTool (KREIS)', () => {
    it('starts by name or alias and drops the pickfirst selection', () => {
        for (const name of ['K', 'kreis', 'C', 'CIRCLE']) {
            const { editor } = setup();
            click(editor, { x: 3000, y: 0 });
            expect(editor.snapshot.highlighted.size).toBe(1);
            type(editor, name);
            expect(editor.snapshot).toMatchObject({ command: 'CIRCLE', prompt: CENTER_PROMPT, cursor: 'point', grips: [] });
            expect(editor.snapshot.highlighted.size).toBe(0);
        }
    });

    it('previews the circle with a rubber band, then adds it with the radius clicked, as one undo step', () => {
        const { editor, circles, history } = setup();
        const before = history.document;
        editor.startCommand('CIRCLE');
        click(editor, A);
        editor.pointerMove(at({ x: 1800, y: 1500 }));
        const { preview } = editor.snapshot;
        expect(editor.snapshot).toMatchObject({ prompt: RADIUS_PROMPT, from: A, preview: { kind: 'curve', rubberBand: true } });
        if (typeof preview !== 'object' || preview?.kind !== 'curve') {
            throw new Error('no curve preview');
        }
        expect(preview.curveAt({ x: 1800, y: 1500 })).toEqual({ kind: 'circle', center: A, radius: 300 });
        expect(history.document).toBe(before);
        click(editor, { x: 1800, y: 1500 });
        expect(circles()).toEqual([{ center: A, radius: 300 }]);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', canUndo: true });
        const added = history.document.elements.at(-1) as CircleElement;
        expect(added).toMatchObject({ layerId: null, groupId: null, styleId: null });
        expect(editor.undo()).toBe(true);
        expect(circles()).toEqual([]);
        expect(editor.snapshot.message).toBe('Rückgängig: KREIS');
        expect(editor.redo()).toBe(true);
        expect(circles()).toEqual([{ center: A, radius: 300 }]);
    });

    it('takes a typed radius, or the diameter with the option "Durchmesser"', () => {
        const { editor, circles } = setup();
        editor.startCommand('CIRCLE');
        type(editor, '1500,1500');
        type(editor, '250');
        editor.startCommand('CIRCLE');
        type(editor, '1500,1500');
        type(editor, 'd');
        expect(editor.snapshot).toMatchObject({ prompt: DIAMETER_PROMPT, from: A });
        type(editor, '250');
        expect(circles()).toEqual([
            { center: A, radius: 250 },
            { center: A, radius: 125 },
        ]);
    });

    it('takes the radius as the distance to a typed point, and only a positive one', () => {
        const { editor, circles } = setup();
        editor.startCommand('CIRCLE');
        type(editor, '1500,1500');
        type(editor, '0');
        expect(editor.snapshot).toMatchObject({ prompt: RADIUS_PROMPT, message: 'Wert muss positiv und ungleich Null sein.' });
        type(editor, '-5');
        expect(editor.snapshot.prompt).toBe(RADIUS_PROMPT);
        // Enter alone has no default radius yet
        type(editor, '');
        expect(editor.snapshot).toMatchObject({ prompt: RADIUS_PROMPT, message: 'Erfordert numerischen Abstand oder zweiten Punkt.' });
        type(editor, '@300,400');
        expect(circles()).toEqual([{ center: A, radius: 500 }]);
    });

    it('takes the radius from the Dynamic Input distance field', () => {
        const { editor, circles } = setup(true);
        editor.startCommand('CIRCLE');
        type(editor, '1500,1500');
        editor.pointerMove(at({ x: 1500, y: 1700 }));
        expect(editor.snapshot.dynamicInput).toMatchObject({
            layout: 'dimension',
            format: 'distance',
            fields: [{ kind: 'distance', text: '200.00' }],
        });
        type(editor, '75');
        expect(circles()).toEqual([{ center: A, radius: 75 }]);
    });

    it('draws a circle on the two ends of a diameter with "2P"', () => {
        const { editor, circles } = setup();
        editor.startCommand('CIRCLE');
        type(editor, '2p');
        expect(editor.snapshot).toMatchObject({ prompt: 'Ersten Endpunkt für Kreisdurchmesser angeben:', from: null });
        type(editor, '1500,1500');
        expect(editor.snapshot).toMatchObject({ prompt: 'Zweiten Endpunkt für Kreisdurchmesser angeben:', from: A });
        const { preview } = editor.snapshot;
        if (typeof preview !== 'object' || preview?.kind !== 'curve') {
            throw new Error('no curve preview');
        }
        expect(preview.curveAt({ x: 1500, y: 1900 })).toEqual({ kind: 'circle', center: { x: 1500, y: 1700 }, radius: 200 });
        // The first point again gives no circle
        type(editor, '1500,1500');
        expect(editor.snapshot.prompt).toBe('Zweiten Endpunkt für Kreisdurchmesser angeben:');
        type(editor, '@0,400');
        expect(circles()).toEqual([{ center: { x: 1500, y: 1700 }, radius: 200 }]);
    });

    it('draws a circle through three points with "3P", ignoring points that give none', () => {
        const { editor, circles } = setup();
        editor.startCommand('CIRCLE');
        type(editor, '3P');
        expect(editor.snapshot.prompt).toBe('Ersten Punkt auf Kreis angeben:');
        type(editor, '1500,1500');
        expect(editor.snapshot).toMatchObject({ prompt: 'Zweiten Punkt auf Kreis angeben:', from: A, preview: { rubberBand: true } });
        type(editor, '1500,1500');
        expect(editor.snapshot.prompt).toBe('Zweiten Punkt auf Kreis angeben:');
        type(editor, '2500,1500');
        expect(editor.snapshot).toMatchObject({ prompt: 'Dritten Punkt auf Kreis angeben:', from: { x: 2500, y: 1500 } });
        // On a line with the first two
        type(editor, '3000,1500');
        expect(editor.snapshot.prompt).toBe('Dritten Punkt auf Kreis angeben:');
        type(editor, '2000,2000');
        expect(circles()).toEqual([{ center: { x: 2000, y: 1500 }, radius: 500 }]);
    });

    it('takes 3P and 2P only whole, and knows no other option', () => {
        const { editor } = setup();
        editor.startCommand('CIRCLE');
        for (const text of ['P', '3', 'x']) {
            type(editor, text);
            expect(editor.snapshot).toMatchObject({ prompt: CENTER_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
        }
    });

    it('ends with Esc at every prompt, without a circle', () => {
        const { editor, circles } = setup();
        editor.startCommand('CIRCLE');
        type(editor, '1500,1500');
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        editor.startCommand('CIRCLE');
        type(editor, '3P');
        type(editor, '1500,1500');
        type(editor, '2500,1500');
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot.command).toBeNull();
        expect(circles()).toEqual([]);
    });

    it('snaps the centre to an object and repeats with Enter at "Befehl:"', () => {
        const { editor, circles } = setup();
        editor.startCommand('CIRCLE');
        // The end of the door leaf
        click(editor, { x: 1004, y: 1136 });
        expect(editor.snapshot.from).toEqual({ x: 1000, y: 1140 });
        type(editor, '100');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ command: 'CIRCLE', prompt: CENTER_PROMPT });
        expect(circles()).toEqual([{ center: { x: 1000, y: 1140 }, radius: 100 }]);
    });
});
