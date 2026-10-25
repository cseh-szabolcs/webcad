import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CadDocument } from '../model/CadDocument';
import type { Point } from '../model/Point';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import type { EditorPointerEvent } from './EditorPointerEvent';
import { DocumentHistory } from './commands/DocumentHistory';
import { DEFAULT_DYNAMIC_INPUT_SETTINGS, DEFAULT_EDITOR_SETTINGS } from '../../settings/editorSettings';
import { SelectionEditor } from './SelectionEditor';
import { i18n } from '../../i18n/i18n';

const { element: E, vertex: V } = sampleIds;

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
const WALL = { x: 3000, y: 0 };
const TABLE = { x: 4600, y: 1800 };
const EMPTY = { x: 3000, y: 2000 };

const BASE_POINT_PROMPT = 'Basispunkt angeben oder [Verschiebung] <Verschiebung>:';

const create = () => new SelectionEditor(parseDocument(samplePlan));
/** Press and release at the same point. */
const click = (editor: SelectionEditor, point: Point, change: Partial<EditorPointerEvent> = {}) => {
    editor.pointerDown(at(point, change));
    editor.pointerUp(at(point, change));
};
/**
 * Selection rectangle: press at `from`, drag to `to`, release, then click at `to` to end it.
 * `change` (e.g. Shift) applies to the ending click.
 */
const rectangle = (editor: SelectionEditor, from: Point, to: Point, change: Partial<EditorPointerEvent> = {}) => {
    editor.pointerDown(at(from));
    editor.pointerMove(at(to));
    editor.pointerUp(at(to));
    click(editor, to, change);
};
/** Press at the first point, drag through the others and release at the last one. */
const drag = (editor: SelectionEditor, points: Point[], change: Partial<EditorPointerEvent> = {}) => {
    editor.pointerDown(at(points[0], change));
    for (const point of points.slice(1)) {
        editor.pointerMove(at(point, change));
    }
    editor.pointerUp(at(points[points.length - 1], change));
};
const ids = (set: ReadonlySet<string>) => [...set];
const tableCentre = (history: DocumentHistory) => {
    const { x, y } = history.document.vertices.find((v) => v.id === V['t-center'])!;
    return { x, y };
};

describe('SelectionEditor hover', () => {
    it('hovers the element under the cursor within the pick box', () => {
        const editor = create();
        editor.pointerMove(at({ x: 3000, y: 8 }));
        expect(ids(editor.snapshot.hovered)).toEqual([E['wall-outer']]);
        editor.pointerMove(at({ x: 3000, y: 12 }));
        expect(editor.snapshot.hovered.size).toBe(0);
    });

    it('notifies only when the hovered element changes', () => {
        const editor = create();
        const listener = vi.fn();
        editor.subscribe(listener);
        editor.pointerMove(at(WALL));
        editor.pointerMove(at({ x: 3100, y: 0 }));
        expect(listener).toHaveBeenCalledTimes(1);
        editor.pointerLeave();
        expect(listener).toHaveBeenCalledTimes(2);
        expect(editor.snapshot.hovered.size).toBe(0);
    });

    it('stops notifying after unsubscribe', () => {
        const editor = create();
        const listener = vi.fn();
        editor.subscribe(listener)();
        editor.pointerMove(at(WALL));
        expect(listener).not.toHaveBeenCalled();
    });

    it('does not hover an element that is already selected', () => {
        const editor = create();
        editor.pointerMove(at(WALL));
        click(editor, WALL);
        expect(editor.snapshot.hovered.size).toBe(0);
        click(editor, WALL, { shiftKey: true });
        expect(ids(editor.snapshot.hovered)).toEqual([E['wall-outer']]);
    });
});

describe('SelectionEditor pickfirst selection', () => {
    it('adds clicked elements to the selection', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, TABLE);
        click(editor, WALL);
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer'], E.table]);
    });

    it('removes an element with Shift+click and ignores Shift+click on unselected ones', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, TABLE);
        click(editor, WALL, { shiftKey: true });
        click(editor, { x: 1600, y: 2600 }, { shiftKey: true });
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
    });

    it('keeps the selection on a click into empty space and on other buttons', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, EMPTY);
        click(editor, TABLE, { button: 2 });
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
    });

    it('clears the selection with Escape', () => {
        const editor = create();
        click(editor, TABLE);
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot.highlighted.size).toBe(0);
        expect(editor.snapshot.grips).toEqual([]);
        expect(editor.keyDown({ key: 'Escape' })).toBe(false);
    });

    it('shows the grips of the selected elements', () => {
        const editor = create();
        click(editor, TABLE);
        expect(editor.snapshot.grips).toHaveLength(5);
        click(editor, WALL);
        expect(editor.snapshot.grips).toHaveLength(5 + 8);
        click(editor, TABLE, { shiftKey: true });
        expect(editor.snapshot.grips).toHaveLength(8);
    });
});

describe('SelectionEditor control frame', () => {
    /** On the curtain bezier: B(0.5) of its control points. */
    const CURTAIN = { x: 4250, y: 3550 };

    it('shows the control frame of a selected bezier with its grips', () => {
        const editor = create();
        click(editor, CURTAIN);
        expect(ids(editor.snapshot.highlighted)).toEqual([E.curtain]);
        expect(editor.snapshot.grips).toHaveLength(4);
        expect(editor.snapshot.controlFrames).toHaveLength(2);
    });

    it('has no frame for elements without control points', () => {
        const editor = create();
        click(editor, TABLE);
        expect(editor.snapshot.controlFrames).toEqual([]);
    });

    it('hides the frame with the grips while SCHIEBEN runs and after Escape', () => {
        const editor = create();
        click(editor, CURTAIN);
        editor.startMoveCommand();
        expect(editor.snapshot.controlFrames).toEqual([]);
        editor.keyDown({ key: 'Escape' });
        click(editor, CURTAIN);
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot.controlFrames).toEqual([]);
    });
});

describe('SelectionEditor SCHIEBEN: object selection (verb-noun)', () => {
    it('shows the prompts of the command line', () => {
        const editor = create();
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', message: null, cursor: 'command' });
        editor.startMoveCommand();
        expect(editor.snapshot).toMatchObject({
            command: 'MOVE',
            prompt: 'SCHIEBEN Objekte wählen:',
            message: null,
            cursor: 'select',
        });
    });

    it('adds and removes elements with messages, without grips', () => {
        const editor = create();
        editor.startMoveCommand();
        click(editor, WALL);
        expect(editor.snapshot.message).toBe('1 gefunden, 1 gesamt');
        click(editor, TABLE);
        expect(editor.snapshot.message).toBe('1 gefunden, 2 gesamt');
        click(editor, TABLE);
        expect(editor.snapshot.message).toBe('1 gefunden (1 doppelt), 2 gesamt');
        click(editor, WALL, { shiftKey: true });
        expect(editor.snapshot.message).toBe('1 gefunden, 1 entfernt, 1 gesamt');
        click(editor, WALL, { shiftKey: true });
        expect(editor.snapshot.message).toBe('1 gefunden, 0 entfernt, 1 gesamt');
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
        expect(editor.snapshot.grips).toEqual([]);
    });

    it('takes over the pickfirst selection and asks for the base point right away', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, TABLE);
        editor.startMoveCommand();
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer'], E.table]);
        expect(editor.snapshot.grips).toEqual([]);
        expect(editor.snapshot).toMatchObject({ prompt: BASE_POINT_PROMPT, message: '2 gefunden', cursor: 'point' });
        expect(ids(editor.previous)).toEqual([E['wall-outer'], E.table]);
    });

    it('goes on to the base point with Enter; the selection becomes the previous one', () => {
        const editor = create();
        editor.startMoveCommand();
        click(editor, TABLE);
        expect(editor.keyDown({ key: 'Enter' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: 'MOVE', prompt: BASE_POINT_PROMPT, message: null });
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
        expect(ids(editor.previous)).toEqual([E.table]);
    });

    it('goes on with a right click like Enter', () => {
        const editor = create();
        editor.startMoveCommand();
        click(editor, WALL);
        click(editor, EMPTY, { button: 2 });
        expect(editor.snapshot.prompt).toBe(BASE_POINT_PROMPT);
    });

    it('ends the command when the selection is ended empty', () => {
        const editor = create();
        editor.startMoveCommand();
        expect(editor.keyDown({ key: 'Enter' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', message: null });
        editor.startMoveCommand();
        click(editor, EMPTY, { button: 2 });
        expect(editor.snapshot.command).toBeNull();
    });

    it('cancels with Escape and keeps the previous selection', () => {
        const editor = create();
        editor.startMoveCommand();
        click(editor, WALL);
        editor.keyDown({ key: 'Enter' });
        editor.keyDown({ key: 'Escape' });
        editor.startMoveCommand();
        click(editor, TABLE);
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*', cursor: 'command' });
        expect(editor.snapshot.highlighted.size).toBe(0);
        expect(ids(editor.previous)).toEqual([E['wall-outer']]);
    });

    it('ignores a second start while the command runs', () => {
        const editor = create();
        editor.startMoveCommand();
        click(editor, WALL);
        editor.startMoveCommand();
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
        expect(editor.snapshot.prompt).toBe('SCHIEBEN Objekte wählen:');
    });

    it('does not treat a right click without a command as anything', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, EMPTY, { button: 2 });
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
        expect(editor.keyDown({ key: 'Enter' })).toBe(false);
    });
});

