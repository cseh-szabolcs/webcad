import { describe, expect, it, vi } from 'vitest';
import samplePlan from '../__fixtures__/sample-plan.json';
import type { Id, Point } from '../model/Point';
import { parseDocument } from '../persistence/CadSerializer';
import { CadEditor, type EditorKeyEvent } from './CadEditor';
import type { EditorView } from './EditorView';
import type { ToolPointerEvent } from './tools/Tool';

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

function click(editor: CadEditor, x = 10, y = 10, shiftKey = false) {
    editor.pointerDown(pointer(x, y, { shiftKey }));
    editor.pointerUp(pointer(x, y, { shiftKey }));
}

function drag(editor: CadEditor, from: Point, to: Point, release = true) {
    editor.pointerDown(pointer(from.x, from.y));
    editor.pointerMove(pointer((from.x + to.x) / 2, (from.y + to.y) / 2));
    editor.pointerMove(pointer(to.x, to.y));
    if (release) {
        editor.pointerUp(pointer(to.x, to.y));
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
        const { editor, view } = setup('table');

        click(editor);
        expect([...editor.selection.selected]).toEqual(['table']);
        expect(view.renderSelection).toHaveBeenLastCalledWith(
            new Set(['table']),
            null,
            [expect.objectContaining({ id: 't-center' })],
            null,
        );

        view.hitTest.mockReturnValue(null);
        click(editor, 3000, 3000);
        expect(editor.selection.selected.size).toBe(0);
    });

    it('extends the selection with shift', () => {
        const { editor, view } = setup('table');
        click(editor);
        view.hitTest.mockReturnValue('sofa');
        click(editor, 10, 10, true);
        expect([...editor.selection.selected]).toEqual(['table', 'sofa']);
    });

    it('reduces a multi-selection to the clicked element on click without drag', () => {
        const { editor, view } = setup('table');
        click(editor);
        view.hitTest.mockReturnValue('sofa');
        click(editor, 10, 10, true);

        view.hitTest.mockReturnValue('table');
        click(editor);
        expect([...editor.selection.selected]).toEqual(['table']);
    });

    it('deletes the selection, undoes and redoes via keyboard', () => {
        const { editor, view } = setup('door-leaf');
        click(editor);

        expect(editor.handleKeyDown(key('Backspace'))).toBe(true);
        expect(editor.document.elements.map((e) => e.id)).not.toContain('door-leaf');
        expect(view.updateElements).toHaveBeenLastCalledWith(editor.document, new Set(['door-leaf']));
        expect(editor.selection.selected.size).toBe(0);
        expect(editor.getSnapshot()).toMatchObject({ canUndo: true, undoLabel: 'Delete element', selectionCount: 0 });

        editor.handleKeyDown(key('z', { metaKey: true }));
        expect(editor.document).toEqual(doc);
        expect(editor.getSnapshot()).toMatchObject({ canUndo: false, canRedo: true });

        editor.handleKeyDown(key('z', { ctrlKey: true, shiftKey: true }));
        expect(editor.document.elements.map((e) => e.id)).not.toContain('door-leaf');
    });

    it('ignores delete without a selection and leaves unknown keys unhandled', () => {
        const editor = new CadEditor(doc);
        editor.handleKeyDown(key('Delete'));
        expect(editor.getSnapshot().canUndo).toBe(false);
        expect(editor.handleKeyDown(key('a'))).toBe(false);
    });

    it('keeps the snapshot identity while nothing UI-relevant changes', () => {
        const { editor } = setup('table');
        const listener = vi.fn();
        editor.subscribe(listener);
        const before = editor.getSnapshot();

        editor.selection.setHovered('sofa');
        expect(listener).toHaveBeenCalled();
        expect(editor.getSnapshot()).toBe(before);

        click(editor);
        expect(editor.getSnapshot()).not.toBe(before);
        expect(editor.getSnapshot().selectionCount).toBe(1);
    });

    it('resets history and selection when loading a document', () => {
        const { editor, view } = setup('table');
        click(editor);
        editor.deleteSelection();

        editor.loadDocument(doc);
        expect(editor.getSnapshot()).toMatchObject({ canUndo: false, canRedo: false, selectionCount: 0 });
        expect(view.setDocument).toHaveBeenLastCalledWith(doc);
    });
});

