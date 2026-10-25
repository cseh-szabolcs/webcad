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
import { rectangleCorners } from './RectangleTool';

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

const FIRST_PROMPT = 'Ersten Eckpunkt angeben:';
const OTHER_PROMPT = 'Anderen Eckpunkt angeben oder [Abmessungen]:';
const LENGTH_PROMPT = 'Länge der Rechtecke angeben:';
const WIDTH_PROMPT = 'Breite der Rechtecke angeben:';

/** Without Dynamic Input, so typed coordinates are absolute. */
const setup = () => {
    const history = new DocumentHistory(parseDocument(samplePlan));
    const editor = new SelectionEditor(history);
    editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: false });
    return { editor, history, polylines: () => newPolylines(history.document) };
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
/** The rectangle from `first` with the other corner `other`, as newPolylines gives it. */
const rectangle = (first: Point, other: Point) => ({
    points: [first, { x: other.x, y: first.y }, other, { x: first.x, y: other.y }],
    closed: true,
});

describe('rectangleCorners', () => {
    it('goes from the first corner along X, to the other corner, then along Y', () => {
        expect(rectangleCorners({ x: 0, y: 0 }, { x: 4, y: -2 })).toEqual([
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: -2 },
            { x: 0, y: -2 },
        ]);
    });

    it('gives none without area', () => {
        expect(rectangleCorners({ x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
        expect(rectangleCorners({ x: 0, y: 0 }, { x: 0, y: 4 })).toBeNull();
    });
});

describe('RectangleTool (RECHTECK)', () => {
    it('starts by name or alias and drops the pickfirst selection', () => {
        for (const name of ['REC', 'rechteck', 'RECTANG']) {
            const { editor } = setup();
            click(editor, { x: 3000, y: 0 });
            expect(editor.snapshot.highlighted.size).toBe(1);
            type(editor, name);
            expect(editor.snapshot).toMatchObject({ command: 'RECTANG', prompt: FIRST_PROMPT, cursor: 'point', grips: [] });
            expect(editor.snapshot.highlighted.size).toBe(0);
        }
    });

    it('previews the rectangle, then adds it as a closed polyline with the other corner clicked, as one undo step', () => {
        const { editor, polylines, history } = setup();
        const before = history.document;
        editor.startCommand('RECTANG');
        click(editor, A);
        editor.pointerMove(at({ x: 1800, y: 1700 }));
        const { preview } = editor.snapshot;
        expect(editor.snapshot).toMatchObject({ prompt: OTHER_PROMPT, from: A, preview: { kind: 'curve', rubberBand: false } });
        if (typeof preview !== 'object' || preview?.kind !== 'curve') {
            throw new Error('no curve preview');
        }
        expect(preview.curveAt({ x: 1800, y: 1700 })).toEqual({
            kind: 'polygon',
            points: rectangle(A, { x: 1800, y: 1700 }).points,
        });
        expect(preview.curveAt({ x: 1800, y: 1500 })).toBeNull();
        expect(history.document).toBe(before);
        click(editor, { x: 1800, y: 1700 });
        expect(polylines()).toEqual([rectangle(A, { x: 1800, y: 1700 })]);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', canUndo: true });
        const added = history.document.elements.at(-1) as PolylineElement;
        expect(added).toMatchObject({ layerId: null, groupId: null, styleId: null });
        expect(editor.undo()).toBe(true);
        expect(polylines()).toEqual([]);
        expect(editor.snapshot.message).toBe('Rückgängig: RECHTECK');
        expect(editor.redo()).toBe(true);
        expect(polylines()).toEqual([rectangle(A, { x: 1800, y: 1700 })]);
    });

    it('takes typed corners, relative ones from the first, and ignores a corner without area', () => {
        const { editor, polylines } = setup();
        editor.startCommand('RECTANG');
        type(editor, '1500,1500');
        type(editor, '@300,0');
        type(editor, '1500,2000');
        expect(editor.snapshot).toMatchObject({ command: 'RECTANG', prompt: OTHER_PROMPT });
        type(editor, '@-300,200');
        expect(polylines()).toEqual([rectangle(A, { x: 1200, y: 1700 })]);
    });

    it('takes length and width with "Abmessungen", then a point chooses the quadrant', () => {
        const quadrants: [Point, Point][] = [
            [{ x: 1600, y: 1600 }, { x: 1600, y: 1550 }],
            [{ x: 1400, y: 1600 }, { x: 1400, y: 1550 }],
            [{ x: 1400, y: 1400 }, { x: 1400, y: 1450 }],
            [{ x: 1600, y: 1400 }, { x: 1600, y: 1450 }],
        ];
        for (const [point, other] of quadrants) {
            const { editor, polylines } = setup();
            editor.startCommand('RECTANG');
            type(editor, '1500,1500');
            type(editor, 'a');
            expect(editor.snapshot).toMatchObject({ prompt: LENGTH_PROMPT, from: A, preview: { rubberBand: true } });
            type(editor, '100');
            expect(editor.snapshot).toMatchObject({ prompt: WIDTH_PROMPT, from: A });
            type(editor, '50');
            expect(editor.snapshot).toMatchObject({ prompt: OTHER_PROMPT, from: A, preview: { rubberBand: false } });
            const { preview } = editor.snapshot;
            if (typeof preview !== 'object' || preview?.kind !== 'curve') {
                throw new Error('no curve preview');
            }
            expect(preview.curveAt(point)).toEqual({ kind: 'polygon', points: rectangle(A, other).points });
            click(editor, point);
            expect(polylines()).toEqual([rectangle(A, other)]);
        }
    });

    it('takes a length as the distance to a point, and only positive values', () => {
        const { editor, polylines } = setup();
        editor.startCommand('RECTANG');
        type(editor, '1500,1500');
        type(editor, 'Abmessungen');
        type(editor, '0');
        expect(editor.snapshot).toMatchObject({ prompt: LENGTH_PROMPT, message: 'Wert muss positiv und ungleich Null sein.' });
        type(editor, '@300,400');
        type(editor, '-5');
        expect(editor.snapshot).toMatchObject({ prompt: WIDTH_PROMPT, message: 'Wert muss positiv und ungleich Null sein.' });
        type(editor, '200');
        // On the axes the positive side
        type(editor, '1500,1500');
        expect(polylines()).toEqual([rectangle(A, { x: 2000, y: 1700 })]);
    });

    it('asks for the dimensions again at the quadrant prompt, and knows no other option', () => {
        const { editor } = setup();
        editor.startCommand('RECTANG');
        type(editor, 'a');
        expect(editor.snapshot).toMatchObject({ prompt: FIRST_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
        type(editor, '1500,1500');
        for (const text of ['x', '']) {
            type(editor, text);
            expect(editor.snapshot).toMatchObject({ prompt: OTHER_PROMPT, message: 'Punkt oder Option-Schlüsselwort erforderlich.' });
        }
        type(editor, 'a');
        type(editor, '100');
        type(editor, '50');
        type(editor, 'a');
        expect(editor.snapshot.prompt).toBe(LENGTH_PROMPT);
    });

    it('ends with Esc at every prompt, without a rectangle', () => {
        const { editor, polylines } = setup();
        editor.startCommand('RECTANG');
        type(editor, '1500,1500');
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        editor.startCommand('RECTANG');
        type(editor, '1500,1500');
        type(editor, 'a');
        type(editor, '100');
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot.command).toBeNull();
        expect(polylines()).toEqual([]);
    });

    it('snaps the first corner to an object and repeats with Enter at "Befehl:"', () => {
        const { editor, polylines } = setup();
        editor.startCommand('RECTANG');
        // The end of the door leaf
        click(editor, { x: 1004, y: 1136 });
        expect(editor.snapshot.from).toEqual({ x: 1000, y: 1140 });
        type(editor, '@100,100');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ command: 'RECTANG', prompt: FIRST_PROMPT });
        expect(polylines()).toEqual([rectangle({ x: 1000, y: 1140 }, { x: 1100, y: 1240 })]);
    });
});