describe('SelectionEditor SCHIEBEN: base point and second point', () => {
    /** 8 mm (4 px) right of and 6 mm above the outer wall's corner (6000, 0). */
    const NEAR_CORNER = { x: 6008, y: 6 };
    const CORNER = { x: 6000, y: 0 };

    /** SCHIEBEN on the table, at the base point prompt. */
    const atBasePoint = () => {
        const editor = create();
        click(editor, TABLE);
        editor.startMoveCommand();
        return editor;
    };

    it('shows the snap point under the cursor, no rollover and no grips', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(NEAR_CORNER));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'END', point: CORNER });
        editor.pointerMove(at(WALL));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'MID', point: WALL });
        expect(editor.snapshot.hovered.size).toBe(0);
        editor.pointerMove(at(EMPTY));
        expect(editor.snapshot.snap).toBeNull();
        editor.pointerMove(at(NEAR_CORNER));
        editor.pointerLeave();
        expect(editor.snapshot.snap).toBeNull();
    });

    it('notifies only when the snap point changes', () => {
        const editor = atBasePoint();
        const listener = vi.fn();
        editor.subscribe(listener);
        editor.pointerMove(at(NEAR_CORNER));
        editor.pointerMove(at({ x: 6006, y: 4 }));
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('takes the snap point on a click and asks for the second point', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(NEAR_CORNER));
        click(editor, NEAR_CORNER);
        expect(editor.snapshot).toMatchObject({
            command: 'MOVE',
            prompt: 'Zweiten Punkt angeben oder <ersten Punkt als Verschiebung verwenden>:',
            basePoint: CORNER,
            cursor: 'point',
        });
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
        // Still snapping at the same position
        expect(editor.snapshot.snap).toMatchObject({ mode: 'END' });
    });

    it('takes the cursor position where nothing snaps', () => {
        const editor = atBasePoint();
        click(editor, EMPTY);
        expect(editor.snapshot.basePoint).toEqual(EMPTY);
    });

    it('moves the selection at the second point as one undo step and ends', () => {
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        click(editor, TABLE);
        editor.startMoveCommand();
        click(editor, NEAR_CORNER);
        editor.pointerMove(at(WALL));
        click(editor, WALL);
        expect(editor.snapshot).toMatchObject({
            command: null,
            prompt: 'Befehl:',
            message: null,
            basePoint: null,
            snap: null,
            cursor: 'command',
            canUndo: true,
            canRedo: false,
        });
        expect(editor.snapshot.highlighted.size).toBe(0);
        expect(ids(editor.previous)).toEqual([E.table]);
        // From the corner (6000, 0) to the wall midpoint (3000, 0)
        expect(tableCentre(history)).toEqual({ x: 1000, y: 1800 });
        // Picking and snapping follow the moved geometry
        editor.pointerMove(at({ x: 1600, y: 1800 }));
        expect(ids(editor.snapshot.hovered)).toEqual([E.table]);
        editor.pointerMove(at(TABLE));
        expect(editor.snapshot.hovered.size).toBe(0);
    });

    it('undoes and redoes the move with messages', () => {
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        click(editor, TABLE);
        editor.startMoveCommand();
        click(editor, NEAR_CORNER);
        click(editor, WALL);
        expect(editor.undo()).toBe(true);
        expect(editor.snapshot).toMatchObject({ message: 'Rückgängig: SCHIEBEN', canUndo: false, canRedo: true });
        expect(tableCentre(history)).toEqual({ x: 4000, y: 1800 });
        expect(editor.undo()).toBe(false);
        expect(editor.redo()).toBe(true);
        expect(editor.snapshot).toMatchObject({ message: 'Wiederherstellen: SCHIEBEN', canUndo: true, canRedo: false });
        expect(tableCentre(history)).toEqual({ x: 1000, y: 1800 });
    });

    it('allows no undo while a command runs', () => {
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        click(editor, TABLE);
        editor.startMoveCommand();
        click(editor, NEAR_CORNER);
        click(editor, WALL);
        click(editor, { x: 1600, y: 1800 });
        editor.startMoveCommand();
        expect(editor.snapshot.canUndo).toBe(false);
        expect(editor.undo()).toBe(false);
        expect(tableCentre(history)).toEqual({ x: 1000, y: 1800 });
    });

    it('leaves no undo step for a zero displacement', () => {
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        click(editor, TABLE);
        editor.startMoveCommand();
        click(editor, NEAR_CORNER);
        click(editor, NEAR_CORNER);
        expect(editor.snapshot.command).toBeNull();
        expect(history.undoCommand).toBeNull();
    });

    it('gives the preview point at the second point prompt: the snap point, else the cursor', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(EMPTY));
        expect(editor.snapshot.previewPoint).toBeNull();
        click(editor, EMPTY);
        expect(editor.snapshot.previewPoint).toEqual(EMPTY);
        editor.pointerMove(at(NEAR_CORNER));
        expect(editor.snapshot.previewPoint).toEqual(CORNER);
        editor.pointerMove(at({ x: 2000, y: 1500 }));
        expect(editor.snapshot.previewPoint).toEqual({ x: 2000, y: 1500 });
        editor.pointerLeave();
        expect(editor.snapshot.previewPoint).toBeNull();
        editor.pointerMove(at(WALL));
        click(editor, WALL);
        expect(editor.snapshot.previewPoint).toBeNull();
    });

    it('cancels with Escape at both point prompts', () => {
        const editor = atBasePoint();
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        click(editor, TABLE);
        editor.startMoveCommand();
        click(editor, EMPTY);
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: null, basePoint: null, message: '*Abbruch*' });
    });

    it('ignores right clicks and drags at the point prompts', () => {
        const editor = atBasePoint();
        click(editor, EMPTY, { button: 2 });
        expect(editor.snapshot.prompt).toBe(BASE_POINT_PROMPT);
        editor.pointerMove(at({ x: 3200, y: 2200 }));
        expect(editor.snapshot.area).toBeNull();
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
    });

    it('follows the snap settings', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(NEAR_CORNER));
        editor.setSnapSettings({ enabled: false, modes: new Set(['END']) });
        expect(editor.snapshot.snap).toBeNull();
        click(editor, NEAR_CORNER);
        expect(editor.snapshot.basePoint).toEqual(NEAR_CORNER);
        editor.setSnapSettings({ enabled: true, modes: new Set(['INT']) });
        expect(editor.snapshot.snap).toMatchObject({ mode: 'INT', point: CORNER });
    });

    it('snaps at once when the base point prompt starts under a snap point', () => {
        const editor = create();
        editor.startMoveCommand();
        click(editor, TABLE);
        editor.pointerMove(at(NEAR_CORNER));
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.snap).toMatchObject({ mode: 'END', point: CORNER });
    });
});

