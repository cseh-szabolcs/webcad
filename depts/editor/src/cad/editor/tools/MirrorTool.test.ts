import { describe, expect, it } from 'vitest';
import { DEFAULT_DYNAMIC_INPUT_SETTINGS } from '../../../settings/editorSettings';
import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs } from '../../model/CadElement';
import type { Id, Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import type { EditorPointerEvent } from '../EditorPointerEvent';
import { DocumentHistory } from '../commands/DocumentHistory';
import { SelectionEditor } from '../SelectionEditor';

const { element: E, group: G } = sampleIds;

/** One screen pixel is 2 mm (Y flipped), so the 5 px pick box reaches 10 mm. */
const at = (modelPoint: Point, change: Partial<EditorPointerEvent> = {}): EditorPointerEvent => ({
    viewPoint: { x: modelPoint.x / 2, y: -modelPoint.y / 2 },
    modelPoint,
    pixelSize: 2,
    button: 0,
    shiftKey: false,
    altKey: false,
    ...change,
});
/** On the sofa, a closed polyline over 600…2600 × 2600…3500. */
const SOFA = { x: 1600, y: 2600 };
/** On the door leaf, grouped with the arc of its swing around 1000,240. */
const DOOR = { x: 1000, y: 700 };
/** Away from every element. */
const EMPTY = { x: 3000, y: 2000 };

const SELECT = 'SPIEGELN Objekte wählen:';
const FIRST = 'Ersten Punkt der Spiegelachse angeben:';
const SECOND = 'Zweiten Punkt der Spiegelachse angeben:';
const ERASE = 'Quellobjekte löschen? [Ja/Nein] <N>:';
/** The sofa across the vertical line x = 3000. */
const MIRRORED_SOFA = [
    { x: 5400, y: 2600 },
    { x: 3400, y: 2600 },
    { x: 3400, y: 3500 },
    { x: 5400, y: 3500 },
];
const SOFA_CORNERS = MIRRORED_SOFA.map(({ x, y }) => ({ x: 6000 - x, y }));

/** Dynamic Input is off, so typed coordinates go to the command line. */
const setup = () => {
    const before = parseDocument(samplePlan);
    const history = new DocumentHistory(before);
    const editor = new SelectionEditor(history);
    editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: false });
    return { editor, history, before };
};
const click = (editor: SelectionEditor, point: Point, change: Partial<EditorPointerEvent> = {}) => {
    editor.pointerMove(at(point));
    editor.pointerDown(at(point, change));
    editor.pointerUp(at(point, change));
};
const enter = (editor: SelectionEditor) => editor.keyDown({ key: 'Enter' });
const type = (editor: SelectionEditor, text: string) => {
    for (const key of text) {
        editor.keyDown({ key });
    }
    enter(editor);
};
/** SPIEGELN on the element at `on`, with the vertical mirror line x = 3000 given: at the last prompt. */
const mirrored = (on: Point = SOFA) => {
    const context = setup();
    click(context.editor, on);
    type(context.editor, 'mi');
    type(context.editor, '3000,0');
    type(context.editor, '3000,1000');
    return context;
};
const points = (doc: CadDocument, id: Id): Point[] => {
    const element = doc.elements.find((candidate) => candidate.id === id)!;
    return vertexRefs(element).map((ref) => {
        const { x, y } = doc.vertices.find((vertex) => vertex.id === ref)!;
        return { x, y };
    });
};
const added = (before: CadDocument, after: CadDocument) =>
    after.elements.filter((element) => !before.elements.some((old) => old.id === element.id));

