import { describe, expect, it, vi } from 'vitest';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import type { Id, Point } from '../model/Point';
import { parseDocument } from '../persistence/CadSerializer';
import { CadEditor, type EditorKeyEvent } from './CadEditor';
import type { EditorView } from './EditorView';
import type { ToolPointerEvent } from './tools/Tool';

const { vertex: V, element: E } = sampleIds;

const doc = parseDocument(samplePlan);

function fakeView(hit: Id | null = null) {
    return {
        setDocument: vi.fn(),
        updateElements: vi.fn(),
        hitTest: vi.fn((_point: Point, _tolerance: number) => hit),
        renderSelection: vi.fn(),
    } satisfies EditorView;
}

function setup(hit: Id | null = null) {
    const editor = new CadEditor(doc);
    const view = fakeView(hit);
    editor.attachView(view);
    return { editor, view };
}

/**
 * Pointer event where view and model coordinates coincide (1 px = 1 mm, Y ignored for
 * the tests' purposes), so drag distances read the same in both spaces.
 */
function pointer(x: number, y: number, extra: Partial<ToolPointerEvent> = {}): ToolPointerEvent {
    return {
        viewPoint: { x, y },
        modelPoint: { x, y },
        pixelSize: 1,
        button: 0,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        ...extra,
    };
}

type Modifiers = Partial<Pick<ToolPointerEvent, 'shiftKey' | 'altKey'>>;

function click(editor: CadEditor, x = 10, y = 10, shiftKey = false, modifiers: Modifiers = {}) {
    editor.pointerDown(pointer(x, y, { shiftKey, ...modifiers }));
    editor.pointerUp(pointer(x, y, { shiftKey, ...modifiers }));
}

function drag(editor: CadEditor, from: Point, to: Point, release = true, modifiers: Modifiers = {}) {
    editor.pointerDown(pointer(from.x, from.y, modifiers));
    editor.pointerMove(pointer((from.x + to.x) / 2, (from.y + to.y) / 2, modifiers));
    editor.pointerMove(pointer(to.x, to.y, modifiers));
    if (release) {
        editor.pointerUp(pointer(to.x, to.y, modifiers));
    }
}

function key(key: string, modifiers: Partial<EditorKeyEvent> = {}): EditorKeyEvent {
    return { key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...modifiers };
}

const vertex = (editor: CadEditor, id: Id) => editor.document.vertices.find((v) => v.id === id)!;