describe('SelectionEditor SCHIEBEN: typed input', () => {
    const SECOND_POINT_PROMPT = 'Zweiten Punkt angeben oder <ersten Punkt als Verschiebung verwenden>:';
    const DISPLACEMENT_PROMPT = 'Verschiebung angeben <0,0>:';
    const INVALID = 'Punkt oder Option-Schlüsselwort erforderlich.';

    /**
     * SCHIEBEN on the table (centre at 4000, 1800), at the base point prompt. Dynamic Input is
     * off, as this tests the command line syntax.
     */
    const start = () => {
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: false });
        click(editor, TABLE);
        editor.startMoveCommand();
        return { editor, history };
    };
    /** Types each character of `text`, then Enter unless `enter` is false. */
    const type = (editor: SelectionEditor, text: string, enter = true) => {
        for (const key of text) {
            expect(editor.keyDown({ key }), key).toBe(true);
        }
        if (enter) {
            expect(editor.keyDown({ key: 'Enter' })).toBe(true);
        }
    };

    it('shows the typed text; Backspace edits it, Esc drops it and then cancels', () => {
        const { editor } = start();
        type(editor, '12,3', false);
        expect(editor.snapshot).toMatchObject({ prompt: BASE_POINT_PROMPT, input: '12,3' });
        editor.keyDown({ key: 'Backspace' });
        expect(editor.snapshot.input).toBe('12,');
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: 'MOVE', input: '' });
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
    });

    it('takes a typed absolute base point and a second point relative to it', () => {
        const { editor, history } = start();
        type(editor, '4000,1800');
        expect(editor.snapshot).toMatchObject({ prompt: SECOND_POINT_PROMPT, basePoint: { x: 4000, y: 1800 }, input: '' });
        type(editor, '@100,-50');
        expect(editor.snapshot.command).toBeNull();
        expect(tableCentre(history)).toEqual({ x: 4100, y: 1750 });
        expect(editor.undo()).toBe(true);
        expect(tableCentre(history)).toEqual({ x: 4000, y: 1800 });
    });

    it('takes an absolute second point and polar input in degrees, counter-clockwise', () => {
        const absolute = start();
        type(absolute.editor, '4000,1800');
        type(absolute.editor, '0,0');
        expect(tableCentre(absolute.history)).toEqual({ x: 0, y: 0 });
        const polar = start();
        type(polar.editor, '0,0');
        type(polar.editor, '@100<90');
        const centre = tableCentre(polar.history);
        expect(centre.x).toBeCloseTo(4000);
        expect(centre.y).toBeCloseTo(1900);
    });

    it('takes relative input at the base point from the last point given', () => {
        const { editor, history } = start();
        type(editor, '@10,20');
        expect(editor.snapshot.basePoint).toEqual({ x: 10, y: 20 });
        type(editor, '@5,0');
        click(editor, { x: 4605, y: 1800 });
        editor.startMoveCommand();
        type(editor, '@');
        expect(editor.snapshot.basePoint).toEqual({ x: 15, y: 20 });
        expect(tableCentre(history)).toEqual({ x: 4005, y: 1800 });
    });

    it('moves a typed distance towards the cursor at the second point (direct distance entry)', () => {
        const { editor, history } = start();
        type(editor, '3000,1000');
        // Straight up, where nothing snaps
        editor.pointerMove(at(EMPTY));
        type(editor, '250');
        expect(tableCentre(history)).toEqual({ x: 4000, y: 2050 });
    });

    it('rejects a distance without a cursor and text that is no point, staying at the prompt', () => {
        const { editor, history } = start();
        type(editor, '250');
        expect(editor.snapshot).toMatchObject({ prompt: BASE_POINT_PROMPT, message: INVALID, input: '' });
        type(editor, 'x');
        expect(editor.snapshot).toMatchObject({ prompt: BASE_POINT_PROMPT, message: INVALID });
        type(editor, '3000,1000');
        type(editor, '250');
        expect(editor.snapshot).toMatchObject({ prompt: SECOND_POINT_PROMPT, message: INVALID });
        type(editor, '1,2,3');
        expect(editor.snapshot).toMatchObject({ prompt: SECOND_POINT_PROMPT, message: INVALID });
        expect(tableCentre(history)).toEqual({ x: 4000, y: 1800 });
    });

    it('asks for the displacement on Enter or "V" at the base point and moves by the typed vector', () => {
        const { editor, history } = start();
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot).toMatchObject({ prompt: DISPLACEMENT_PROMPT, cursor: 'point', basePoint: null });
        type(editor, '-500,200');
        expect(editor.snapshot.command).toBeNull();
        expect(tableCentre(history)).toEqual({ x: 3500, y: 2000 });
        click(editor, { x: 4100, y: 2000 });
        editor.startMoveCommand();
        type(editor, 'v');
        expect(editor.snapshot.prompt).toBe(DISPLACEMENT_PROMPT);
        type(editor, '@100<0');
        expect(tableCentre(history).x).toBeCloseTo(3600);
    });

    it('takes a clicked point as the displacement vector', () => {
        const { editor, history } = start();
        editor.keyDown({ key: 'Enter' });
        click(editor, EMPTY);
        expect(tableCentre(history)).toEqual({ x: 7000, y: 3800 });
    });

    it('moves nothing for the default <0,0> and rejects a distance at the displacement prompt', () => {
        const { editor, history } = start();
        editor.keyDown({ key: 'Enter' });
        type(editor, '100');
        expect(editor.snapshot).toMatchObject({ prompt: DISPLACEMENT_PROMPT, message: INVALID });
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.command).toBeNull();
        expect(history.undoCommand).toBeNull();
    });

    it('takes the base point as the displacement on Enter at the second point', () => {
        const { editor, history } = start();
        type(editor, '100,-50');
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.command).toBeNull();
        expect(tableCentre(history)).toEqual({ x: 4100, y: 1750 });
    });

    it('ends typed text with Space; a click drops it and takes the point', () => {
        const { editor } = start();
        expect(editor.keyDown({ key: ' ' })).toBe(false);
        type(editor, '10,20', false);
        expect(editor.keyDown({ key: ' ' })).toBe(true);
        expect(editor.snapshot.basePoint).toEqual({ x: 10, y: 20 });
        type(editor, '99', false);
        editor.pointerMove(at(EMPTY));
        click(editor, EMPTY);
        expect(editor.snapshot).toMatchObject({ command: null, input: '' });
    });

    it('takes no shortcuts and types at point prompts and the command prompt only', () => {
        const { editor } = start();
        expect(editor.keyDown({ key: 'z', ctrlKey: true })).toBe(false);
        expect(editor.keyDown({ key: 'F3' })).toBe(false);
        expect(editor.snapshot.input).toBe('');
        editor.keyDown({ key: 'Escape' });
        expect(editor.keyDown({ key: 'z', ctrlKey: true })).toBe(false);
        expect(editor.keyDown({ key: '1' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ input: '1', acceptsInput: true });
        editor.keyDown({ key: 'Escape' });
        editor.startMoveCommand();
        expect(editor.snapshot.acceptsInput).toBe(false);
        expect(editor.snapshot.prompt).toBe('SCHIEBEN Objekte wählen:');
        expect(editor.keyDown({ key: '1' })).toBe(false);
        expect(editor.snapshot.input).toBe('');
    });
});

describe('SelectionEditor SCHIEBEN: polar tracking', () => {
    /** 8 mm (4 px) right of the vertical path up from the base point 3000,1000, where nothing snaps. */
    const NEAR_VERTICAL = { x: 3008, y: 1600 };

    /** SCHIEBEN on the table (centre at 4000, 1800), with the base point 3000,1000 typed. */
    const atSecondPoint = () => {
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        click(editor, TABLE);
        editor.startMoveCommand();
        for (const key of '3000,1000') {
            editor.keyDown({ key });
        }
        editor.keyDown({ key: 'Enter' });
        return { editor, history };
    };

    it('puts the preview point onto the polar path near the cursor', () => {
        const { editor } = atSecondPoint();
        editor.pointerMove(at(NEAR_VERTICAL));
        expect(editor.snapshot.snap).toBeNull();
        expect(editor.snapshot.polar).toEqual({ angle: 90, point: { x: 3000, y: 1600 }, distance: 600 });
        expect(editor.snapshot.previewPoint).toEqual({ x: 3000, y: 1600 });
        // 15 px off the path
        editor.pointerMove(at({ x: 3030, y: 1600 }));
        expect(editor.snapshot.polar).toBeNull();
        expect(editor.snapshot.previewPoint).toEqual({ x: 3030, y: 1600 });
    });

    it('moves exactly along the path on a click', () => {
        const { editor, history } = atSecondPoint();
        editor.pointerMove(at(NEAR_VERTICAL));
        click(editor, NEAR_VERTICAL);
        expect(tableCentre(history)).toEqual({ x: 4000, y: 2400 });
    });

    it('moves a typed distance along the path (direct distance entry)', () => {
        const { editor, history } = atSecondPoint();
        editor.pointerMove(at(NEAR_VERTICAL));
        for (const key of '250') {
            editor.keyDown({ key });
        }
        editor.keyDown({ key: 'Enter' });
        expect(tableCentre(history)).toEqual({ x: 4000, y: 2050 });
    });

    it('gives way to a snap point', () => {
        const { editor } = atSecondPoint();
        // The outer wall's midpoint 3000,0 lies on the path down from the base point
        editor.pointerMove(at({ x: 3004, y: 2 }));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'MID', point: WALL });
        expect(editor.snapshot.polar).toBeNull();
        expect(editor.snapshot.previewPoint).toEqual(WALL);
    });

    it('works with the object snap off, not at the base point prompt and not while off itself', () => {
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        click(editor, TABLE);
        editor.startMoveCommand();
        editor.pointerMove(at(NEAR_VERTICAL));
        expect(editor.snapshot.polar).toBeNull();
        const second = atSecondPoint().editor;
        second.setSnapSettings({ enabled: false, modes: new Set() });
        second.pointerMove(at(NEAR_VERTICAL));
        expect(second.snapshot.polar).toMatchObject({ angle: 90 });
        second.setPolarSettings({ enabled: false, incrementAngle: 90, additionalAngles: [] });
        expect(second.snapshot.polar).toBeNull();
        expect(second.snapshot.previewPoint).toEqual(NEAR_VERTICAL);
        second.setPolarSettings({ enabled: true, incrementAngle: 45, additionalAngles: [] });
        second.pointerMove(at({ x: 3200, y: 1210 }));
        expect(second.snapshot.polar).toMatchObject({ angle: 45 });
    });
});

