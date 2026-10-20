import { describe, expect, it, vi } from 'vitest';
import type { Point } from '../model/Point';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import type { EditorPointerEvent } from './EditorPointerEvent';
import { SelectionEditor } from './SelectionEditor';

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
const WALL = { x: 3000, y: 0 };
const TABLE = { x: 4600, y: 1800 };
const EMPTY = { x: 3000, y: 2000 };

const create = () => new SelectionEditor(parseDocument(samplePlan));
/** Press and release at the same point. */
const click = (editor: SelectionEditor, point: Point, change: Partial<EditorPointerEvent> = {}) => {
    editor.pointerDown(at(point, change));
    editor.pointerUp(at(point, change));
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

describe('SelectionEditor AUSWAHL command (verb-noun)', () => {
    it('shows the prompts of the command line', () => {
        const editor = create();
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', message: null });
        editor.startSelectCommand();
        expect(editor.snapshot).toMatchObject({ command: 'AUSWAHL', prompt: 'AUSWAHL Objekte wählen:', message: null });
    });

    it('adds and removes elements with messages, without grips', () => {
        const editor = create();
        editor.startSelectCommand();
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

    it('takes over the pickfirst selection and hides its grips', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, TABLE);
        editor.startSelectCommand();
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer'], E.table]);
        expect(editor.snapshot.grips).toEqual([]);
        expect(editor.snapshot.message).toBe('2 gefunden');
    });

    it('ends with Enter: the result becomes the previous selection and nothing stays highlighted', () => {
        const editor = create();
        editor.startSelectCommand();
        click(editor, TABLE);
        expect(editor.keyDown({ key: 'Enter' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: null, prompt: 'Befehl:', message: null });
        expect(editor.snapshot.highlighted.size).toBe(0);
        expect(ids(editor.previous)).toEqual([E.table]);
    });

    it('ends with a right click like Enter', () => {
        const editor = create();
        editor.startSelectCommand();
        click(editor, WALL);
        click(editor, EMPTY, { button: 2 });
        expect(editor.snapshot.command).toBeNull();
        expect(ids(editor.previous)).toEqual([E['wall-outer']]);
    });

    it('cancels with Escape and keeps the previous selection', () => {
        const editor = create();
        editor.startSelectCommand();
        click(editor, WALL);
        editor.keyDown({ key: 'Enter' });
        editor.startSelectCommand();
        click(editor, TABLE);
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: null, message: '*Abbruch*' });
        expect(editor.snapshot.highlighted.size).toBe(0);
        expect(ids(editor.previous)).toEqual([E['wall-outer']]);
    });

    it('ignores a second start while the command runs', () => {
        const editor = create();
        editor.startSelectCommand();
        click(editor, WALL);
        editor.startSelectCommand();
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
    });

    it('does not treat a right click without a command as anything', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, EMPTY, { button: 2 });
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
        expect(editor.keyDown({ key: 'Enter' })).toBe(false);
    });
});

