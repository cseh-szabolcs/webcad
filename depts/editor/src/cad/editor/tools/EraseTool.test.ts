import { describe, expect, it } from 'vitest';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import type { EditorPointerEvent } from '../EditorPointerEvent';
import { DocumentHistory } from '../commands/DocumentHistory';
import { SelectionEditor } from '../SelectionEditor';

const { element: E } = sampleIds;

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
/** On the sofa, a closed polyline. */
const SOFA = { x: 1600, y: 2600 };
/** On the window, a line. */
const WINDOW = { x: 4250, y: 3880 };
/** On the door leaf, grouped with its swing. */
const DOOR = { x: 1000, y: 700 };

const PROMPT = 'LÖSCHEN Objekte wählen:';

const setup = () => {
    const before = parseDocument(samplePlan);
    const history = new DocumentHistory(before);
    return { editor: new SelectionEditor(history), history, before };
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
const has = (history: DocumentHistory, id: string) => history.document.elements.some((element) => element.id === id);

describe('EraseTool', () => {
    it('asks for objects and erases them when the selection ends', () => {
        const { editor, history } = setup();
        type(editor, 'löschen');
        expect(editor.snapshot).toMatchObject({ command: 'ERASE', prompt: PROMPT, cursor: 'select' });
        click(editor, SOFA);
        click(editor, WINDOW);
        expect(has(history, E.sofa)).toBe(true);
        enter(editor);
        expect(editor.snapshot.command).toBeNull();
        expect(has(history, E.sofa)).toBe(false);
        expect(has(history, E.window)).toBe(false);
        expect([...editor.snapshot.highlighted]).toEqual([]);
    });

    it('erases the pickfirst selection at once', () => {
        const { editor, history } = setup();
        click(editor, SOFA);
        editor.startCommand('ERASE');
        expect(editor.snapshot).toMatchObject({ command: null, message: '1 gefunden' });
        expect(has(history, E.sofa)).toBe(false);
        expect(editor.snapshot.grips).toEqual([]);
    });

    it('takes the aliases E and LÖ', () => {
        for (const alias of ['e', 'lö', 'erase']) {
            const { editor } = setup();
            type(editor, alias);
            expect(editor.snapshot).toMatchObject({ command: 'ERASE', prompt: PROMPT });
        }
    });

    it('ends without a selection and with Esc, changing nothing', () => {
        const { editor, history, before } = setup();
        editor.startCommand('ERASE');
        enter(editor);
        expect(editor.snapshot.command).toBeNull();
        editor.startCommand('ERASE');
        click(editor, SOFA);
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        expect(history.document).toBe(before);
    });

    it('is one undo step named after the command', () => {
        const { editor, history, before } = setup();
        click(editor, DOOR);
        editor.startCommand('ERASE');
        expect(has(history, E['door-leaf']) || has(history, E['door-swing'])).toBe(false);
        expect(editor.undo()).toBe(true);
        expect(editor.snapshot).toMatchObject({ message: 'Rückgängig: LÖSCHEN', canUndo: false, canRedo: true });
        expect(history.document).toEqual(before);
        expect(editor.redo()).toBe(true);
        expect(has(history, E['door-leaf'])).toBe(false);
    });

    it('Entf and the Rücktaste erase the selection', () => {
        for (const key of ['Delete', 'Backspace']) {
            const { editor, history } = setup();
            click(editor, SOFA);
            expect(editor.keyDown({ key })).toBe(true);
            expect(has(history, E.sofa)).toBe(false);
            expect(editor.snapshot.command).toBeNull();
        }
    });

    it('the Rücktaste edits typed text first, and neither key does anything without a selection', () => {
        const { editor, history, before } = setup();
        click(editor, SOFA);
        editor.keyDown({ key: 'm' });
        expect(editor.keyDown({ key: 'Backspace' })).toBe(true);
        expect(editor.snapshot.input).toBe('');
        expect(has(history, E.sofa)).toBe(true);

        const empty = setup();
        expect(empty.editor.keyDown({ key: 'Delete' })).toBe(false);
        expect(empty.editor.keyDown({ key: 'Backspace' })).toBe(false);
        expect(empty.history.document).toBe(empty.before);
        expect(history.document).toBe(before);
    });

    it('leaves alone what somebody else has selected', () => {
        const { editor, history } = setup();
        editor.setSelectedByOthers(new Set([E.sofa]));
        editor.startCommand('ERASE');
        click(editor, SOFA);
        click(editor, WINDOW);
        enter(editor);
        expect(has(history, E.sofa)).toBe(true);
        expect(has(history, E.window)).toBe(false);
    });
});