describe('SelectionEditor SCHIEBEN: Ortho', () => {
    /** SCHIEBEN on the table (centre at 4000, 1800), with the base point 3000,1000 typed and Ortho on. */
    const atSecondPoint = () => {
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        editor.setOrtho(true);
        click(editor, TABLE);
        editor.startMoveCommand();
        for (const key of '3000,1000') {
            editor.keyDown({ key });
        }
        editor.keyDown({ key: 'Enter' });
        return { editor, history };
    };

    it('forces the point onto the horizontal or vertical through the base point, however far off', () => {
        const { editor } = atSecondPoint();
        editor.pointerMove(at({ x: 3300, y: 1600 }));
        expect(editor.snapshot.previewPoint).toEqual({ x: 3000, y: 1600 });
        editor.pointerMove(at({ x: 3700, y: 1600 }));
        expect(editor.snapshot.previewPoint).toEqual({ x: 3700, y: 1000 });
        // No polar path while Ortho is on
        editor.pointerMove(at({ x: 3008, y: 1600 }));
        expect(editor.snapshot.polar).toBeNull();
    });

    it('moves exactly vertically on a click', () => {
        const { editor, history } = atSecondPoint();
        click(editor, { x: 3300, y: 1600 });
        expect(tableCentre(history)).toEqual({ x: 4000, y: 2400 });
    });

    it('moves a typed distance in the Ortho direction', () => {
        const { editor, history } = atSecondPoint();
        editor.pointerMove(at({ x: 3700, y: 1600 }));
        for (const key of '250') {
            editor.keyDown({ key });
        }
        editor.keyDown({ key: 'Enter' });
        expect(tableCentre(history)).toEqual({ x: 4250, y: 1800 });
    });

    it('gives way to a snap point and to typed coordinates', () => {
        const { editor } = atSecondPoint();
        editor.pointerMove(at({ x: 3004, y: 2 }));
        expect(editor.snapshot.previewPoint).toEqual(WALL);
        const typed = atSecondPoint();
        typed.editor.pointerMove(at({ x: 3700, y: 1600 }));
        for (const key of '@100,100') {
            typed.editor.keyDown({ key });
        }
        typed.editor.keyDown({ key: 'Enter' });
        expect(tableCentre(typed.history)).toEqual({ x: 4100, y: 1900 });
    });

    it('does not change the base point and follows switching at the cursor', () => {
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        editor.setOrtho(true);
        click(editor, TABLE);
        editor.startMoveCommand();
        click(editor, EMPTY);
        expect(editor.snapshot.basePoint).toEqual(EMPTY);
        editor.pointerMove(at({ x: 3300, y: 2200 }));
        expect(editor.snapshot.previewPoint).toEqual({ x: 3300, y: 2000 });
        editor.setOrtho(false);
        expect(editor.snapshot.previewPoint).toEqual({ x: 3300, y: 2200 });
    });
});

describe('SelectionEditor SCHIEBEN: Tab cycling and hysteresis', () => {
    /** A line 12 mm (6 px) long: endpoints at 0 and 12, midpoint at 6. */
    const LINE: CadDocument = {
        ...parseDocument(samplePlan),
        vertices: [
            { id: 'a', x: 0, y: 0 },
            { id: 'b', x: 12, y: 0 },
        ],
        elements: [{ id: 'line', type: 'line', layerId: null, groupId: null, styleId: null, startVertexId: 'a', endVertexId: 'b' }],
        layers: [],
        groups: [],
    };
    const START = { x: 0, y: 0 };
    const MIDDLE = { x: 6, y: 0 };
    const END = { x: 12, y: 0 };
    /** 2 px from the start point, 1 px from the midpoint, 4 px from the end point. */
    const NEAR_START = { x: 4, y: 0 };

    /** SCHIEBEN on the line, at the base point prompt. */
    const atBasePoint = () => {
        const editor = new SelectionEditor(LINE);
        click(editor, MIDDLE);
        editor.startMoveCommand();
        return editor;
    };
    const tab = (editor: SelectionEditor, shiftKey = false) => editor.keyDown({ key: 'Tab', shiftKey });

    it('switches to the next snap point in the aperture with Tab, wrapping around', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(NEAR_START));
        expect(editor.snapshot).toMatchObject({ snap: { mode: 'END', point: START }, snapCycle: null });
        expect(tab(editor)).toBe(true);
        expect(editor.snapshot).toMatchObject({ snap: { mode: 'MID', point: MIDDLE }, snapCycle: { index: 1, count: 3 } });
        tab(editor);
        expect(editor.snapshot).toMatchObject({ snap: { mode: 'END', point: END }, snapCycle: { index: 2, count: 3 } });
        tab(editor);
        expect(editor.snapshot).toMatchObject({ snap: { mode: 'END', point: START }, snapCycle: { index: 0, count: 3 } });
        expect(tab(editor, true)).toBe(true);
        expect(editor.snapshot).toMatchObject({ snap: { mode: 'END', point: END }, snapCycle: { index: 2, count: 3 } });
    });

    it('takes the point chosen by Tab on a click', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(NEAR_START));
        tab(editor);
        click(editor, NEAR_START);
        expect(editor.snapshot).toMatchObject({ basePoint: MIDDLE, snapCycle: null });
    });

    it('keeps the Tab choice for small moves and resets it beyond the aperture size', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(NEAR_START));
        tab(editor);
        // 1 px away
        editor.pointerMove(at({ x: 4, y: 2 }));
        expect(editor.snapshot).toMatchObject({ snap: { mode: 'MID' }, snapCycle: { index: 1, count: 3 } });
        // 10 px from where Tab was pressed: still within the 10 px aperture size
        editor.pointerMove(at({ x: 4, y: 20 }));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'MID' });
        // 15 px: back to the best point, although the midpoint is still in the aperture
        editor.pointerMove(at({ x: 26, y: 20 }));
        expect(editor.snapshot).toMatchObject({ snap: { mode: 'END', point: END }, snapCycle: null });
    });

    it('ends the cycle when the chosen point leaves the aperture', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(NEAR_START));
        tab(editor, true);
        expect(editor.snapshot.snap).toMatchObject({ point: END });
        // Zoomed in at the cursor: the aperture reaches 5 mm, the end point is 8 mm away
        editor.pointerMove(at(NEAR_START, { pixelSize: 0.5 }));
        expect(editor.snapshot).toMatchObject({ snap: { mode: 'MID' }, snapCycle: null });
    });

    it('handles Tab at every point prompt but nowhere else', () => {
        const editor = new SelectionEditor(LINE);
        editor.pointerMove(at(NEAR_START));
        expect(tab(editor)).toBe(false);
        click(editor, MIDDLE);
        editor.startMoveCommand();
        editor.pointerMove(at({ x: 100, y: 100 }));
        expect(tab(editor)).toBe(true);
        expect(editor.snapshot).toMatchObject({ snap: null, snapCycle: null });
        click(editor, { x: 100, y: 100 });
        editor.pointerMove(at(NEAR_START));
        expect(tab(editor)).toBe(true);
        expect(editor.snapshot.snapCycle).toEqual({ index: 1, count: 3 });
    });

    it('keeps the last snap point while no other is more than 2 px nearer', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(MIDDLE));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'MID' });
        // Without the midpoint before, the start point would win here (see the first test)
        editor.pointerMove(at(NEAR_START));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'MID' });
        // Start point 0.5 px, midpoint 2.5 px away: not more than 2 px nearer yet
        editor.pointerMove(at({ x: 1, y: 0 }));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'MID' });
        editor.pointerMove(at({ x: 0.8, y: 0 }));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'END', point: START });
    });
});

describe('SelectionEditor SCHIEBEN: snap point preview', () => {
    /** On the table's outline at 45°, 20 mm (10 px) aperture: no snap point in reach. */
    const onTable = (angle = Math.PI / 4) => ({ x: 4000 + 600 * Math.cos(angle), y: 1800 + 600 * Math.sin(angle) });
    const TABLE_POINTS = [
        { mode: 'CEN', point: { x: 4000, y: 1800 } },
        { mode: 'QUA', point: { x: 4600, y: 1800 } },
        { mode: 'QUA', point: { x: 4000, y: 2400 } },
        { mode: 'QUA', point: { x: 3400, y: 1800 } },
        { mode: 'QUA', point: { x: 4000, y: 1200 } },
    ];
    const preview = (editor: SelectionEditor) =>
        editor.snapshot.snapPreview.map(({ mode, point }) => ({
            mode,
            point: { x: Math.round(point.x * 1000) / 1000 + 0, y: Math.round(point.y * 1000) / 1000 + 0 },
        }));
    const atBasePoint = (editor = create()) => {
        click(editor, TABLE);
        editor.startMoveCommand();
        return editor;
    };

    it('shows the snap points of the object under the aperture at the base point', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(onTable()));
        expect(editor.snapshot.snap).toBeNull();
        expect(preview(editor)).toEqual(TABLE_POINTS);
        editor.pointerMove(at({ x: -1000, y: -1000 }));
        expect(editor.snapshot.snapPreview).toEqual([]);
    });

    it('keeps showing an object the cursor came into over its outline, the innermost one first', () => {
        const editor = atBasePoint();
        // In the table, but not yet over its outline in this prompt
        editor.pointerMove(at({ x: 4100, y: 1900 }));
        expect(editor.snapshot.snapPreview).toEqual([]);
        // Over the table's outline into the table
        editor.pointerMove(at(onTable()));
        editor.pointerMove(at({ x: 4100, y: 1900 }));
        expect(preview(editor)).toEqual(TABLE_POINTS);
        // Out over the rug's outline and back in: on the rug, outside the table
        editor.pointerMove(at({ x: 5000, y: 1800 }));
        editor.pointerMove(at({ x: 4800, y: 1800 }));
        expect(preview(editor)).toContainEqual({ mode: 'QUA', point: { x: 5000, y: 1800 } });
        expect(preview(editor)).not.toContainEqual({ mode: 'QUA', point: { x: 4600, y: 1800 } });
    });

    it('leaves out the point that snaps now, which keeps its normal marker', () => {
        const editor = atBasePoint();
        editor.pointerMove(at({ x: 4600, y: 1810 }));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'QUA', point: { x: 4600, y: 1800 } });
        expect(preview(editor)).toEqual(TABLE_POINTS.filter(({ point }) => point.x !== 4600));
    });

    it('shows the snap points at the second point too, for every object under the aperture', () => {
        const editor = atBasePoint();
        click(editor, EMPTY);
        // On the outer wall, far from its midpoint: its four corners and four edge midpoints
        editor.pointerMove(at({ x: 3100, y: 4 }));
        expect(editor.snapshot.snap).toBeNull();
        expect(preview(editor)).toHaveLength(8);
        expect(preview(editor)).toEqual(
            expect.arrayContaining([
                { mode: 'END', point: { x: 0, y: 0 } },
                { mode: 'END', point: { x: 6000, y: 4000 } },
                { mode: 'MID', point: { x: 3000, y: 0 } },
                { mode: 'MID', point: { x: 6000, y: 2000 } },
            ]),
        );
    });

    it('notifies only when the preview changes', () => {
        const editor = create();
        // The live Dynamic Input values change with every move
        editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: false });
        atBasePoint(editor);
        const listener = vi.fn();
        editor.subscribe(listener);
        editor.pointerMove(at(onTable()));
        editor.pointerMove(at(onTable(Math.PI / 4 + 0.01)));
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('shows nothing with the object snap off, outside point prompts or when switched off', () => {
        const editor = atBasePoint();
        editor.pointerMove(at(onTable()));
        editor.setSnapSettings({ enabled: false, modes: new Set(['QUA']) });
        expect(editor.snapshot.snapPreview).toEqual([]);
        editor.setSnapSettings({ enabled: true, modes: new Set(['QUA']) });
        expect(preview(editor)).toEqual(TABLE_POINTS.filter(({ mode }) => mode === 'QUA'));
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot.snapPreview).toEqual([]);
        editor.pointerMove(at(onTable(1)));
        expect(editor.snapshot.snapPreview).toEqual([]);

        const off = atBasePoint(new SelectionEditor(parseDocument(samplePlan), { ...DEFAULT_EDITOR_SETTINGS, snapPreview: false }));
        off.pointerMove(at(onTable()));
        expect(off.snapshot.snapPreview).toEqual([]);
    });
});