describe('CadEditor selection and deletion', () => {
    it('renders the document when a view is attached', () => {
        const { view } = setup();
        expect(view.setDocument).toHaveBeenCalledWith(doc);
    });

    it('selects the element under the pointer and clears on empty clicks', () => {
        const { editor, view } = setup(E.table);

        click(editor);
        expect([...editor.selection.selected]).toEqual([E.table]);
        expect(view.renderSelection).toHaveBeenLastCalledWith({
            selected: new Set([E.table]),
            hovered: new Set(),
            handles: [V['t-center'], `${E.table}#right`, `${E.table}#top`, `${E.table}#left`, `${E.table}#bottom`].map(
                (id) => expect.objectContaining({ id }),
            ),
            activeHandle: null,
            snap: null,
        });

        view.hitTest.mockReturnValue(null);
        click(editor, 3000, 3000);
        expect(editor.selection.selected.size).toBe(0);
    });

    it('extends the selection with shift', () => {
        const { editor, view } = setup(E.table);
        click(editor);
        view.hitTest.mockReturnValue(E.sofa);
        click(editor, 10, 10, true);
        expect([...editor.selection.selected]).toEqual([E.table, E.sofa]);
    });

    it('reduces a multi-selection to the clicked element on click without drag', () => {
        const { editor, view } = setup(E.table);
        click(editor);
        view.hitTest.mockReturnValue(E.sofa);
        click(editor, 10, 10, true);

        view.hitTest.mockReturnValue(E.table);
        click(editor);
        expect([...editor.selection.selected]).toEqual([E.table]);
    });

    it('selects and toggles a group as one unit', () => {
        const { editor, view } = setup(E['door-leaf']);
        click(editor);
        expect(editor.selection.selected).toEqual(new Set([E['door-leaf'], E['door-swing']]));

        view.hitTest.mockReturnValue(E.table);
        click(editor, 10, 10, true);
        view.hitTest.mockReturnValue(E['door-swing']);
        click(editor, 10, 10, true);
        expect(editor.selection.selected).toEqual(new Set([E.table]));

        click(editor, 10, 10, true);
        expect(editor.selection.selected).toEqual(new Set([E.table, E['door-leaf'], E['door-swing']]));

        click(editor);
        expect(editor.selection.selected).toEqual(new Set([E['door-leaf'], E['door-swing']]));
    });

    it('deletes the selection, undoes and redoes via keyboard', () => {
        const { editor, view } = setup(E.window);
        click(editor);

        expect(editor.handleKeyDown(key('Backspace'))).toBe(true);
        expect(editor.document.elements.map((e) => e.id)).not.toContain(E.window);
        expect(view.updateElements).toHaveBeenLastCalledWith(editor.document, new Set([E.window]));
        expect(editor.selection.selected.size).toBe(0);
        expect(editor.getSnapshot()).toMatchObject({ canUndo: true, undoLabel: 'Delete element', selectionCount: 0 });

        editor.handleKeyDown(key('z', { metaKey: true }));
        expect(editor.document).toEqual(doc);
        expect(editor.getSnapshot()).toMatchObject({ canUndo: false, canRedo: true });

        editor.handleKeyDown(key('z', { ctrlKey: true, shiftKey: true }));
        expect(editor.document.elements.map((e) => e.id)).not.toContain(E.window);
    });

    it('ignores delete without a selection and leaves unknown keys unhandled', () => {
        const editor = new CadEditor(doc);
        editor.handleKeyDown(key('Delete'));
        expect(editor.getSnapshot().canUndo).toBe(false);
        expect(editor.handleKeyDown(key('a'))).toBe(false);
    });

    it('keeps the snapshot identity while nothing UI-relevant changes', () => {
        const { editor } = setup(E.table);
        const listener = vi.fn();
        editor.subscribe(listener);
        const before = editor.getSnapshot();

        editor.selection.setHovered([E.sofa]);
        expect(listener).toHaveBeenCalled();
        expect(editor.getSnapshot()).toBe(before);

        click(editor);
        expect(editor.getSnapshot()).not.toBe(before);
        expect(editor.getSnapshot().selectionCount).toBe(1);
    });

    it('resets history and selection when loading a document', () => {
        const { editor, view } = setup(E.table);
        click(editor);
        editor.deleteSelection();

        editor.loadDocument(doc);
        expect(editor.getSnapshot()).toMatchObject({ canUndo: false, canRedo: false, selectionCount: 0 });
        expect(view.setDocument).toHaveBeenLastCalledWith(doc);
    });
});

describe('CadEditor grouping', () => {
    function selectTableAndSofa() {
        const { editor, view } = setup(E.table);
        click(editor);
        view.hitTest.mockReturnValue(E.sofa);
        click(editor, 10, 10, true);
        return { editor, view };
    }

    it('groups the selection with Cmd/Ctrl+G so it selects as one, and undoes it', () => {
        const { editor, view } = selectTableAndSofa();
        expect(editor.getSnapshot()).toMatchObject({ canGroup: true, canUngroup: false });

        expect(editor.handleKeyDown(key('g', { metaKey: true }))).toBe(true);
        const group = editor.document.groups.at(-1)!;
        expect(group.name).toBe('Group 1');
        expect(editor.getSnapshot()).toMatchObject({ undoLabel: 'Group', canGroup: false, canUngroup: true });

        editor.selection.clear();
        view.hitTest.mockReturnValue(E.table);
        click(editor);
        expect(editor.selection.selected).toEqual(new Set([E.table, E.sofa]));

        editor.undo();
        expect(editor.document).toEqual(doc);
    });

    it('ungroups with Cmd/Ctrl+Shift+G and keeps the members selected', () => {
        const { editor } = setup(E['door-leaf']);
        click(editor);
        expect(editor.getSnapshot()).toMatchObject({ canGroup: false, canUngroup: true });

        expect(editor.handleKeyDown(key('G', { ctrlKey: true, shiftKey: true }))).toBe(true);
        expect(editor.document.groups).toEqual([]);
        expect(editor.selection.selected).toEqual(new Set([E['door-leaf'], E['door-swing']]));
        expect(editor.getSnapshot()).toMatchObject({ undoLabel: 'Ungroup', canGroup: true, canUngroup: false });

        click(editor);
        expect(editor.selection.selected).toEqual(new Set([E['door-leaf']]));
    });

    it('selects and toggles a single group member with Alt', () => {
        const { editor, view } = setup(E['door-swing']);
        click(editor, 10, 10, false, { altKey: true });
        expect(editor.selection.selected).toEqual(new Set([E['door-swing']]));

        click(editor);
        view.hitTest.mockReturnValue(E['door-leaf']);
        click(editor, 10, 10, true, { altKey: true });
        expect(editor.selection.selected).toEqual(new Set([E['door-swing']]));
    });

    it('moves only the Alt-dragged member and keeps the group', () => {
        const { editor, view } = setup(E['door-swing']);
        drag(editor, { x: 0, y: 0 }, { x: 100, y: 0 }, true, { altKey: true });

        expect(editor.selection.selected).toEqual(new Set([E['door-swing']]));
        expect(vertex(editor, V['d-closed'])).toMatchObject({ x: 2000, y: 240 });
        // door-leaf shares d-hinge and d-open with the arc, so it is redrawn as well
        expect(view.updateElements).toHaveBeenLastCalledWith(editor.document, new Set([E['door-leaf'], E['door-swing']]));
        expect(editor.document.groups).toEqual(doc.groups);
    });

    it('hovers the whole group, or with Alt just the element', () => {
        const { editor, view } = setup(E['door-leaf']);
        editor.pointerMove(pointer(10, 10));
        expect(editor.selection.hovered).toEqual(new Set([E['door-leaf'], E['door-swing']]));
        expect(view.renderSelection.mock.lastCall![0].hovered).toBe(editor.selection.hovered);

        editor.pointerMove(pointer(11, 10, { altKey: true }));
        expect(editor.selection.hovered).toEqual(new Set([E['door-leaf']]));

        view.hitTest.mockReturnValue(null);
        editor.pointerMove(pointer(12, 10));
        expect(editor.selection.hovered.size).toBe(0);
    });

    it('ignores grouping a single element', () => {
        const { editor } = setup(E.table);
        click(editor);
        editor.groupSelection();
        editor.ungroupSelection();
        expect(editor.getSnapshot().canUndo).toBe(false);
    });
});

