import type { EditorKeyEvent, EditorPointerEvent } from 'app/cad/editor/EditorPointerEvent';
import type { Point } from 'app/cad/model/Point';
import type { Viewport } from 'app/cad/renderer/Viewport';

const WHEEL_ZOOM_SPEED = 0.0015;
const LINE_HEIGHT_PX = 16;

/** Receives the pointer input that is not viewport navigation, i.e. the editor. */
export interface InputTarget {
    pointerDown(event: EditorPointerEvent): void;
    pointerMove(event: EditorPointerEvent): void;
    pointerUp(event: EditorPointerEvent): void;
    /** The browser aborted a press, e.g. to start a native drag. */
    pointerCancel(): void;
    pointerLeave(): void;
    /** Returns true if the key was handled. */
    keyDown(event: EditorKeyEvent): boolean;
}

export interface CanvasInputOptions {
    getViewport: () => Viewport;
    onViewportChange: (viewport: Viewport) => void;
    target: InputTarget;
    /** Pointer position in view px, also reported while panning. */
    onPointerMove?: (viewPoint: Point) => void;
    onPointerLeave?: () => void;
    /**
     * Drawn cursor that replaces the system pointer over the canvas; hidden while panning
     * (the grab hand shows instead) and while the pointer is outside.
     */
    crosshair?: {
        moveTo(viewPoint: Point): void;
        hide(): void;
        /** Shift is held, so picks remove from the selection. */
        setRemoving(removing: boolean): void;
    };
}

/**
 * Single owner of canvas input. Wheel zooms around the cursor; middle drag or Space + left
 * drag pans; other pointer input goes to the target. Keys go to the target first, and a key
 * it handles does nothing else (Tab at a point prompt cycles the snap points instead of
 * moving the browser focus; typed text goes to the command line); its default is prevented,
 * so later listeners can tell. Space only pans if the target does not use it (e.g. to toggle
 * a lasso or end typed text). Returns a function that removes all listeners.
 */
