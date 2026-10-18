import type { EditorKeyEvent } from './CadEditor';
import type { ToolPointerEvent } from './tools/Tool';
import type { Viewport } from '../renderer/Viewport';

const WHEEL_ZOOM_SPEED = 0.0015;
const LINE_HEIGHT_PX = 16;

/** Receives everything that is not viewport navigation, i.e. the editor. */
export interface InputTarget {
    readonly cursor: string;
    pointerDown(event: ToolPointerEvent): void;
    pointerMove(event: ToolPointerEvent): void;
    pointerUp(event: ToolPointerEvent): void;
    pointerLeave(): void;
    handleKeyDown(event: EditorKeyEvent): boolean;
}

export interface CanvasInputOptions {
    getViewport: () => Viewport;
    onViewportChange: (viewport: Viewport) => void;
    target: InputTarget;
}

/**
 * Single owner of canvas input. Wheel zooms around the cursor; middle drag or
 * Space + left drag pans; all other pointer and key events go to the target.
 * Returns a function that removes all listeners.
 */
export function attachCanvasInput(canvas: HTMLCanvasElement, options: CanvasInputOptions): () => void {
    const { getViewport, onViewportChange, target } = options;
    let spaceHeld = false;
    let panning: { pointerId: number; x: number; y: number } | null = null;

    const updateCursor = () => {
        const cursor = panning ? 'grabbing' : spaceHeld ? 'grab' : target.cursor;
        if (canvas.style.cursor !== cursor) {
            canvas.style.cursor = cursor;
        }
    };

    const toToolEvent = (event: PointerEvent): ToolPointerEvent => {
        const rect = canvas.getBoundingClientRect();
        const viewPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const viewport = getViewport();
        return {
            viewPoint,
            modelPoint: viewport.viewToModel(viewPoint),
            pixelSize: 1 / viewport.scale,
            button: event.button,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
        };
    };

    const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * LINE_HEIGHT_PX : event.deltaY;
        const rect = canvas.getBoundingClientRect();
        const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        onViewportChange(getViewport().zoomAt(anchor, Math.exp(-delta * WHEEL_ZOOM_SPEED)));
    };

    const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        if (event.button === 1 || (event.button === 0 && spaceHeld)) {
            panning = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            updateCursor();
            return;
        }
        target.pointerDown(toToolEvent(event));
        updateCursor();
    };

    const onPointerMove = (event: PointerEvent) => {
        if (panning) {
            if (panning.pointerId === event.pointerId) {
                const dx = event.clientX - panning.x;
                const dy = event.clientY - panning.y;
                panning = { ...panning, x: event.clientX, y: event.clientY };
                onViewportChange(getViewport().panBy(dx, dy));
            }
            return;
        }
        target.pointerMove(toToolEvent(event));
        updateCursor();
    };

    const onPointerUp = (event: PointerEvent) => {
        if (panning) {
            if (panning.pointerId === event.pointerId) {
                panning = null;
                updateCursor();
            }
            return;
        }
        target.pointerUp(toToolEvent(event));
        updateCursor();
    };

    const onPointerLeave = () => {
        if (!panning) {
            target.pointerLeave();
        }
    };

    const isTextInput = (event: KeyboardEvent) =>
        event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]') !== null;

    const onKeyDown = (event: KeyboardEvent) => {
        if (isTextInput(event)) {
            return;
        }
        if (event.code === 'Space') {
            // Also keeps a focused toolbar button from being activated
            event.preventDefault();
            spaceHeld = true;
            updateCursor();
            return;
        }
        if (target.handleKeyDown(event)) {
            event.preventDefault();
            updateCursor();
        }
    };

    const onKeyUp = (event: KeyboardEvent) => {
        if (event.code === 'Space' && !isTextInput(event)) {
            event.preventDefault();
            spaceHeld = false;
            updateCursor();
        }
    };

    const onBlur = () => {
        spaceHeld = false;
        updateCursor();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    updateCursor();

    return () => {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
    };
}
