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

const FIRST_PROMPT = 'Ersten Eckpunkt angeben oder [Fasen]:';
const OTHER_PROMPT = 'Anderen Eckpunkt angeben oder [Abmessungen/Drehung]:';
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
        expect(editor.snapshot.prompt).toBe('Länge der Rechtecke angeben <100.0000>:');
    });

    it('takes the length and the width given last with Enter', () => {
        const { editor, polylines } = setup();
        editor.startCommand('RECTANG');
        type(editor, '1500,1500');
        type(editor, 'a');
        // Nothing to take yet
        type(editor, '');
        expect(editor.snapshot).toMatchObject({ prompt: LENGTH_PROMPT, message: 'Erfordert numerischen Abstand oder zweiten Punkt.' });
        type(editor, '300');
        expect(editor.snapshot.prompt).toBe(WIDTH_PROMPT);
        type(editor, '200');
        type(editor, '1600,1600');
        editor.startCommand('RECTANG');
        type(editor, '1500,1500');
        type(editor, 'a');
        expect(editor.snapshot.prompt).toBe('Länge der Rechtecke angeben <300.0000>:');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.prompt).toBe('Breite der Rechtecke angeben <200.0000>:');
        // Another width becomes the default in turn
        type(editor, '50');
        type(editor, '1600,1600');
        editor.startCommand('RECTANG');
        type(editor, '1500,1500');
        type(editor, 'a');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.prompt).toBe('Breite der Rechtecke angeben <50.0000>:');
        editor.keyDown({ key: 'Enter' });
        type(editor, '1600,1600');
        expect(polylines()).toEqual([
            rectangle(A, { x: 1800, y: 1700 }),
            rectangle(A, { x: 1800, y: 1550 }),
            rectangle(A, { x: 1800, y: 1550 }),
        ]);
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

    describe('modes', () => {
        const ROTATION_PROMPT = 'Drehwinkel angeben <0>:';
        const CHAMFER_FIRST_PROMPT = 'Ersten Fasenabstand für Rechtecke angeben <0.0000>:';
        const r = (n: number) => Math.round(n * 1000) / 1000 + 0;
        /** The points of the polyline drawn last, rounded. */
        const last = (polylines: () => { points: Point[]; closed: boolean }[]) =>
            polylines()
                .at(-1)!
                .points.map(({ x, y }) => ({ x: r(x), y: r(y) }));
        const from = (dx: number, dy: number) => ({ x: A.x + dx, y: A.y + dy });

        it('turns the sides with the option "Drehung", typed or towards a point, also with dimensions', () => {
            const { editor, polylines } = setup();
            editor.startCommand('RECTANG');
            type(editor, '1500,1500');
            type(editor, 'd');
            expect(editor.snapshot).toMatchObject({ prompt: ROTATION_PROMPT, from: A, preview: { kind: 'curve', rubberBand: true } });
            type(editor, '90');
            expect(editor.snapshot).toMatchObject({ prompt: OTHER_PROMPT, from: A });
            const { preview } = editor.snapshot;
            if (typeof preview !== 'object' || preview?.kind !== 'curve') {
                throw new Error('no curve preview');
            }
            expect(preview.curveAt(from(-200, 300))).toMatchObject({ kind: 'polygon' });
            type(editor, '1300,1800');
            // The first side runs upwards now
            expect(last(polylines)).toEqual([A, from(0, 300), from(-200, 300), from(-200, 0)]);
            // Towards a point, and with length and width along the turned sides
            editor.startCommand('RECTANG');
            type(editor, '1500,1500');
            type(editor, 'Drehung');
            expect(editor.snapshot.prompt).toBe('Drehwinkel angeben <90>:');
            type(editor, '@100,100');
            type(editor, 'a');
            type(editor, '200');
            type(editor, '100');
            type(editor, '1500,1900');
            const d = Math.SQRT1_2;
            expect(last(polylines)).toEqual(
                [from(0, 0), from(200 * d, 200 * d), from(100 * d, 300 * d), from(-100 * d, 100 * d)].map(({ x, y }) => ({ x: r(x), y: r(y) })),
            );
            expect(polylines().every((polyline) => polyline.closed)).toBe(true);
        });

        it('keeps the rotation for the following rectangles, names it at the start, and Enter keeps it', () => {
            const { editor, polylines } = setup();
            editor.startCommand('RECTANG');
            expect(editor.snapshot.message).toBeNull();
            type(editor, '1500,1500');
            type(editor, 'd');
            type(editor, '90');
            editor.keyDown({ key: 'Escape' });
            editor.startCommand('RECTANG');
            expect(editor.snapshot).toMatchObject({ prompt: FIRST_PROMPT, message: 'Aktuelle Rechteckmodi: Drehung=90' });
            type(editor, '1500,1500');
            type(editor, 'd');
            editor.keyDown({ key: 'Enter' });
            type(editor, '1300,1800');
            expect(last(polylines)).toEqual([A, from(0, 300), from(-200, 300), from(-200, 0)]);
            // Back to 0, and the corners are exactly those given again
            editor.startCommand('RECTANG');
            type(editor, '1500,1500');
            type(editor, 'd');
            type(editor, 'x');
            expect(editor.snapshot.message).toBe('Erfordert gültigen numerischen Winkel oder zweiten Punkt.');
            type(editor, '0');
            type(editor, '1800,1700');
            expect(polylines().at(-1)).toEqual(rectangle(A, { x: 1800, y: 1700 }));
            editor.startCommand('RECTANG');
            expect(editor.snapshot.message).toBeNull();
        });

        it('cuts the corners with the option "Fasen": two distances, the second like the first by default', () => {
            const { editor, polylines } = setup();
            editor.startCommand('RECTANG');
            type(editor, 'f');
            expect(editor.snapshot).toMatchObject({ prompt: CHAMFER_FIRST_PROMPT, from: null, preview: null });
            type(editor, '-1');
            expect(editor.snapshot).toMatchObject({ prompt: CHAMFER_FIRST_PROMPT, message: 'Wert darf nicht negativ sein.' });
            type(editor, '50');
            expect(editor.snapshot.prompt).toBe('Zweiten Fasenabstand für Rechtecke angeben <50.0000>:');
            editor.keyDown({ key: 'Enter' });
            expect(editor.snapshot).toMatchObject({ command: 'RECTANG', prompt: FIRST_PROMPT });
            type(editor, '1500,1500');
            type(editor, '1800,1700');
            expect(last(polylines)).toEqual([
                from(0, 50),
                from(50, 0),
                from(250, 0),
                from(300, 50),
                from(300, 150),
                from(250, 200),
                from(50, 200),
                from(0, 150),
            ]);
            expect(polylines().at(-1)!.closed).toBe(true);
        });

        it('takes a chamfer distance from two points, keeps it for the following rectangles and leaves it out where it does not fit', () => {
            const { editor, polylines } = setup();
            editor.startCommand('RECTANG');
            type(editor, 'Fasen');
            type(editor, '1500,1500');
            expect(editor.snapshot).toMatchObject({ prompt: 'Zweiten Punkt angeben:', from: A });
            // No default between the two points
            type(editor, '');
            expect(editor.snapshot.prompt).toBe('Zweiten Punkt angeben:');
            type(editor, '1500,1530');
            expect(editor.snapshot.prompt).toBe('Zweiten Fasenabstand für Rechtecke angeben <30.0000>:');
            type(editor, '20');
            editor.keyDown({ key: 'Escape' });
            editor.startCommand('RECTANG');
            expect(editor.snapshot.message).toBe('Aktuelle Rechteckmodi: Fasen=30.0000 x 20.0000');
            type(editor, '1500,1500');
            type(editor, '1800,1700');
            // The first distance lies on the side that arrives at a corner, the second on the one that leaves
            expect(last(polylines).slice(0, 4)).toEqual([from(0, 30), from(20, 0), from(270, 0), from(300, 20)]);
            // Too small for the chamfer: a plain rectangle
            editor.startCommand('RECTANG');
            type(editor, '1500,1500');
            type(editor, '1540,1540');
            expect(polylines().at(-1)).toEqual(rectangle(A, { x: 1540, y: 1540 }));
            // With a rotation both are named, and 0 switches the chamfer off
            editor.startCommand('RECTANG');
            type(editor, '1500,1500');
            type(editor, 'd');
            type(editor, '90');
            type(editor, '1300,1800');
            expect(last(polylines)).toHaveLength(8);
            editor.startCommand('RECTANG');
            expect(editor.snapshot.message).toBe('Aktuelle Rechteckmodi: Fasen=30.0000 x 20.0000  Drehung=90');
            type(editor, 'f');
            expect(editor.snapshot.prompt).toBe('Ersten Fasenabstand für Rechtecke angeben <30.0000>:');
            type(editor, '0');
            editor.keyDown({ key: 'Enter' });
            editor.keyDown({ key: 'Escape' });
            editor.startCommand('RECTANG');
            expect(editor.snapshot.message).toBe('Aktuelle Rechteckmodi: Drehung=90');
        });
    });
});
