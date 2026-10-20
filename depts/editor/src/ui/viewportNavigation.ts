import type { Point } from 'app/cad/model/Point';
import type { Viewport } from 'app/cad/renderer/Viewport';

const WHEEL_ZOOM_SPEED = 0.0015;
const LINE_HEIGHT_PX = 16;

export interface ViewportNavigationOptions {
    getViewport: () => Viewport;
    onViewportChange: (viewport: Viewport) => void;
    /** Pointer position in view px, also reported while panning. */
    onPointerMove?: (viewPoint: Point) => void;
    onPointerLeave?: () => void;
}

/**
 * Viewport navigation on a canvas: wheel zooms around the cursor, middle drag or
 * Space + left drag pans. Returns a function that removes all listeners.
 */
export function attachViewportNavigation(canvas: HTMLCanvasElement, options: ViewportNavigationOptions): () => void {
    const { getViewport, onViewportChange, onPointerMove, onPointerLeave } = options;
    let spaceHeld = false;
    let panning: { pointerId: number; x: number; y: number } | null = null;

    const updateCursor = () => {
        const cursor = panning ? 'grabbing' : spaceHeld ? 'grab' : 'crosshair';
        if (canvas.style.cursor !== cursor) {
            canvas.style.cursor = cursor;
        }
    };

    const toViewPoint = (event: MouseEvent): Point => {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * LINE_HEIGHT_PX : event.deltaY;
        onViewportChange(getViewport().zoomAt(toViewPoint(event), Math.exp(-delta * WHEEL_ZOOM_SPEED)));
    };

    const onPointerDown = (event: PointerEvent) => {
        if (event.button === 1 || (event.button === 0 && spaceHeld)) {
            event.preventDefault();
            canvas.setPointerCapture(event.pointerId);
            panning = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            updateCursor();
        }
    };

    const onPointerMoveEvent = (event: PointerEvent) => {
        if (panning?.pointerId === event.pointerId) {
            const dx = event.clientX - panning.x;
            const dy = event.clientY - panning.y;
            panning = { ...panning, x: event.clientX, y: event.clientY };
            onViewportChange(getViewport().panBy(dx, dy));
        }
        onPointerMove?.(toViewPoint(event));
    };

    const onPointerUp = (event: PointerEvent) => {
        if (panning?.pointerId === event.pointerId) {
            panning = null;
            updateCursor();
        }
    };

    const onPointerLeaveEvent = () => {
        if (!panning) {
            onPointerLeave?.();
        }
    };

    const isTextInput = (event: KeyboardEvent) =>
        event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]') !== null;

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.code === 'Space' && !isTextInput(event)) {
            // Also keeps a focused toolbar button from being activated
            event.preventDefault();
            spaceHeld = true;
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

    // Keeps the browser's middle-click autoscroll from starting
    const onMouseDown = (event: MouseEvent) => {
        if (event.button === 1) {
            event.preventDefault();
        }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMoveEvent);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeaveEvent);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    updateCursor();

    return () => {
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMoveEvent);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        canvas.removeEventListener('pointerleave', onPointerLeaveEvent);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
    };
}
