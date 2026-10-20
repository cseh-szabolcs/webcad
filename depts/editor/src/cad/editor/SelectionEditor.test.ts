import { describe, expect, it, vi } from 'vitest';
import type { Point } from '../model/Point';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import type { EditorPointerEvent } from './EditorPointerEvent';
import { SelectionEditor } from './SelectionEditor';

const { element: E } = sampleIds;

/** One screen pixel is 2 mm, so the 5 px pick box reaches 10 mm. */
const at = (modelPoint: Point, change: Partial<EditorPointerEvent> = {}): EditorPointerEvent => ({
    viewPoint: { x: 0, y: 0 },
    modelPoint,
    pixelSize: 2,
    button: 0,
    shiftKey: false,
    ...change,
});
const WALL = { x: 3000, y: 0 };
const TABLE = { x: 4600, y: 1800 };
const EMPTY = { x: 3000, y: 2000 };

const create = () => new SelectionEditor(parseDocument(samplePlan));
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
        editor.pointerDown(at(WALL));
        expect(editor.snapshot.hovered.size).toBe(0);
        editor.pointerDown(at(WALL, { shiftKey: true }));
        expect(ids(editor.snapshot.hovered)).toEqual([E['wall-outer']]);
    });
});

describe('SelectionEditor pickfirst selection', () => {
    it('adds clicked elements to the selection', () => {
        const editor = create();
        editor.pointerDown(at(WALL));
        editor.pointerDown(at(TABLE));
        editor.pointerDown(at(WALL));
        expect(ids(editor.snapshot.selected)).toEqual([E['wall-outer'], E.table]);
    });

    it('removes an element with Shift+click and ignores Shift+click on unselected ones', () => {
        const editor = create();
        editor.pointerDown(at(WALL));
        editor.pointerDown(at(TABLE));
        editor.pointerDown(at(WALL, { shiftKey: true }));
        editor.pointerDown(at({ x: 1600, y: 2600 }, { shiftKey: true }));
        expect(ids(editor.snapshot.selected)).toEqual([E.table]);
    });

    it('keeps the selection on a click into empty space and on other buttons', () => {
        const editor = create();
        editor.pointerDown(at(WALL));
        editor.pointerDown(at(EMPTY));
        editor.pointerDown(at(TABLE, { button: 2 }));
        expect(ids(editor.snapshot.selected)).toEqual([E['wall-outer']]);
    });

    it('clears the selection with Escape', () => {
        const editor = create();
        editor.pointerDown(at(TABLE));
        expect(editor.keyDown({ key: 'Escape' })).toBe(true);
        expect(editor.snapshot.selected.size).toBe(0);
        expect(editor.snapshot.grips).toEqual([]);
        expect(editor.keyDown({ key: 'Escape' })).toBe(false);
    });

    it('shows the grips of the selected elements', () => {
        const editor = create();
        editor.pointerDown(at(TABLE));
        expect(editor.snapshot.grips).toHaveLength(5);
        editor.pointerDown(at(WALL));
        expect(editor.snapshot.grips).toHaveLength(5 + 8);
        editor.pointerDown(at(TABLE, { shiftKey: true }));
        expect(editor.snapshot.grips).toHaveLength(8);
    });
});