describe('CadEditor moving', () => {
    it('previews a selection drag without touching document or history', () => {
        const { editor, view } = setup(E.table);
        drag(editor, { x: 10, y: 10 }, { x: 110, y: 60 }, false);

        expect(editor.document).toBe(doc);
        expect(editor.getSnapshot().canUndo).toBe(false);
        const [previewDoc, ids] = view.updateElements.mock.lastCall!;
        expect(previewDoc.vertices.find((v: { id: Id }) => v.id === V['t-center'])).toMatchObject({ x: 4100, y: 1850 });
        expect(ids).toEqual(new Set([E.table]));
    });

    it('commits one undo step on release and undoes it', () => {
        const { editor } = setup(E.table);
        drag(editor, { x: 10, y: 10 }, { x: 110, y: 60 });

        expect(vertex(editor, V['t-center'])).toMatchObject({ x: 4100, y: 1850 });
        expect(editor.getSnapshot()).toMatchObject({ canUndo: true, undoLabel: 'Move' });

        editor.undo();
        expect(editor.document).toEqual(doc);
        expect(editor.getSnapshot().canUndo).toBe(false);
    });

    it('moves shared vertices for all elements that use them', () => {
        const { editor, view } = setup(E.axis);
        drag(editor, { x: 0, y: 0 }, { x: 50, y: 0 });

        expect(vertex(editor, V['w-i1'])).toMatchObject({ x: 290, y: 240 });
        expect(view.updateElements).toHaveBeenLastCalledWith(
            editor.document,
            new Set([E['wall-outer'], E['wall-inner'], E.axis]),
        );
    });

    it('moves a group as a whole when one member is dragged', () => {
        const { editor } = setup(E['door-leaf']);
        drag(editor, { x: 0, y: 0 }, { x: 100, y: 50 });

        expect(vertex(editor, V['d-hinge'])).toMatchObject({ x: 1100, y: 290 });
        expect(vertex(editor, V['d-closed'])).toMatchObject({ x: 2000, y: 290 });
        expect(vertex(editor, V['d-open'])).toMatchObject({ x: 1100, y: 1190 });
        expect(editor.getSnapshot()).toMatchObject({ canUndo: true, undoLabel: 'Move' });
    });

    it('cancels the preview with Escape', () => {
        const { editor, view } = setup(E.table);
        drag(editor, { x: 10, y: 10 }, { x: 110, y: 60 }, false);

        expect(editor.handleKeyDown(key('Escape'))).toBe(true);
        expect(view.updateElements).toHaveBeenLastCalledWith(doc, [E.table]);
        editor.pointerUp(pointer(110, 60));

        expect(editor.document).toBe(doc);
        expect(editor.getSnapshot().canUndo).toBe(false);
        expect([...editor.selection.selected]).toEqual([E.table]); // Escape only cancelled the drag
    });

    it('ignores movements below the drag threshold', () => {
        const { editor, view } = setup(E.table);
        drag(editor, { x: 10, y: 10 }, { x: 12, y: 11 });

        expect(editor.getSnapshot().canUndo).toBe(false);
        expect(view.updateElements).not.toHaveBeenCalled();
    });

    it('drags a handle to move just that vertex', () => {
        const { editor, view } = setup(E['wall-outer']);
        click(editor);
        view.hitTest.mockReturnValue(null);

        // Handle of the corner w-o2 at (6000, 0); 4 mm away is within the 6 px hit radius
        drag(editor, { x: 6004, y: 0 }, { x: 6104, y: -100 });

        expect(vertex(editor, V['w-o2'])).toMatchObject({ x: 6100, y: -100 });
        expect(vertex(editor, V['w-o3'])).toMatchObject({ x: 6000, y: 4000 });
        expect(editor.getSnapshot().undoLabel).toBe('Move vertex');
        expect([...editor.selection.selected]).toEqual([E['wall-outer']]);
    });

    it('snaps a dragged vertex onto a nearby vertex without connecting them', () => {
        const { editor, view } = setup(E.window);
        click(editor);
        view.hitTest.mockReturnValue(null);

        // Handle win-2 at (5000, 3880) towards the outer wall corner w-o3 at (6000, 4000)
        drag(editor, { x: 5000, y: 3880 }, { x: 6005, y: 3995 }, false);
        expect(view.renderSelection.mock.lastCall![0].snap).toEqual({ x: 6000, y: 4000, derived: false });

        editor.pointerUp(pointer(6005, 3995));
        expect(view.renderSelection.mock.lastCall![0].snap).toBeNull();
        expect(vertex(editor, V['win-2'])).toMatchObject({ x: 6000, y: 4000 });
        expect(editor.document.vertices).toHaveLength(doc.vertices.length);
        expect(editor.document.elements.find((e) => e.id === E.window)).toMatchObject({ endVertexId: V['win-2'] });
        expect(editor.getSnapshot().undoLabel).toBe('Move vertex');

        editor.undo();
        expect(editor.document).toEqual(doc);
    });

    it('snaps onto a derived midpoint and marks it as derived', () => {
        const { editor, view } = setup(E.table);
        click(editor);
        view.hitTest.mockReturnValue(null);

        // Table centre t-center at (4000, 1800) towards the window midpoint (4250, 3880)
        drag(editor, { x: 4000, y: 1800 }, { x: 4253, y: 3877 }, false);
        expect(view.renderSelection.mock.lastCall![0].snap).toEqual({ x: 4250, y: 3880, derived: true });

        editor.pointerUp(pointer(4253, 3877));
        expect(vertex(editor, V['t-center'])).toMatchObject({ x: 4250, y: 3880 });
        expect(editor.document.vertices).toHaveLength(doc.vertices.length);
    });

    it('does not snap after F3 turns snapping off', () => {
        const { editor, view } = setup(E.window);
        expect(editor.getSnapshot().snapEnabled).toBe(true);
        expect(editor.handleKeyDown(key('F3'))).toBe(true);
        expect(editor.getSnapshot().snapEnabled).toBe(false);

        click(editor);
        view.hitTest.mockReturnValue(null);
        drag(editor, { x: 5000, y: 3880 }, { x: 6005, y: 3995 });

        expect(vertex(editor, V['win-2'])).toMatchObject({ x: 6005, y: 3995 });
        expect(view.renderSelection.mock.calls.every(([state]) => state.snap === null)).toBe(true);
    });

    it('marks the handle under the pointer as active', () => {
        const { editor, view } = setup(E['wall-outer']);
        click(editor);
        editor.pointerMove(pointer(6002, 1));
        expect(view.renderSelection.mock.lastCall![0].activeHandle).toBe(V['w-o2']);
    });

    it('aborts a drag in progress on undo', () => {
        const { editor } = setup(E.table);
        drag(editor, { x: 10, y: 10 }, { x: 110, y: 60 });
        drag(editor, { x: 10, y: 10 }, { x: 210, y: 10 }, false);

        editor.undo();
        expect(editor.document).toEqual(doc);
        editor.pointerUp(pointer(210, 10));
        expect(editor.document).toEqual(doc);
        expect(editor.getSnapshot()).toMatchObject({ canUndo: false, canRedo: true });
    });
});