describe('MirrorTool', () => {
    it('asks for objects, the two points of the mirror line and whether the originals go', () => {
        const { editor, history, before } = setup();
        type(editor, 'spiegeln');
        expect(editor.snapshot).toMatchObject({ command: 'MIRROR', prompt: SELECT, cursor: 'select' });
        click(editor, SOFA);
        enter(editor);
        expect(editor.snapshot).toMatchObject({ prompt: FIRST, cursor: 'point', from: null });
        expect([...editor.snapshot.highlighted]).toEqual([E.sofa]);
        type(editor, '3000,0');
        expect(editor.snapshot).toMatchObject({ prompt: SECOND, from: { x: 3000, y: 0 }, previewKeeps: true });
        type(editor, '3000,1000');
        expect(editor.snapshot).toMatchObject({ command: 'MIRROR', prompt: ERASE });
        expect(history.document).toBe(before);
        enter(editor);
        expect(editor.snapshot.command).toBeNull();

        const [copy, ...more] = added(before, history.document);
        expect(more).toEqual([]);
        expect(points(history.document, copy.id)).toEqual(MIRRORED_SOFA);
        expect(points(history.document, E.sofa)).toEqual(SOFA_CORNERS);
        expect(copy).toMatchObject({ type: 'polyline', closed: true, layerId: before.elements.find((e) => e.id === E.sofa)!.layerId });
    });

    it('takes over the pickfirst selection', () => {
        const { editor } = setup();
        click(editor, SOFA);
        editor.startCommand('MIRROR');
        expect(editor.snapshot).toMatchObject({ prompt: FIRST, message: '1 gefunden' });
    });

    it('keeps the originals with "N" and with a right click', () => {
        for (const answer of [(editor: SelectionEditor) => type(editor, 'n'), (editor: SelectionEditor) => click(editor, EMPTY, { button: 2 })]) {
            const { editor, history, before } = mirrored();
            answer(editor);
            expect(editor.snapshot.command).toBeNull();
            expect(added(before, history.document)).toHaveLength(1);
            expect(points(history.document, E.sofa)).toEqual(SOFA_CORNERS);
        }
    });

    it('mirrors the originals themselves with "J"', () => {
        const { editor, history, before } = mirrored();
        type(editor, 'j');
        expect(editor.snapshot.command).toBeNull();
        expect(added(before, history.document)).toEqual([]);
        expect(points(history.document, E.sofa)).toEqual(MIRRORED_SOFA);
    });

    it('is one undo step named after the command', () => {
        const { editor, history, before } = mirrored();
        enter(editor);
        expect(editor.undo()).toBe(true);
        expect(editor.snapshot).toMatchObject({ message: 'Rückgängig: SPIEGELN', canUndo: false, canRedo: true });
        expect(history.document.elements).toEqual(before.elements);
        expect(history.document.vertices).toEqual(before.vertices);
        expect(editor.redo()).toBe(true);
        expect(added(before, history.document)).toHaveLength(1);
    });

    it('asks again for a second point on the first', () => {
        const { editor } = setup();
        click(editor, SOFA);
        editor.startCommand('MIRROR');
        type(editor, '3000,0');
        type(editor, '3000,0');
        expect(editor.snapshot).toMatchObject({
            prompt: SECOND,
            message: 'Die Punkte der Spiegelachse müssen verschieden sein.',
        });
    });

    it('previews the mirror images at the second point and keeps them at the last prompt', () => {
        const { editor } = setup();
        click(editor, SOFA);
        editor.startCommand('MIRROR');
        type(editor, '3000,0');
        editor.pointerMove(at(EMPTY));
        const { preview, previewPoint } = editor.snapshot;
        expect(previewPoint).toEqual(EMPTY);
        expect(preview).toMatchObject({ kind: 'transform' });
        const matrix = typeof preview === 'object' && preview?.kind === 'transform' ? preview.matrixAt(EMPTY) : null;
        expect(matrix).toEqual([-1, 0, 0, 1, 6000, 0]);

        click(editor, EMPTY);
        expect(editor.snapshot).toMatchObject({
            prompt: ERASE,
            preview,
            previewKeeps: true,
            from: { x: 3000, y: 0 },
            previewPoint: EMPTY,
            cursor: 'point',
            acceptsInput: true,
            snap: null,
        });
        // The cursor no longer moves the preview
        editor.pointerMove(at(SOFA));
        expect(editor.snapshot).toMatchObject({ previewPoint: EMPTY });
        expect([...editor.snapshot.hovered]).toEqual([]);
    });

    it('takes only an option at the last prompt', () => {
        const { editor, history, before } = mirrored();
        click(editor, EMPTY);
        expect(editor.snapshot).toMatchObject({ command: 'MIRROR', prompt: ERASE });
        for (const key of 'xy') {
            editor.keyDown({ key });
        }
        expect(editor.snapshot.input).toBe('xy');
        enter(editor);
        expect(editor.snapshot).toMatchObject({ prompt: ERASE, input: '', message: 'Ungültiges Optionsschlüsselwort.' });
        type(editor, '100,100');
        expect(editor.snapshot).toMatchObject({ prompt: ERASE, message: 'Ungültiges Optionsschlüsselwort.' });
        expect(history.document).toBe(before);
    });

    it('answers at the last prompt with Dynamic Input on, too', () => {
        const { editor, history, before } = mirrored();
        editor.setDynamicInputSettings(DEFAULT_DYNAMIC_INPUT_SETTINGS);
        expect(editor.snapshot.dynamicInput).toBeNull();
        type(editor, 'ja');
        expect(added(before, history.document)).toEqual([]);
        expect(points(history.document, E.sofa)).toEqual(MIRRORED_SOFA);
    });

    it('Esc cancels at every prompt and changes nothing', () => {
        const { editor, history, before } = mirrored();
        editor.keyDown({ key: 'j' });
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: 'MIRROR', input: '' });
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*', preview: null });
        expect(history.document).toBe(before);

        const second = setup();
        click(second.editor, SOFA);
        second.editor.startCommand('MIRROR');
        type(second.editor, '3000,0');
        second.editor.keyDown({ key: 'Escape' });
        expect(second.editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        expect(second.history.document).toBe(second.before);
    });

    it('copies a group into a group of its own and turns its arc the other way', () => {
        const { editor, history, before } = mirrored(DOOR);
        expect(new Set(editor.snapshot.highlighted)).toEqual(new Set([E['door-leaf'], E['door-swing']]));
        enter(editor);
        const copies = added(before, history.document);
        expect(copies.map((copy) => copy.type).sort()).toEqual(['arc', 'line']);
        const groups = new Set(copies.map((copy) => copy.groupId));
        expect(groups.size).toBe(1);
        expect(groups.has(G['door-d1'])).toBe(false);
        expect(history.document.groups).toHaveLength(before.groups.length + 1);
        expect(copies.find((copy) => copy.type === 'arc')).toMatchObject({ clockwise: true });
        // Hinge 1000,240, closed end 1900,240 and open end 1000,1140 across x = 3000
        const arc = copies.find((copy) => copy.type === 'arc')!;
        expect(points(history.document, arc.id)).toEqual(
            expect.arrayContaining([
                { x: 5000, y: 240 },
                { x: 4100, y: 240 },
                { x: 5000, y: 1140 },
            ]),
        );
    });

    it('the next Enter repeats the command', () => {
        const { editor } = mirrored();
        enter(editor);
        enter(editor);
        expect(editor.snapshot).toMatchObject({ command: 'MIRROR', prompt: SELECT });
    });
});