describe('SelectionEditor rectangle (press + drag)', () => {
    /** Around the table; the rug (x 3000–5000, y 1100–2500) sticks out of it. */
    const LOWER_LEFT = { x: 3300, y: 1100 };
    const UPPER_RIGHT = { x: 4700, y: 2500 };

    it('does nothing on a plain click into empty space', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, EMPTY);
        editor.pointerMove(at(UPPER_RIGHT));
        expect(editor.snapshot.area).toBeNull();
        expect(editor.snapshot.prompt).toBe('Befehl:');
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
    });

    it('opens the rectangle only once the press is dragged past the threshold', () => {
        const editor = create();
        editor.pointerDown(at(LOWER_LEFT));
        expect(editor.snapshot.area).toBeNull();
        // 2 px, still within the 3 px threshold
        editor.pointerMove(at({ x: 3304, y: 1100 }));
        expect(editor.snapshot.area).toBeNull();
        editor.pointerMove(at(UPPER_RIGHT));
        expect(editor.snapshot.area).toEqual({ shape: 'rect', mode: 'window', first: LOWER_LEFT, second: UPPER_RIGHT });
        expect(editor.snapshot.prompt).toBe('Entgegengesetzte Ecke angeben:');
        editor.pointerMove(at({ x: 3000, y: 1000 }));
        expect(editor.snapshot.area?.mode).toBe('crossing');
    });

    it('stays open after the release and follows the cursor', () => {
        const editor = create();
        drag(editor, [LOWER_LEFT, { x: 4000, y: 1800 }]);
        expect(editor.snapshot.area).toMatchObject({ shape: 'rect', mode: 'window' });
        expect(editor.snapshot.prompt).toBe('Entgegengesetzte Ecke angeben:');
        editor.pointerMove(at(UPPER_RIGHT));
        expect(editor.snapshot.area).toEqual({ shape: 'rect', mode: 'window', first: LOWER_LEFT, second: UPPER_RIGHT });
        expect(editor.snapshot.highlighted.size).toBe(0);
    });

    it('selects by window when the next click ends it to the right', () => {
        const editor = create();
        rectangle(editor, LOWER_LEFT, UPPER_RIGHT);
        expect(editor.snapshot.area).toBeNull();
        expect(editor.snapshot.prompt).toBe('Befehl:');
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
        expect(editor.snapshot.grips).toHaveLength(5);
    });

    it('selects by crossing when ended to the left', () => {
        const editor = create();
        rectangle(editor, UPPER_RIGHT, LOWER_LEFT);
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table, E.rug]);
    });

    it('takes the ending click as the corner, not where the button was released', () => {
        const editor = create();
        drag(editor, [LOWER_LEFT, { x: 4000, y: 1800 }]);
        editor.pointerMove(at(UPPER_RIGHT));
        click(editor, UPPER_RIGHT);
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
    });

    it('ends with the next click even over an element, without picking it', () => {
        const editor = create();
        // Crossing from (4700, 1000) to the table outline cuts table and rug
        rectangle(editor, { x: 4700, y: 1000 }, TABLE);
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table, E.rug]);
    });

    it('ends with Enter at the cursor', () => {
        const editor = create();
        drag(editor, [UPPER_RIGHT, { x: 4000, y: 1800 }]);
        editor.pointerMove(at(LOWER_LEFT));
        expect(editor.keyDown({ key: 'Enter' })).toBe(true);
        expect(editor.snapshot.area).toBeNull();
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table, E.rug]);
    });

    it('stays open while the view is zoomed: the corner follows the cursor in the model', () => {
        const editor = create();
        drag(editor, [LOWER_LEFT, { x: 4000, y: 1800 }]);
        // After a zoom the same screen position maps to another model point; the wheel sends a move
        editor.pointerMove(at(UPPER_RIGHT, { pixelSize: 4 }));
        expect(editor.snapshot.area).toMatchObject({ first: LOWER_LEFT, second: UPPER_RIGHT });
        click(editor, UPPER_RIGHT, { pixelSize: 4 });
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
    });

    it('removes the found elements with Shift on the ending click or with Shift+Enter', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, TABLE);
        rectangle(editor, UPPER_RIGHT, LOWER_LEFT, { shiftKey: true });
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
        click(editor, TABLE);
        drag(editor, [UPPER_RIGHT, LOWER_LEFT]);
        editor.keyDown({ key: 'Enter', shiftKey: true });
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
    });

    it('reports the counts while SCHIEBEN selects', () => {
        const editor = create();
        editor.startMoveCommand();
        click(editor, TABLE);
        rectangle(editor, UPPER_RIGHT, LOWER_LEFT);
        expect(editor.snapshot.message).toBe('2 gefunden (1 doppelt), 2 gesamt');
        expect(editor.snapshot.prompt).toBe('SCHIEBEN Objekte wählen:');
        rectangle(editor, UPPER_RIGHT, LOWER_LEFT, { shiftKey: true });
        expect(editor.snapshot.message).toBe('2 gefunden, 2 entfernt, 0 gesamt');
    });

    it('drops just the rectangle with Escape, before or after the release', () => {
        const editor = create();
        editor.startMoveCommand();
        click(editor, TABLE);
        // Escape while the button is still held; the release then does nothing
        editor.pointerDown(at(UPPER_RIGHT));
        editor.pointerMove(at(LOWER_LEFT));
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: 'MOVE', area: null, prompt: 'SCHIEBEN Objekte wählen:' });
        editor.pointerMove(at(UPPER_RIGHT));
        editor.pointerUp(at(UPPER_RIGHT));
        expect(editor.snapshot.area).toBeNull();
        // Escape after the release
        drag(editor, [UPPER_RIGHT, LOWER_LEFT]);
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: 'MOVE', area: null });
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
    });

    it('ignores a right click while dragging', () => {
        const editor = create();
        editor.startMoveCommand();
        editor.pointerDown(at(UPPER_RIGHT));
        editor.pointerMove(at(LOWER_LEFT));
        editor.pointerDown(at(LOWER_LEFT, { button: 2 }));
        expect(editor.snapshot.command).toBe('MOVE');
        expect(editor.snapshot.area).not.toBeNull();
    });

    it('shows no rollover while dragging', () => {
        const editor = create();
        editor.pointerDown(at(EMPTY));
        editor.pointerMove(at(WALL));
        expect(editor.snapshot.area).not.toBeNull();
        expect(editor.snapshot.hovered.size).toBe(0);
    });

    it('keeps the rectangle open when the browser cancels the press, as after a release', () => {
        const editor = create();
        editor.pointerDown(at(LOWER_LEFT));
        editor.pointerMove(at(UPPER_RIGHT));
        editor.pointerCancel();
        expect(editor.snapshot.area?.shape).toBe('rect');
        expect(editor.snapshot.highlighted.size).toBe(0);
        click(editor, UPPER_RIGHT);
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
    });
});

