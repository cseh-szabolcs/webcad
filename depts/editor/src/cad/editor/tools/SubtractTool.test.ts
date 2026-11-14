import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../../i18n/i18n';
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
/** On the outer wall, a closed polyline around everything. */
const WALL = { x: 3000, y: 0 };
/** On the table, a circle inside the wall. */
const TABLE = { x: 4000 + 600 * Math.SQRT1_2, y: 1800 + 600 * Math.SQRT1_2 };
/** On the rug, an ellipse. */
const RUG = { x: 5000, y: 1800 };
/** On the window, a line. */
const WINDOW = { x: 4250, y: 3880 };

const FROM_PROMPT = 'DIFFERENZ Objekte wählen, von denen subtrahiert werden soll:';
const SUBTRACT_PROMPT = 'Objekte für Subtraktion wählen:';
const NOTHING = 'Keine geschlossenen Polylinien oder Kreise gewählt.';

const setup = () => {
    const history = new DocumentHistory(parseDocument(samplePlan));
    const before = history.document;
    return { editor: new SelectionEditor(history), history, before };
};
const click = (editor: SelectionEditor, point: Point) => {
    editor.pointerMove(at(point));
    editor.pointerDown(at(point));
    editor.pointerUp(at(point));
};
const enter = (editor: SelectionEditor) => editor.keyDown({ key: 'Enter' });
const type = (editor: SelectionEditor, text: string) => {
    for (const key of text) {
        editor.keyDown({ key });
    }
    enter(editor);
};
const ids = (set: ReadonlySet<string>) => [...set];

describe('SubtractTool', () => {
    it('asks for the objects to subtract from, then for those to subtract, and cuts', () => {
        const { editor, history, before } = setup();
        type(editor, 'su');
        expect(editor.snapshot).toMatchObject({ command: 'SUBTRACT', prompt: FROM_PROMPT, cursor: 'select' });
        click(editor, WALL);
        expect(editor.snapshot.message).toBe('1 gefunden, 1 gesamt');
        enter(editor);
        expect(editor.snapshot).toMatchObject({ command: 'SUBTRACT', prompt: SUBTRACT_PROMPT, message: null, cursor: 'select' });
        // What is cut from stays shown as selected
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
        click(editor, TABLE);
        expect(editor.snapshot.message).toBe('1 gefunden, 1 gesamt');
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer'], E.table]);
        enter(editor);

        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', message: null, canUndo: true });
        expect(editor.snapshot.highlighted.size).toBe(0);
        const { elements, groups } = history.document;
        expect(elements.some((element) => element.id === E['wall-outer'] || element.id === E.table)).toBe(false);
        // The wall with the table as a hole in it, picked together
        const [outline, hole] = elements.slice(0, 2);
        expect(outline).toMatchObject({ type: 'polyline', name: 'Wall outer', closed: true });
        expect(hole).toMatchObject({ type: 'circle', radius: 600, groupId: outline.groupId });
        expect(groups.at(-1)).toEqual({ id: outline.groupId, name: 'DIFFERENZ' });
        click(editor, WALL);
        expect(ids(editor.snapshot.highlighted)).toEqual([outline.id, hole.id]);
        editor.keyDown({ key: 'Escape' });

        expect(editor.undo()).toBe(true);
        expect(editor.snapshot.message).toBe('Rückgängig: DIFFERENZ');
        expect(history.document).toEqual(before);
        expect(editor.redo()).toBe(true);
        expect(history.document.elements.slice(0, 2)).toEqual([outline, hole]);
    });

    it('takes the pickfirst selection as the objects to subtract from', () => {
        const { editor } = setup();
        click(editor, WALL);
        editor.startCommand('SUBTRACT');
        expect(editor.snapshot).toMatchObject({ prompt: SUBTRACT_PROMPT, message: '1 gefunden', cursor: 'select' });
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
        expect(editor.snapshot.grips).toEqual([]);
    });

    it('passes over objects that bound no area, with a message', () => {
        const { editor, history } = setup();
        click(editor, WALL);
        click(editor, WINDOW);
        editor.startCommand('SUBTRACT');
        expect(editor.snapshot).toMatchObject({
            prompt: SUBTRACT_PROMPT,
            message: '1 übergangen (weder geschlossene Polylinie noch Kreis)',
        });
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
        click(editor, TABLE);
        click(editor, RUG);
        enter(editor);
        expect(editor.snapshot).toMatchObject({ command: null, message: '1 übergangen (weder geschlossene Polylinie noch Kreis)' });
        const kept = history.document.elements.map((element) => element.id);
        expect(kept).toContain(E.window);
        expect(kept).toContain(E.rug);
        expect(kept).not.toContain(E.table);
    });

    it('ends without a change when a selection holds nothing to work on', () => {
        const { editor, history, before } = setup();
        editor.startCommand('SUBTRACT');
        click(editor, WINDOW);
        enter(editor);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', message: NOTHING });

        editor.startCommand('SUBTRACT');
        click(editor, WALL);
        enter(editor);
        click(editor, RUG);
        // Also selected to subtract from: not subtracted from itself
        click(editor, WALL);
        enter(editor);
        expect(editor.snapshot).toMatchObject({ command: null, message: NOTHING });

        // Nothing selected at all, like every object selection
        editor.startCommand('SUBTRACT');
        click(editor, WALL);
        enter(editor);
        enter(editor);
        expect(editor.snapshot).toMatchObject({ command: null, message: null, canUndo: false });
        expect(history.document).toBe(before);
    });

    it('cancels with Escape, and Enter starts it again', () => {
        const { editor, history, before } = setup();
        editor.startCommand('SUBTRACT');
        click(editor, WALL);
        enter(editor);
        click(editor, TABLE);
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        expect(editor.snapshot.highlighted.size).toBe(0);
        expect(history.document).toBe(before);
        enter(editor);
        expect(editor.snapshot).toMatchObject({ command: 'SUBTRACT', prompt: FROM_PROMPT });
    });
});

describe('SubtractTool in English', () => {
    afterEach(async () => {
        await i18n.changeLanguage('de');
    });

    it('goes by the English name and prompts', async () => {
        await i18n.changeLanguage('en');
        const { editor, history } = setup();
        type(editor, 'subtract');
        expect(editor.snapshot.prompt).toBe('SUBTRACT Select objects to subtract from:');
        click(editor, WALL);
        click(editor, WINDOW);
        enter(editor);
        expect(editor.snapshot).toMatchObject({
            prompt: 'Select objects to subtract:',
            message: '1 skipped (neither a closed polyline nor a circle)',
        });
        click(editor, TABLE);
        enter(editor);
        expect(history.document.groups.at(-1)?.name).toBe('SUBTRACT');
    });
});