describe('SelectionEditor window and crossing rectangles', () => {
    /** Around the table; the rug (x 3000–5000, y 1100–2500) sticks out of it. */
    const LOWER_LEFT = { x: 3300, y: 1100 };
    const UPPER_RIGHT = { x: 4700, y: 2500 };

    it('starts a rectangle on a click into empty space and follows the cursor', () => {
        const editor = create();
        click(editor, LOWER_LEFT);
        expect(editor.snapshot.prompt).toBe('Entgegengesetzte Ecke angeben:');
        editor.pointerMove(at(UPPER_RIGHT));
        expect(editor.snapshot.area).toEqual({ shape: 'rect', mode: 'window', first: LOWER_LEFT, second: UPPER_RIGHT });
        editor.pointerMove(at({ x: 3000, y: 1000 }));
        expect(editor.snapshot.area?.mode).toBe('crossing');
    });

    it('selects by window when spanned to the right', () => {
        const editor = create();
        click(editor, LOWER_LEFT);
        editor.pointerMove(at(UPPER_RIGHT));
        click(editor, UPPER_RIGHT);
        expect(editor.snapshot.area).toBeNull();
        expect(editor.snapshot.prompt).toBe('Befehl:');
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
        expect(editor.snapshot.grips).toHaveLength(5);
    });

    it('selects by crossing when spanned to the left', () => {
        const editor = create();
        click(editor, UPPER_RIGHT);
        editor.pointerMove(at(LOWER_LEFT));
        click(editor, LOWER_LEFT);
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table, E.rug]);
    });

    it('ends the rectangle with the next click even on an element', () => {
        const editor = create();
        click(editor, { x: 4700, y: 1000 });
        // On the table outline: ends a crossing rectangle that cuts table and rug
        click(editor, TABLE);
        expect(editor.snapshot.area).toBeNull();
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table, E.rug]);
    });

    it('removes the found elements with Shift', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, TABLE);
        click(editor, UPPER_RIGHT);
        click(editor, LOWER_LEFT, { shiftKey: true });
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
    });

    it('reports the counts while AUSWAHL runs', () => {
        const editor = create();
        editor.startSelectCommand();
        click(editor, TABLE);
        click(editor, UPPER_RIGHT);
        click(editor, LOWER_LEFT);
        expect(editor.snapshot.message).toBe('2 gefunden (1 doppelt), 2 gesamt');
        expect(editor.snapshot.prompt).toBe('AUSWAHL Objekte wählen:');
        click(editor, UPPER_RIGHT);
        click(editor, LOWER_LEFT, { shiftKey: true });
        expect(editor.snapshot.message).toBe('2 gefunden, 2 entfernt, 0 gesamt');
    });

    it('drops just the rectangle with Escape or Enter', () => {
        const editor = create();
        editor.startSelectCommand();
        click(editor, TABLE);
        click(editor, EMPTY);
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot).toMatchObject({ command: 'AUSWAHL', area: null, prompt: 'AUSWAHL Objekte wählen:' });
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
        click(editor, EMPTY);
        expect(editor.keyDown({ key: 'Enter' })).toBe(true);
        expect(editor.snapshot.command).toBe('AUSWAHL');
    });

    it('ignores a right click while the rectangle is open', () => {
        const editor = create();
        editor.startSelectCommand();
        click(editor, EMPTY);
        click(editor, EMPTY, { button: 2 });
        expect(editor.snapshot.command).toBe('AUSWAHL');
        expect(editor.snapshot.area).not.toBeNull();
    });

    it('shows no rollover while the rectangle is open', () => {
        const editor = create();
        click(editor, EMPTY);
        editor.pointerMove(at(WALL));
        expect(editor.snapshot.hovered.size).toBe(0);
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
        expect(editor.snapshot.area?.shape).toBe('rect');
        editor.pointerMove(at(AROUND_TABLE[1]));
        expect(editor.snapshot.area).toMatchObject({ shape: 'lasso', mode: 'window' });
        expect(editor.snapshot.prompt).toBe('Lasso – Leertaste wechselt Fenster/Kreuzen');
    });

    it('keeps a rectangle open when the press is released without dragging', () => {
        const editor = create();
        editor.pointerDown(at(AROUND_TABLE[0], ALT));
        editor.pointerMove(at({ x: 3302, y: 1102 }));
        editor.pointerUp(at({ x: 3302, y: 1102 }));
        expect(editor.snapshot.area?.shape).toBe('rect');
        // Moving afterwards spans the rectangle, it does not start a lasso
        editor.pointerMove(at(AROUND_TABLE[2]));
        expect(editor.snapshot.area?.shape).toBe('rect');
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

    it('reports the counts while AUSWAHL runs', () => {
        const editor = create();
        editor.startSelectCommand();
        drag(editor, AROUND_TABLE_LEFTWARDS, ALT);
        expect(editor.snapshot.message).toBe('2 gefunden, 2 gesamt');
        expect(editor.snapshot.prompt).toBe('AUSWAHL Objekte wählen:');
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

describe('SelectionEditor dragged rectangle', () => {
    const LOWER_LEFT = { x: 3300, y: 1100 };
    const UPPER_RIGHT = { x: 4700, y: 2500 };

    it('spans a rectangle while dragging and selects by window on release to the right', () => {
        const editor = create();
        editor.pointerDown(at(LOWER_LEFT));
        editor.pointerMove(at(UPPER_RIGHT));
        expect(editor.snapshot.area).toMatchObject({ shape: 'rect', mode: 'window' });
        editor.pointerUp(at(UPPER_RIGHT));
        expect(editor.snapshot.area).toBeNull();
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table]);
    });

    it('selects by crossing on release to the left', () => {
        const editor = create();
        drag(editor, [UPPER_RIGHT, { x: 4000, y: 1800 }, LOWER_LEFT]);
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table, E.rug]);
    });

    it('removes the found elements with Shift on release', () => {
        const editor = create();
        click(editor, WALL);
        click(editor, TABLE);
        drag(editor, [LOWER_LEFT, UPPER_RIGHT], { shiftKey: true });
        expect(ids(editor.snapshot.highlighted)).toEqual([E['wall-outer']]);
    });

    it('reports the counts while AUSWAHL runs', () => {
        const editor = create();
        editor.startSelectCommand();
        drag(editor, [UPPER_RIGHT, LOWER_LEFT]);
        expect(editor.snapshot.message).toBe('2 gefunden, 2 gesamt');
    });

    it('drops a dragged rectangle when the browser cancels the press', () => {
        const editor = create();
        editor.pointerDown(at(LOWER_LEFT));
        editor.pointerMove(at(UPPER_RIGHT));
        editor.pointerCancel();
        expect(editor.snapshot.area).toBeNull();
        expect(editor.snapshot.highlighted.size).toBe(0);
    });

    it('keeps a clicked rectangle open when the browser cancels a later press', () => {
        const editor = create();
        click(editor, LOWER_LEFT);
        editor.pointerCancel();
        expect(editor.snapshot.area?.shape).toBe('rect');
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
        drag(editor, [
            { x: 985, y: 1160 },
            { x: 1015, y: 225 },
        ]);
        expect(ids(editor.snapshot.highlighted)).toEqual(DOOR);
    });

    it('counts group members in the command line messages', () => {
        const editor = create();
        editor.startSelectCommand();
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

    it('previews the rectangle of a click too, until the second click', () => {
        const editor = create();
        click(editor, UPPER_RIGHT);
        editor.pointerMove(at(LOWER_LEFT));
        expect(ids(editor.snapshot.hovered)).toEqual([E.table, E.rug]);
        click(editor, LOWER_LEFT);
        expect(editor.snapshot.hovered.size).toBe(0);
        expect(ids(editor.snapshot.highlighted)).toEqual([E.table, E.rug]);
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