describe('CadEditor moving', () => {
    it('previews a selection drag without touching document or history', () => {
        const { editor, view } = setup('table');
        drag(editor, { x: 10, y: 10 }, { x: 110, y: 60 }, false);

        expect(editor.document).toBe(doc);
        expect(editor.getSnapshot().canUndo).toBe(false);
        const [previewDoc, ids] = view.updateElements.mock.lastCall!;
        expect(previewDoc.vertices.find((v: { id: Id }) => v.id === 't-center')).toMatchObject({ x: 4100, y: 1850 });
        expect(ids).toEqual(new Set(['table']));
    });

    it('commits one undo step on release and undoes it', () => {
        const { editor } = setup('table');
        drag(editor, { x: 10, y: 10 }, { x: 110, y: 60 });

        expect(vertex(editor, 't-center')).toMatchObject({ x: 4100, y: 1850 });
        expect(editor.getSnapshot()).toMatchObject({ canUndo: true, undoLabel: 'Move' });

        editor.undo();
        expect(editor.document).toEqual(doc);
        expect(editor.getSnapshot().canUndo).toBe(false);
    });

    it('moves shared vertices for all elements that use them', () => {
        const { editor, view } = setup('door-leaf');
        drag(editor, { x: 0, y: 0 }, { x: 50, y: 0 });

        expect(vertex(editor, 'd-open')).toMatchObject({ x: 1050, y: 1140 });
        expect(view.updateElements).toHaveBeenLastCalledWith(editor.document, new Set(['door-leaf', 'door-swing']));
    });

    it('cancels the preview with Escape', () => {
        const { editor, view } = setup('table');
        drag(editor, { x: 10, y: 10 }, { x: 110, y: 60 }, false);

        expect(editor.handleKeyDown(key('Escape'))).toBe(true);
        expect(view.updateElements).toHaveBeenLastCalledWith(doc, ['table']);
        editor.pointerUp(pointer(110, 60));

        expect(editor.document).toBe(doc);
        expect(editor.getSnapshot().canUndo).toBe(false);
        expect([...editor.selection.selected]).toEqual(['table']); // Escape only cancelled the drag
    });

    it('ignores movements below the drag threshold', () => {
        const { editor, view } = setup('table');
        drag(editor, { x: 10, y: 10 }, { x: 12, y: 11 });

        expect(editor.getSnapshot().canUndo).toBe(false);
        expect(view.updateElements).not.toHaveBeenCalled();
    });

    it('drags a handle to move just that vertex', () => {
        const { editor, view } = setup('wall-outer');
        click(editor);
        view.hitTest.mockReturnValue(null);

        // Handle of the corner w-o2 at (6000, 0); 4 mm away is within the 6 px hit radius
        drag(editor, { x: 6004, y: 0 }, { x: 6104, y: -100 });

        expect(vertex(editor, 'w-o2')).toMatchObject({ x: 6100, y: -100 });
        expect(vertex(editor, 'w-o3')).toMatchObject({ x: 6000, y: 4000 });
        expect(editor.getSnapshot().undoLabel).toBe('Move vertex');
        expect([...editor.selection.selected]).toEqual(['wall-outer']);
    });

    it('marks the handle under the pointer as active', () => {
        const { editor, view } = setup('wall-outer');
        click(editor);
        editor.pointerMove(pointer(6002, 1));
        expect(view.renderSelection.mock.lastCall![3]).toBe('w-o2');
    });

    it('aborts a drag in progress on undo', () => {
        const { editor } = setup('table');
        drag(editor, { x: 10, y: 10 }, { x: 110, y: 60 });
        drag(editor, { x: 10, y: 10 }, { x: 210, y: 10 }, false);

        editor.undo();
        expect(editor.document).toEqual(doc);
        editor.pointerUp(pointer(210, 10));
        expect(editor.document).toEqual(doc);
        expect(editor.getSnapshot()).toMatchObject({ canUndo: false, canRedo: true });
    });
});
