import { describe, expect, it } from 'vitest';
import type { Point } from '../model/Point';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { DocumentHistory } from './commands/DocumentHistory';
import type { EditorPointerEvent } from './EditorPointerEvent';
import { SelectionEditor } from './SelectionEditor';

const { element: E, style: S } = sampleIds;

const at = (modelPoint: Point): EditorPointerEvent => ({
    viewPoint: { x: modelPoint.x / 2, y: -modelPoint.y / 2 },
    modelPoint,
    pixelSize: 2,
    button: 0,
    shiftKey: false,
    altKey: false,
});
/** On the sofa's outline, away from its corners; on the window, a line. */
const SOFA = { x: 1600, y: 2600 };
const WINDOW = { x: 4250, y: 3880 };

const setup = () => {
    const history = new DocumentHistory(parseDocument(samplePlan));
    return { editor: new SelectionEditor(history), history };
};
const pick = (editor: SelectionEditor, point: Point) => {
    editor.pointerMove(at(point));
    editor.pointerDown(at(point));
    editor.pointerUp(at(point));
};
const style = (history: DocumentHistory, id: string) => history.document.styles.find((candidate) => candidate.id === id)!;
const styleOf = (history: DocumentHistory, id: string) => history.document.elements.find((element) => element.id === id)!.styleId;

describe('SelectionEditor styles', () => {
    it('adds a style that sets nothing, with the next free name', () => {
        const { editor, history } = setup();
        const id = editor.addStyle(() => 'new-1')!;
        expect(style(history, id)).toEqual({ id: 'new-1', name: 'Stil1', color: null, linetype: null, lineweight: null, transparency: null, fillColor: null });
        expect(style(history, editor.addStyle()!).name).toBe('Stil2');
        editor.undo();
        editor.undo();
        expect(history.document.styles).toHaveLength(4);
    });

    it('changes a style as one undo step, tidied', () => {
        const { editor, history } = setup();
        expect(editor.updateStyle(S.wall, { name: ' Wand ', color: '#FF0000', linetype: 'dashed', lineweight: null, transparency: 95, fillColor: '#00FF00' })).toBe(true);
        expect(style(history, S.wall)).toEqual({ id: S.wall, name: 'Wand', color: '#ff0000', linetype: 'dashed', lineweight: null, transparency: 90, fillColor: '#00ff00' });
        expect(editor.undo()).toBe(true);
        expect(editor.snapshot.message).toBe('Rückgängig: STIL');
        expect(history.document).toEqual(parseDocument(samplePlan));
    });

    it('makes no step of what stays the same, and refuses a name another style has', () => {
        const { editor } = setup();
        expect(editor.updateStyle(S.wall, { name: 'Wall', color: '#1F2937', transparency: null })).toBe(true);
        expect(editor.snapshot.canUndo).toBe(false);
        expect(editor.updateStyle(S.wall, { name: 'thin' })).toBe(false);
        expect(editor.snapshot.message).toBe('Ein Stil mit diesem Namen ist bereits vorhanden.');
    });

    it('removes a style, also one that objects have', () => {
        const { editor, history } = setup();
        expect(editor.removeStyle(S.furniture)).toBe(true);
        expect(styleOf(history, E.sofa)).toBeNull();
        expect(editor.removeStyle('gone')).toBe(false);
        editor.undo();
        expect(styleOf(history, E.sofa)).toBe(S.furniture);
    });

    it('gives the selected objects a style, or none, and keeps them selected', () => {
        const { editor, history } = setup();
        pick(editor, SOFA);
        pick(editor, WINDOW);
        expect(editor.setSelectionStyle(S.wall)).toBe(true);
        expect([E.sofa, E.window].map((id) => styleOf(history, id))).toEqual([S.wall, S.wall]);
        expect(editor.snapshot.highlighted.size).toBe(2);
        expect(editor.setSelectionStyle(null)).toBe(true);
        expect([E.sofa, E.window].map((id) => styleOf(history, id))).toEqual([null, null]);
        // The same again is no step
        editor.setSelectionStyle(null);
        editor.undo();
        editor.undo();
        expect(history.document).toEqual(parseDocument(samplePlan));
        expect(editor.snapshot.canUndo).toBe(false);
    });

    it('changes no style without a selection, for an unknown style or while a command runs', () => {
        const { editor, history } = setup();
        const before = history.document;
        expect(editor.setSelectionStyle(S.wall)).toBe(false);
        pick(editor, SOFA);
        expect(editor.setSelectionStyle('gone')).toBe(false);
        editor.startCommand('MOVE');
        expect(editor.setSelectionStyle(S.wall)).toBe(false);
        expect(editor.addStyle()).toBeNull();
        expect(editor.updateStyle(S.wall, { color: '#ff0000' })).toBe(false);
        expect(editor.removeStyle(S.wall)).toBe(false);
        expect(history.document).toBe(before);
    });
});