describe('SelectionEditor lasso (Alt + drag)', () => {
    const ALT = { altKey: true };
    /** Clockwise around the table, starting at its lower left and moving right first. */
    const AROUND_TABLE = [
        { x: 3300, y: 1100 },
        { x: 4700, y: 1100 },
        { x: 4700, y: 2500 },
        { x: 3300, y: 2500 },
    ];
    /** The same loop, but starting to the left. */
    const AROUND_TABLE_LEFTWARDS = [AROUND_TABLE[1], AROUND_TABLE[0], AROUND_TABLE[3], AROUND_TABLE[2]];

    it('becomes a lasso once an Alt press in empty space is dragged past the threshold', () => {
        const editor = create();
        editor.pointerDown(at(AROUND_TABLE[0], ALT));
        // 2 px, still within the 3 px threshold
        editor.pointerMove(at({ x: 3304, y: 1100 }));
        expect(editor.snapshot.area).toBeNull();
        editor.pointerMove(at(AROUND_TABLE[1]));
        expect(editor.snapshot.area).toMatchObject({ shape: 'lasso', mode: 'window' });
        expect(editor.snapshot.prompt).toBe('Lasso – Leertaste wechselt Fenster/Kreuzen');
    });

    it('does nothing for an Alt click without dragging', () => {
        const editor = create();
        click(editor, AROUND_TABLE[0], ALT);
        editor.pointerMove(at(AROUND_TABLE[2]));
        expect(editor.snapshot.area).toBeNull();
    });

    it('selects by window when started to the right', () => {
        const editor = create();
        drag(editor, AROUND_TABLE, ALT);
        expect(editor.snapshot.area).toBeNull();
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
    });

    it('selects by crossing when started to the left', () => {
        const editor = create();
        drag(editor, AROUND_TABLE_LEFTWARDS, ALT);
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table, E.rug]);
    });

    it('toggles window and crossing with Space', () => {
        const editor = create();
        editor.pointerDown(at(AROUND_TABLE[0], ALT));
        editor.pointerMove(at(AROUND_TABLE[1]));
        expect(editor.keyDown({ key: ' ' })).toBe(true);
        expect(editor.snapshot.area?.mode).toBe('crossing');
        editor.pointerMove(at(AROUND_TABLE[2]));
        editor.pointerMove(at(AROUND_TABLE[3]));
        editor.pointerUp(at(AROUND_TABLE[3]));
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table, E.rug]);
    });

    it('leaves Space alone without a lasso, so it can pan', () => {
        const editor = create();
        expect(editor.keyDown({ key: ' ' })).toBe(false);
        click(editor, EMPTY);
        expect(editor.keyDown({ key: ' ' })).toBe(false);
    });

    it('records points only every few pixels', () => {
        const editor = create();
        editor.pointerDown(at(AROUND_TABLE[0], ALT));
        editor.pointerMove(at({ x: 3400, y: 1100 }));
        // 1 px further: too close to the last point
        editor.pointerMove(at({ x: 3402, y: 1100 }));
        editor.pointerMove(at({ x: 3410, y: 1100 }));
        expect(editor.snapshot.area).toMatchObject({
            points: [AROUND_TABLE[0], { x: 3400, y: 1100 }, { x: 3410, y: 1100 }],
        });
    });

    it('removes the found elements with Shift on release', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, TABLE);
        drag(editor, AROUND_TABLE, { ...ALT, shiftKey: true });
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
    });

    it('reports the counts while SCHIEBEN selects', () => {
        const editor = create();
        editor.startMoveCommand();
        drag(editor, AROUND_TABLE_LEFTWARDS, ALT);
        expect(editor.snapshot.message).toBe('2 gefunden, 2 gesamt');
        expect(editor.snapshot.prompt).toBe('SCHIEBEN Objekte wählen:');
    });

    it('drops the lasso with Escape and ignores its release', () => {
        const editor = create();
        editor.pointerDown(at(AROUND_TABLE[0], ALT));
        editor.pointerMove(at(AROUND_TABLE[1]));
        editor.pointerMove(at(AROUND_TABLE[2]));
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot.area).toBeNull();
        editor.pointerUp(at(AROUND_TABLE[3]));
        expect(editor.snapshot.highlighted.size).toBe(0);
        expect(editor.snapshot.area).toBeNull();
    });

    it('drops the lasso without selecting when the browser cancels the press', () => {
        const editor = create();
        editor.pointerDown(at(AROUND_TABLE[0], ALT));
        editor.pointerMove(at(AROUND_TABLE[1]));
        editor.pointerMove(at(AROUND_TABLE[2]));
        editor.pointerCancel();
        expect(editor.snapshot.area).toBeNull();
        expect(editor.snapshot.highlighted.size).toBe(0);
        // Moving on does not start a new lasso
        editor.pointerMove(at(AROUND_TABLE[3]));
        expect(editor.snapshot.area).toBeNull();
    });

    it('selects nothing for a lasso without area', () => {
        const editor = create();
        drag(editor, [AROUND_TABLE[0], AROUND_TABLE[1]], ALT);
        expect(editor.snapshot.area).toBeNull();
        expect(editor.snapshot.highlighted.size).toBe(0);
    });
});

describe('SelectionEditor group selection', () => {
    /** Middle of the door leaf (x 1000, y 240–1140); door leaf and swing form group Door D1. */
    const DOOR_LEAF = { x: 1000, y: 690 };
    const DOOR = [E['door-leaf'], E['door-swing']];

    it('hovers the whole group', () => {
        const editor = create();
        editor.pointerMove(at(DOOR_LEAF));
        expect(ids(editor.snapshot.hovered)).toEqual(DOOR);
    });

    it('selects the whole group with a click on one member', () => {
        const editor = create();
        click(editor, DOOR_LEAF);
        expect(ids(editor.snapshot.highlighted)).toEqual(DOOR);
        // Leaf: 3 grips, swing: 4, sharing hinge and open end
        expect(editor.snapshot.grips).toHaveLength(5);
    });

    it('removes the whole group with Shift+click', () => {
        const editor = create();
        click(editor, TABLE);
        click(editor, DOOR_LEAF);
        click(editor, DOOR_LEAF, { shiftKey: true });
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
    });

    it('selects the whole group when a window contains only one member', () => {
        const editor = create();
        // Starts above the leaf, clear of the inner wall at y 240, and spans to the right
        rectangle(editor, { x: 985, y: 1160 }, { x: 1015, y: 225 });
        expect(ids(editor.snapshot.highlighted)).toEqual(DOOR);
    });

    it('counts group members in the command line messages', () => {
        const editor = create();
        editor.startMoveCommand();
        click(editor, DOOR_LEAF);
        expect(editor.snapshot.message).toBe('2 gefunden, 2 gesamt');
        click(editor, DOOR_LEAF);
        expect(editor.snapshot.message).toBe('2 gefunden (2 doppelt), 2 gesamt');
    });

    it('does not hover a group that is already selected', () => {
        const editor = create();
        click(editor, DOOR_LEAF);
        editor.pointerMove(at(DOOR_LEAF));
        expect(editor.snapshot.hovered.size).toBe(0);
    });
});

describe('SelectionEditor selection preview', () => {
    const LOWER_LEFT = { x: 3300, y: 1100 };
    const UPPER_RIGHT = { x: 4700, y: 2500 };

    it('previews what a window would pick while it is spanned', () => {
        const editor = create();
        editor.pointerDown(at(LOWER_LEFT));
        editor.pointerMove(at(UPPER_RIGHT));
        expect(ids(editor.snapshot.hovered)).toEqual([E.table]);
        // Crossing to the left (x 3200–3300) only cuts the rug; the table starts at x 3400
        editor.pointerMove(at({ x: 3200, y: 2500 }));
        expect(ids(editor.snapshot.hovered)).toEqual([E.rug]);
    });

    it('previews a lasso and follows Space', () => {
        const editor = create();
        editor.pointerDown(at(LOWER_LEFT, { altKey: true }));
        editor.pointerMove(at({ x: 4700, y: 1100 }));
        editor.pointerMove(at(UPPER_RIGHT));
        editor.pointerMove(at({ x: 3300, y: 2500 }));
        expect(ids(editor.snapshot.hovered)).toEqual([E.table]);
        editor.keyDown({ key: ' ' });
        expect(ids(editor.snapshot.hovered)).toEqual([E.table, E.rug]);
    });

    it('previews whole groups and leaves out what is already selected', () => {
        const editor = create();
        click(editor, TABLE);
        // Crossing from right to left over the door leaf (x 1000) and the table
        editor.pointerDown(at({ x: 4700, y: 1160 }));
        editor.pointerMove(at({ x: 985, y: 1100 }));
        expect(ids(editor.snapshot.hovered)).toEqual([E['door-leaf'], E['door-swing'], E.rug]);
    });

    it('drops the preview with the area', () => {
        const editor = create();
        editor.pointerDown(at(LOWER_LEFT));
        editor.pointerMove(at(UPPER_RIGHT));
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot.hovered.size).toBe(0);
    });
});

describe('SelectionEditor in English', () => {
    afterEach(async () => {
        await i18n.changeLanguage('de');
    });

    it('republishes prompt and message in the new language, without a state change', async () => {
        const editor = create();
        click(editor, TABLE);
        editor.startMoveCommand();
        const listener = vi.fn();
        editor.subscribe(listener);
        await i18n.changeLanguage('en');
        expect(listener).not.toHaveBeenCalled();
        editor.refreshTexts();
        expect(listener).toHaveBeenCalledOnce();
        expect(editor.snapshot).toMatchObject({
            prompt: 'Specify base point or [Displacement] <Displacement>:',
            message: '1 found',
        });
        editor.keyDown({ key: 'Escape' });
        expect(editor.snapshot).toMatchObject({ prompt: 'Command:', message: '*Cancel*' });
    });

    it('takes the English keyword and reports undo with the English command name', async () => {
        await i18n.changeLanguage('en');
        const editor = create();
        click(editor, TABLE);
        editor.startMoveCommand();
        editor.keyDown({ key: 'v' });
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.message).toBe('Point or option keyword required.');
        editor.keyDown({ key: 'd' });
        editor.keyDown({ key: 'Enter' });
        expect(editor.snapshot.prompt).toBe('Specify displacement <0,0>:');
        for (const key of '100,0') {
            editor.keyDown({ key });
        }
        editor.keyDown({ key: 'Enter' });
        expect(editor.undo()).toBe(true);
        expect(editor.snapshot.message).toBe('Undo: MOVE');
    });
});

