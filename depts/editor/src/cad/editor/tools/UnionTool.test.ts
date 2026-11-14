import { afterEach, describe, expect, it } from 'vitest';
import { i18n } from '../../../i18n/i18n';
import type { Point } from '../../model/Point';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import type { EditorPointerEvent } from '../EditorPointerEvent';
import { AddCircleCommand } from '../commands/AddCircleCommand';
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
/** On the sofa, a closed polyline over 600…2600 × 2600…3500. */
const SOFA = { x: 1600, y: 2600 };
/** On the circle `setup` adds: half over the right edge of the sofa. */
const CIRCLE = { x: 2800, y: 3050 };
/** On the table, a circle away from the sofa. */
const TABLE = { x: 4000 + 600 * Math.SQRT1_2, y: 1800 + 600 * Math.SQRT1_2 };
/** On the window, a line. */
const WINDOW = { x: 4250, y: 3880 };

const PROMPT = 'VEREINIG Objekte wählen:';
const TOO_FEW = 'Mindestens 2 geschlossene Polylinien oder Kreise müssen gewählt sein.';

/** The sample plan with a circle on the right edge of the sofa. */
const setup = () => {
    const circle = new AddCircleCommand(sampleIds.layer['0'], { x: 2600, y: 3050 }, 200);
    const before = circle.execute(parseDocument(samplePlan)).document;
    const history = new DocumentHistory(before);
    return { editor: new SelectionEditor(history), history, before, circle: circle.circleId };
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

describe('UnionTool', () => {
    it('asks for objects and joins them into one outline', () => {
        const { editor, history, before, circle } = setup();
        type(editor, 'uni');
        expect(editor.snapshot).toMatchObject({ command: 'UNION', prompt: PROMPT, cursor: 'select' });
        click(editor, SOFA);
        click(editor, CIRCLE);
        expect(editor.snapshot.message).toBe('1 gefunden, 2 gesamt');
        enter(editor);

        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', message: null, canUndo: true });
        const { elements, groups } = history.document;
        expect(elements).toHaveLength(before.elements.length - 1);
        expect(elements.some((element) => element.id === E.sofa || element.id === circle)).toBe(false);
        // In the place of the sofa, with half the circle on its edge
        const joined = elements[before.elements.findIndex((element) => element.id === E.sofa)];
        expect(joined).toMatchObject({ type: 'polyline', name: 'Sofa', closed: true, groupId: null });
        expect(joined.type === 'polyline' && joined.bulges.map((bulge) => Math.round(bulge * 1e9) / 1e9)).toEqual([0, 0, 1, 0, 0, 0]);
        expect(groups).toEqual(before.groups);

        expect(editor.undo()).toBe(true);
        expect(editor.snapshot.message).toBe('Rückgängig: VEREINIG');
        expect(history.document).toEqual(before);
    });

    it('joins the pickfirst selection at once', () => {
        const { editor, history, before } = setup();
        click(editor, SOFA);
        click(editor, CIRCLE);
        editor.startCommand('UNION');
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', message: null, canUndo: true });
        expect(editor.snapshot.highlighted.size).toBe(0);
        expect(history.document.elements).toHaveLength(before.elements.length - 1);
    });

    it('groups objects that do not touch, and passes over those without an area', () => {
        const { editor, history, before } = setup();
        editor.startCommand('UNION');
        click(editor, SOFA);
        click(editor, WINDOW);
        click(editor, TABLE);
        enter(editor);
        expect(editor.snapshot).toMatchObject({ command: null, message: '1 übergangen (weder geschlossene Polylinie noch Kreis)' });
        const { elements, groups } = history.document;
        expect(elements).toHaveLength(before.elements.length);
        expect(elements.find((element) => element.id === E.window)).toBe(before.elements.find((element) => element.id === E.window));
        const group = groups.at(-1)!;
        expect(group.name).toBe('VEREINIG');
        // Both take after the sofa, selected first
        expect(elements.filter((element) => element.groupId === group.id)).toMatchObject([
            { type: 'polyline', name: 'Sofa' },
            { type: 'circle', name: null, radius: 600 },
        ]);
        click(editor, TABLE);
        expect(editor.snapshot.highlighted.size).toBe(2);
    });

    it('needs two objects with an area', () => {
        const { editor, history, before } = setup();
        editor.startCommand('UNION');
        click(editor, SOFA);
        click(editor, WINDOW);
        enter(editor);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', message: TOO_FEW, canUndo: false });
        // Also with the pickfirst selection
        click(editor, TABLE);
        editor.startCommand('UNION');
        expect(editor.snapshot).toMatchObject({ command: null, message: TOO_FEW });
        // Nothing selected, like every object selection
        editor.keyDown({ key: 'Escape' });
        editor.startCommand('UNION');
        enter(editor);
        expect(editor.snapshot).toMatchObject({ command: null, message: null });
        expect(history.document).toBe(before);
    });
});

describe('UnionTool in English', () => {
    afterEach(async () => {
        await i18n.changeLanguage('de');
    });

    it('goes by the English name and texts', async () => {
        await i18n.changeLanguage('en');
        const { editor, history } = setup();
        type(editor, 'union');
        expect(editor.snapshot.prompt).toBe('UNION Select objects:');
        click(editor, SOFA);
        enter(editor);
        expect(editor.snapshot.message).toBe('At least 2 closed polylines or circles must be selected.');
        editor.startCommand('UNION');
        click(editor, SOFA);
        click(editor, TABLE);
        enter(editor);
        expect(history.document.groups.at(-1)?.name).toBe('UNION');
    });
});