export function attachCanvasInput(canvas: HTMLCanvasElement, options: CanvasInputOptions): () => void {
    const { getViewport, onViewportChange, target, onPointerMove, onPointerLeave, crosshair } = options;
    let spaceHeld = false;
    let panning: { pointerId: number; x: number; y: number } | null = null;
    /** Pointer whose left press went to the target and whose release is still due. */
    let pressedPointer: number | null = null;
    /** Last pointer position in view px while it is over the canvas. */
    let pointer: Point | null = null;
    /** Shift held: picks remove from the selection, which the crosshair shows. */
    let shiftHeld = false;

    /** System cursor and drawn crosshair for the current state. */
    const updateCursor = () => {
        const navigating = panning !== null || spaceHeld;
        const cursor = panning ? 'grabbing' : spaceHeld ? 'grab' : crosshair ? 'none' : 'crosshair';
        if (canvas.style.cursor !== cursor) {
            canvas.style.cursor = cursor;
        }
        if (!crosshair) {
            return;
        }
        crosshair.setRemoving(shiftHeld);
        if (pointer && !navigating) {
            crosshair.moveTo(pointer);
        } else {
            crosshair.hide();
        }
    };

    const toViewPoint = (event: MouseEvent): Point => {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const toEditorEvent = (event: MouseEvent): EditorPointerEvent => {
        const viewPoint = toViewPoint(event);
        const viewport = getViewport();
        return {
            viewPoint,
            modelPoint: viewport.viewToModel(viewPoint),
            pixelSize: 1 / viewport.scale,
            button: event.button,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
        };
    };

    const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * LINE_HEIGHT_PX : event.deltaY;
        onViewportChange(getViewport().zoomAt(toViewPoint(event), Math.exp(-delta * WHEEL_ZOOM_SPEED)));
        // The pick box changes its size in model space, so the hovered element may change
        if (!panning) {
            target.pointerMove(toEditorEvent(event));
        }
    };

    const onPointerDown = (event: PointerEvent) => {
        if (event.button === 1 || (event.button === 0 && spaceHeld)) {
            event.preventDefault();
            canvas.setPointerCapture(event.pointerId);
            panning = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            target.pointerLeave();
            updateCursor();
            return;
        }
        // No text selection or native drag, which would abort the press
        event.preventDefault();
        // Keeps a lasso receiving moves and the release outside the canvas
        canvas.setPointerCapture(event.pointerId);
        if (event.button === 0) {
            pressedPointer = event.pointerId;
        }
        target.pointerDown(toEditorEvent(event));
    };

    const onPointerMoveEvent = (event: PointerEvent) => {
        if (panning?.pointerId === event.pointerId) {
            const dx = event.clientX - panning.x;
            const dy = event.clientY - panning.y;
            panning = { ...panning, x: event.clientX, y: event.clientY };
            onViewportChange(getViewport().panBy(dx, dy));
        } else if (!panning) {
            // The release got lost (e.g. outside the window): end the press before moving on
            if (pressedPointer === event.pointerId && (event.buttons & 1) === 0) {
                pressedPointer = null;
                target.pointerUp({ ...toEditorEvent(event), button: 0 });
            }
            target.pointerMove(toEditorEvent(event));
        }
        // A captured pointer keeps reporting moves outside the canvas
        pointer = isInside(event) ? toViewPoint(event) : null;
        // Also catches Shift pressed or released while another window had the focus
        shiftHeld = event.shiftKey;
        updateCursor();
        onPointerMove?.(toViewPoint(event));
    };

    const isInside = (event: MouseEvent) => {
        const { x, y } = toViewPoint(event);
        return x >= 0 && y >= 0 && x <= canvas.clientWidth && y <= canvas.clientHeight;
    };

    const onPointerUp = (event: PointerEvent) => {
        if (panning) {
            if (panning.pointerId === event.pointerId) {
                panning = null;
                // The pointer may have been released outside, where no pointerleave follows any more
                if (isInside(event)) {
                    pointer = toViewPoint(event);
                    target.pointerMove(toEditorEvent(event));
                } else {
                    pointer = null;
                    onPointerLeave?.();
                }
                updateCursor();
            }
            return;
        }
        if (event.button === 0) {
            pressedPointer = null;
        }
        target.pointerUp(toEditorEvent(event));
        if (!isInside(event)) {
            pointer = null;
            updateCursor();
            target.pointerLeave();
            onPointerLeave?.();
        }
    };

    const onPointerCancel = (event: PointerEvent) => {
        if (panning?.pointerId === event.pointerId) {
            panning = null;
            updateCursor();
        } else if (pressedPointer === event.pointerId) {
            pressedPointer = null;
            target.pointerCancel();
        }
    };

    const onPointerLeaveEvent = () => {
        if (!panning) {
            pointer = null;
            updateCursor();
            target.pointerLeave();
            onPointerLeave?.();
        }
    };

    const isTextInput = (event: KeyboardEvent) =>
        event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]') !== null;

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Shift') {
            shiftHeld = true;
            updateCursor();
        }
        if (isTextInput(event)) {
            return;
        }
        if (event.code === 'Space') {
            // Also keeps a focused toolbar button from being activated
            event.preventDefault();
            // A held key repeats; only the first press counts
            if (!event.repeat && !target.keyDown({ key: ' ' })) {
                spaceHeld = true;
                updateCursor();
            }
            return;
        }
        const ctrlKey = (event.ctrlKey || event.metaKey) && !event.altKey;
        if (target.keyDown({ key: event.key, shiftKey: event.shiftKey, ctrlKey })) {
            event.preventDefault();
        }
    };

    const onKeyUp = (event: KeyboardEvent) => {
        if (event.key === 'Shift') {
            shiftHeld = false;
            updateCursor();
        }
        if (event.code === 'Space' && !isTextInput(event)) {
            event.preventDefault();
            spaceHeld = false;
            updateCursor();
        }
    };

    const onBlur = () => {
        spaceHeld = false;
        shiftHeld = false;
        updateCursor();
    };

    // Keeps the browser's middle-click autoscroll from starting
    const onMouseDown = (event: MouseEvent) => {
        if (event.button === 1) {
            event.preventDefault();
        }
    };

    // Right click belongs to the editor (it will end selections), not to the browser menu
    const onContextMenu = (event: MouseEvent) => event.preventDefault();

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMoveEvent);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('pointerleave', onPointerLeaveEvent);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    updateCursor();

    return () => {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('contextmenu', onContextMenu);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMoveEvent);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerCancel);
        canvas.removeEventListener('pointerleave', onPointerLeaveEvent);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
    };
}