describe('SelectionEditor typed commands', () => {
    /** Types each character of `text`, then `end` (Enter by default). */
    const type = (editor: SelectionEditor, text: string, end = 'Enter') => {
        for (const key of text) {
            expect(editor.keyDown({ key }), key).toBe(true);
        }
        return editor.keyDown({ key: end });
    };

    it('starts SCHIEBEN by its name or its alias, in any case, with Enter or Space', () => {
        for (const [text, end] of [['SCHIEBEN', 'Enter'], ['move', ' '], ['Schieben', ' ']]) {
            const editor = create();
            expect(editor.snapshot).toMatchObject({ prompt: 'Befehl:', acceptsInput: true });
            type(editor, text, 'Backspace');
            expect(editor.snapshot.input).toBe(text.slice(0, -1));
            expect(type(editor, text.slice(-1), end), text).toBe(true);
            expect(editor.snapshot).toMatchObject({ command: 'MOVE', prompt: 'SCHIEBEN Objekte wählen:', input: '' });
        }
    });

    it('takes the pickfirst selection, like the toolbar', () => {
        const editor = create();
        click(editor, TABLE);
        type(editor, 'move');
        expect(editor.snapshot).toMatchObject({ prompt: BASE_POINT_PROMPT, message: '1 gefunden' });
    });

    it('reports an unknown command and stays at the command prompt', () => {
        const editor = create();
        type(editor, 'kreis');
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', input: '', message: 'Unbekannter Befehl "KREIS".' });
    });

    it('leaves Space, Enter, Backspace and Esc alone without text; Esc drops the text first', () => {
        const editor = create();
        click(editor, TABLE);
        for (const key of [' ', 'Enter', 'Backspace']) {
            expect(editor.keyDown({ key }), key).toBe(false);
        }
        editor.keyDown({ key: 'm' });
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ input: '', highlighted: new Set([E.table]) });
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot.highlighted.size).toBe(0);
    });

    it('types nothing while a selection rectangle is open', () => {
        const editor = create();
        editor.pointerDown(at(EMPTY));
        editor.pointerMove(at({ x: 3500, y: 2500 }));
        editor.pointerUp(at({ x: 3500, y: 2500 }));
        expect(editor.snapshot.acceptsInput).toBe(false);
        expect(editor.keyDown({ key: 'm' })).toBe(false);
    });
});

describe('SelectionEditor SCHIEBEN: object snap tracking', () => {
    const DELAY = DEFAULT_EDITOR_SETTINGS.trackingAcquireDelay;
    /** The sofa's upper right corner (an endpoint) and the rug's left quadrant. */
    const SOFA = { x: 2600, y: 2600 };
    const RUG = { x: 3000, y: 1800 };
    /** 6 mm (3 px) above the horizontal path from the sofa corner, where nothing snaps. */
    const RIGHT_OF_SOFA = { x: 3200, y: 2606 };
    const near = (point: Point) => ({ x: point.x + 4, y: point.y + 4 });

    afterEach(() => {
        vi.useRealTimers();
    });

    /** SCHIEBEN on the table (centre at 4000, 1800) with object snap tracking on, at the base point prompt. */
    const atBasePoint = () => {
        vi.useFakeTimers();
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        editor.setObjectTrackingSettings({ enabled: true, allPolarAngles: false });
        click(editor, TABLE);
        editor.startMoveCommand();
        return { editor, history };
    };
    /** As atBasePoint, with the base point 4000,1000 typed. */
    const atSecondPoint = () => {
        const result = atBasePoint();
        for (const key of '4000,1000') {
            result.editor.keyDown({ key });
        }
        result.editor.keyDown({ key: 'Enter' });
        return result;
    };
    /** Rests the cursor near a snap point until it is acquired. */
    const dwell = (editor: SelectionEditor, point: Point) => {
        editor.pointerMove(at(near(point)));
        vi.advanceTimersByTime(DELAY);
    };

    it('acquires the snap point the cursor dwells on, after the delay', () => {
        const { editor } = atBasePoint();
        const listener = vi.fn();
        editor.subscribe(listener);
        editor.pointerMove(at(near(SOFA)));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'END', point: SOFA });
        listener.mockClear();
        vi.advanceTimersByTime(DELAY - 1);
        expect(editor.snapshot.acquired).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(editor.snapshot.acquired).toEqual([{ point: SOFA, mode: 'END' }]);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not acquire while passing by, and toggles once per dwell', () => {
        const { editor } = atBasePoint();
        editor.pointerMove(at(near(SOFA)));
        vi.advanceTimersByTime(DELAY / 2);
        editor.pointerMove(at(EMPTY));
        vi.advanceTimersByTime(DELAY);
        expect(editor.snapshot.acquired).toEqual([]);
        dwell(editor, SOFA);
        vi.advanceTimersByTime(3 * DELAY);
        expect(editor.snapshot.acquired).toHaveLength(1);
        // Dwelling on it again drops it
        editor.pointerMove(at(EMPTY));
        dwell(editor, SOFA);
        expect(editor.snapshot.acquired).toEqual([]);
    });

    it('puts the point onto a path from the acquired point, also at the base point prompt', () => {
        const { editor } = atBasePoint();
        dwell(editor, SOFA);
        editor.pointerMove(at(RIGHT_OF_SOFA));
        expect(editor.snapshot.snap).toBeNull();
        expect(editor.snapshot.objectTrack).toEqual({
            point: { x: 3200, y: 2600 },
            paths: [{ origin: SOFA, angle: 0, distance: 600, source: 'END' }],
        });
        click(editor, RIGHT_OF_SOFA);
        expect(editor.snapshot.basePoint).toEqual({ x: 3200, y: 2600 });
        // A new point prompt starts without acquired points
        expect(editor.snapshot.acquired).toEqual([]);
        expect(editor.snapshot.objectTrack).toBeNull();
    });

    it('moves exactly to where the paths of two acquired points cross', () => {
        const { editor, history } = atSecondPoint();
        dwell(editor, SOFA);
        dwell(editor, RUG);
        expect(editor.snapshot.acquired.map(({ mode }) => mode)).toEqual(['END', 'QUA']);
        editor.pointerMove(at({ x: 2606, y: 1806 }));
        expect(editor.snapshot.objectTrack?.point).toEqual({ x: 2600, y: 1800 });
        expect(editor.snapshot.objectTrack?.paths.map(({ source }) => source)).toEqual(['END', 'QUA']);
        expect(editor.snapshot.previewPoint).toEqual({ x: 2600, y: 1800 });
        click(editor, { x: 2606, y: 1806 });
        expect(tableCentre(history)).toEqual({ x: 2600, y: 2600 });
    });

    it('crosses a path with the polar path from the base point', () => {
        const { editor } = atSecondPoint();
        dwell(editor, SOFA);
        editor.pointerMove(at({ x: 4006, y: 2606 }));
        expect(editor.snapshot.objectTrack).toMatchObject({
            point: { x: 4000, y: 2600 },
            paths: [{ source: 'END', angle: 0 }, { source: 'polar', angle: 90 }],
        });
        expect(editor.snapshot.polar).toBeNull();
    });

    it('keeps the point on the Ortho axis, taking only its crossings with a path', () => {
        const { editor } = atSecondPoint();
        editor.setOrtho(true);
        dwell(editor, SOFA);
        editor.pointerMove(at({ x: 2610, y: 1400 }));
        expect(editor.snapshot.objectTrack).toMatchObject({
            point: { x: 2600, y: 1000 },
            paths: [{ source: 'END', angle: 270 }, { source: 'ortho', angle: 180 }],
        });
        editor.pointerMove(at({ x: 3200, y: 2000 }));
        expect(editor.snapshot.objectTrack).toBeNull();
        expect(editor.snapshot.previewPoint).toEqual({ x: 4000, y: 2000 });
    });

    it('gives way to a snap point', () => {
        const { editor } = atSecondPoint();
        dwell(editor, SOFA);
        // The sofa's other corner lies on the horizontal path
        editor.pointerMove(at({ x: 604, y: 2604 }));
        expect(editor.snapshot.snap).toMatchObject({ mode: 'END', point: { x: 600, y: 2600 } });
        expect(editor.snapshot.objectTrack).toBeNull();
    });

    it('moves a typed distance from the acquired point along the path', () => {
        const { editor, history } = atSecondPoint();
        dwell(editor, SOFA);
        editor.pointerMove(at(RIGHT_OF_SOFA));
        for (const key of '500') {
            editor.keyDown({ key });
        }
        editor.keyDown({ key: 'Enter' });
        // To 3100,2600: by -900,1600 from the base point
        expect(tableCentre(history)).toEqual({ x: 3100, y: 3400 });
    });

    it('needs the object snap on, drops the points when switched off and on Esc', () => {
        const { editor } = atBasePoint();
        dwell(editor, SOFA);
        editor.setSnapSettings({ enabled: false, modes: new Set() });
        editor.pointerMove(at(RIGHT_OF_SOFA));
        expect(editor.snapshot.objectTrack).toBeNull();
        expect(editor.snapshot.acquired).toHaveLength(1);
        editor.setObjectTrackingSettings({ enabled: false, allPolarAngles: false });
        expect(editor.snapshot.acquired).toEqual([]);

        const other = atBasePoint().editor;
        dwell(other, SOFA);
        other.keyDown({ key: 'Escape' });
        expect(other.snapshot.acquired).toEqual([]);
        other.startMoveCommand();
        expect(other.snapshot.acquired).toEqual([]);
    });

    it('does not acquire the point the prompt starts on until the cursor came back to it', () => {
        const { editor } = atBasePoint();
        editor.pointerMove(at(near(SOFA)));
        click(editor, near(SOFA));
        expect(editor.snapshot.basePoint).toEqual(SOFA);
        vi.advanceTimersByTime(3 * DELAY);
        expect(editor.snapshot.acquired).toEqual([]);
        editor.pointerMove(at(EMPTY));
        dwell(editor, SOFA);
        expect(editor.snapshot.acquired).toEqual([{ point: SOFA, mode: 'END' }]);
    });

    it('does not acquire with object snap tracking off', () => {
        const { editor } = atBasePoint();
        editor.setObjectTrackingSettings({ enabled: false, allPolarAngles: false });
        dwell(editor, SOFA);
        expect(editor.snapshot.acquired).toEqual([]);
    });
});

