import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import type { EllipseElement } from '../../model/CadElement';
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

const AXIS_START_PROMPT = 'Achsenendpunkt der Ellipse angeben oder [Mittelpunkt]:';
const OTHER_END_PROMPT = 'Anderen Endpunkt der Achse angeben:';
const OTHER_AXIS_PROMPT = 'Abstand zur anderen Achse angeben:';

/** Without Dynamic Input, so typed coordinates are absolute. */
const setup = (dynamicInput = false) => {
    const history = new DocumentHistory(parseDocument(samplePlan));
    const editor = new SelectionEditor(history);
    editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: dynamicInput });
    return { editor, history, ellipses: () => newEllipses(history.document) };
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
/** Ellipses that are not in the sample plan, rounded, the rotation in degrees. */
function newEllipses(doc: CadDocument) {
    return doc.elements
        .filter((element): element is EllipseElement => element.type === 'ellipse' && !sampleIdsSet.has(element.id))
        .map((ellipse) => {
            const { x, y } = doc.vertices.find((v) => v.id === ellipse.centerVertexId)!;
            return {
                center: { x: round(x), y: round(y) },
                radiusX: round(ellipse.radiusX),
                radiusY: round(ellipse.radiusY),
                rotation: round(((ellipse.rotation ?? 0) * 180) / Math.PI),
            };
        });
}

describe('EllipseTool (ELLIPSE)', () => {
    it('starts by name or alias and drops the pickfirst selection', () => {
        for (const name of ['EL', 'ellipse']) {
            const { editor } = setup();
            click(editor, { x: 3000, y: 0 });
            type(editor, name);
            expect(editor.snapshot).toMatchObject({ command: 'ELLIPSE', prompt: AXIS_START_PROMPT, cursor: 'point', grips: [] });
            expect(editor.snapshot.highlighted.size).toBe(0);
        }
    });

    it('takes both ends of the first axis, then the distance to the other one, as one undo step', () => {
        const { editor, ellipses, history } = setup();
        const before = history.document;
        editor.startCommand('ELLIPSE');
        click(editor, A);
        expect(editor.snapshot).toMatchObject({ prompt: OTHER_END_PROMPT, from: A, preview: { kind: 'curve', rubberBand: true } });
        // A first axis of no length is ignored
        click(editor, A);
        expect(editor.snapshot.prompt).toBe(OTHER_END_PROMPT);
        type(editor, '@600,600');
        const center = { x: 1800, y: 1800 };
        expect(editor.snapshot).toMatchObject({ prompt: OTHER_AXIS_PROMPT, from: center });
        const { preview } = editor.snapshot;
        if (typeof preview !== 'object' || preview?.kind !== 'curve') {
            throw new Error('no curve preview');
        }
        const curve = preview.curveAt({ x: 1700, y: 1800 });
        expect(curve).toMatchObject({ kind: 'ellipse', center, radiusY: 100 });
        expect(curve?.kind === 'ellipse' && round(curve.rotation)).toBe(round(Math.PI / 4));
        expect(history.document).toBe(before);
        type(editor, '200');
        expect(ellipses()).toEqual([{ center, radiusX: round(300 * Math.SQRT2), radiusY: 200, rotation: 45 }]);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:' });
        expect(editor.undo()).toBe(true);
        expect(ellipses()).toEqual([]);
        expect(editor.snapshot.message).toBe('Rückgängig: ELLIPSE');
    });

    it('keeps the first axis as radiusX, also when it is the minor one, with a rotation of 0', () => {
        const { editor, ellipses, history } = setup();
        editor.startCommand('ELLIPSE');
        type(editor, '1500,1500');
        type(editor, '1700,1500');
        type(editor, '@0,400');
        expect(ellipses()).toEqual([{ center: { x: 1600, y: 1500 }, radiusX: 100, radiusY: 400, rotation: 0 }]);
        expect(history.document.elements.at(-1)).toMatchObject({ rotation: 0 });
    });

    it('takes the centre and one end of the axis with the option "Mittelpunkt"', () => {
        const { editor, ellipses } = setup();
        editor.startCommand('ELLIPSE');
        type(editor, 'm');
        expect(editor.snapshot).toMatchObject({ prompt: 'Mittelpunkt der Ellipse angeben:', from: null });
        type(editor, '1500,1500');
        expect(editor.snapshot).toMatchObject({ prompt: 'Endpunkt der Achse angeben:', from: A });
        type(editor, '1500,2000');
        // A point given: its distance from the centre
        type(editor, '1800,1500');
        expect(ellipses()).toEqual([{ center: A, radiusX: 500, radiusY: 300, rotation: 90 }]);
    });

    it('takes only a positive distance to the other axis', () => {
        const { editor, ellipses } = setup();
        editor.startCommand('ELLIPSE');
        type(editor, '1500,1500');
        type(editor, '2500,1500');
        type(editor, '0');
        expect(editor.snapshot).toMatchObject({ prompt: OTHER_AXIS_PROMPT, message: 'Wert muss positiv und ungleich Null sein.' });
        type(editor, 'm');
        expect(editor.snapshot).toMatchObject({ prompt: OTHER_AXIS_PROMPT, message: 'Erfordert numerischen Abstand oder zweiten Punkt.' });
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        expect(ellipses()).toEqual([]);
    });

    it('measures the first axis from its first end with Dynamic Input, and the other axis in the distance field', () => {
        const { editor, ellipses } = setup(true);
        editor.startCommand('ELLIPSE');
        type(editor, '1500,1500');
        expect(editor.snapshot.dynamicInput).toMatchObject({ layout: 'dimension', format: 'polar', relative: true });
        type(editor, '1000<90');
        editor.pointerMove(at({ x: 1800, y: 2000 }));
        expect(editor.snapshot.dynamicInput).toMatchObject({ format: 'distance', fields: [{ kind: 'distance', text: '300.00' }] });
        type(editor, '250');
        expect(ellipses()).toEqual([{ center: { x: 1500, y: 2000 }, radiusX: 500, radiusY: 250, rotation: 90 }]);
    });
});