describe('SelectionEditor SCHIEBEN: Dynamic Input', () => {
    const SECOND_POINT_PROMPT = 'Zweiten Punkt angeben oder <ersten Punkt als Verschiebung verwenden>:';
    const INVALID = 'Punkt oder Option-Schlüsselwort erforderlich.';

    /** SCHIEBEN on the table (centre at 4000, 1800) with Dynamic Input on (the default), at the base point prompt. */
    const start = () => {
        const history = new DocumentHistory(parseDocument(samplePlan));
        const editor = new SelectionEditor(history);
        click(editor, TABLE);
        editor.startMoveCommand();
        return { editor, history };
    };
    /** Types each character of `text` (`\t` is Tab), then Enter unless `enter` is false. */
    const type = (editor: SelectionEditor, text: string, enter = true) => {
        for (const key of text) {
            expect(editor.keyDown({ key: key === '\t' ? 'Tab' : key }), key).toBe(true);
        }
        if (enter) {
            expect(editor.keyDown({ key: 'Enter' })).toBe(true);
        }
    };
    const texts = (editor: SelectionEditor) => editor.snapshot.dynamicInput?.fields.map(({ text }) => text);

    it('shows X/Y at the base point, distance and angle from the base point on a dimension at the second point', () => {
        const { editor } = start();
        editor.pointerMove(at(EMPTY));
        expect(editor.snapshot.dynamicInput).toMatchObject({ layout: 'pointer', format: 'cartesian', relative: false, bound: false });
        expect(texts(editor)).toEqual(['3000.00', '2000.00']);
        type(editor, '4000,1000');
        expect(editor.snapshot.prompt).toBe(SECOND_POINT_PROMPT);
        editor.pointerMove(at({ x: 4000, y: 1500 }));
        expect(editor.snapshot.dynamicInput).toMatchObject({ layout: 'dimension', format: 'polar', relative: true });
        expect(editor.snapshot.dynamicInput?.fields).toEqual([
            { kind: 'distance', text: '500.00', typed: false, focused: true },
            { kind: 'angle', text: '90', typed: false, focused: false },
        ]);
    });

    it('takes typed distance and angle, and X,Y, relative to the base point; # makes them absolute', () => {
        const polar = start();
        type(polar.editor, '4000,1800');
        type(polar.editor, '100<90');
        const centre = tableCentre(polar.history);
        expect(centre.x).toBeCloseTo(4000);
        expect(centre.y).toBeCloseTo(1900);
        const cartesian = start();
        type(cartesian.editor, '4000,1800');
        type(cartesian.editor, '100,-50');
        expect(tableCentre(cartesian.history)).toEqual({ x: 4100, y: 1750 });
        const absolute = start();
        type(absolute.editor, '4000,1800');
        type(absolute.editor, '#0,0');
        expect(tableCentre(absolute.history)).toEqual({ x: 0, y: 0 });
    });

    it('goes a lone distance along the polar path, like direct distance entry', () => {
        const { editor, history } = start();
        type(editor, '3000,1000');
        // 4 px right of the vertical path from the base point, where nothing snaps
        editor.pointerMove(at({ x: 3008, y: 1600 }));
        expect(editor.snapshot.polar?.angle).toBe(90);
        type(editor, '250');
        expect(tableCentre(history)).toEqual({ x: 4000, y: 2050 });
    });

    it('binds the preview to a typed distance; after Tab the cursor still chooses the direction and a click takes it', () => {
        const { editor, history } = start();
        type(editor, '4000,1800');
        editor.pointerMove(at(EMPTY));
        type(editor, '300\t', false);
        expect(editor.snapshot.dynamicInput).toMatchObject({ bound: true });
        expect(editor.snapshot.dynamicInput?.fields).toMatchObject([
            { text: '300', typed: true, focused: false },
            { kind: 'angle', typed: false, focused: true },
        ]);
        expect(editor.snapshot.input).toBe('300<');
        const preview = editor.snapshot.previewPoint!;
        expect(Math.hypot(preview.x - 4000, preview.y - 1800)).toBeCloseTo(300);
        // Towards the cursor
        expect(preview.x).toBeLessThan(4000);
        click(editor, EMPTY);
        const centre = tableCentre(history);
        expect(centre.x).toBeCloseTo(preview.x);
        expect(centre.y).toBeCloseTo(preview.y);
    });

    it('goes along a typed angle as far as the cursor is from the base point', () => {
        const { editor } = start();
        type(editor, '4000,1800');
        type(editor, '<90', false);
        editor.pointerMove(at(EMPTY));
        const distance = Math.hypot(1000, 200);
        expect(editor.snapshot.previewPoint?.x).toBeCloseTo(4000);
        expect(editor.snapshot.previewPoint?.y).toBeCloseTo(1800 + distance);
        expect(texts(editor)).toEqual([distance.toFixed(2), '90']);
    });

    it('takes a typed X at the base point with the Y at the cursor', () => {
        const { editor } = start();
        editor.pointerMove(at(EMPTY));
        type(editor, '1234', false);
        expect(editor.snapshot.dynamicInput).toMatchObject({ point: { x: 1234, y: 2000 }, bound: true });
        type(editor, '');
        expect(editor.snapshot.basePoint).toEqual({ x: 1234, y: 2000 });
    });

    it('cycles the snap points with Tab while nothing is typed, and moves between the fields once something is', () => {
        const { editor } = start();
        editor.pointerMove(at(EMPTY));
        editor.keyDown({ key: 'Tab' });
        expect(editor.snapshot.dynamicInput?.fields[0].focused).toBe(true);
        type(editor, '5\t', false);
        expect(editor.snapshot.dynamicInput?.fields[1].focused).toBe(true);
        type(editor, '\t', false);
        expect(editor.snapshot.dynamicInput?.fields[0].focused).toBe(true);
    });

    it('takes an option keyword typed into a field', () => {
        const { editor, history } = start();
        type(editor, 'V');
        expect(editor.snapshot.prompt).toBe('Verschiebung angeben <0,0>:');
        expect(editor.snapshot.dynamicInput).toMatchObject({ layout: 'pointer', format: 'cartesian' });
        type(editor, '500,0');
        expect(tableCentre(history)).toEqual({ x: 4500, y: 1800 });
    });

    it('shows the typed text on the command line; Backspace edits, Esc drops it and then cancels', () => {
        const { editor } = start();
        type(editor, '12,3', false);
        expect(editor.snapshot.input).toBe('12,3');
        editor.keyDown({ key: 'Backspace' });
        expect(editor.snapshot.input).toBe('12,');
        editor.keyDown({ key: 'Backspace' });
        expect(editor.snapshot.input).toBe('12');
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: 'MOVE', input: '' });
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*', dynamicInput: null });
    });

    it('reports text that is neither a point nor an option, and keeps the prompt', () => {
        const { editor } = start();
        type(editor, '1,x');
        expect(editor.snapshot).toMatchObject({ prompt: BASE_POINT_PROMPT, message: INVALID, input: '' });
    });

    it('types on the command line as before while off, and shows the parts that are on', () => {
        const { editor, history } = start();
        editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, pointerInput: false });
        expect(editor.snapshot.dynamicInput).toBeNull();
        type(editor, '4000,1800');
        expect(editor.snapshot.dynamicInput?.layout).toBe('dimension');
        editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, enabled: false });
        expect(editor.snapshot.dynamicInput).toBeNull();
        // Absolute again, as on the command line
        type(editor, '0,0');
        expect(tableCentre(history)).toEqual({ x: 0, y: 0 });
    });

    it('drops the typed text when switched', () => {
        const { editor } = start();
        type(editor, '12', false);
        editor.setDynamicInputSettings({ ...DEFAULT_DYNAMIC_INPUT_SETTINGS, dimensionInput: false });
        expect(editor.snapshot.input).toBe('');
        expect(editor.snapshot.dynamicInput?.fields[0].typed).toBe(false);
    });
});
