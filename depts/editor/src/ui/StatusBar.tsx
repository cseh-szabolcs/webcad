import type { Point } from 'app/cad/model/Point';
import type { Viewport } from 'app/cad/renderer/Viewport';

interface StatusBarProps {
    viewport: Viewport | null;
    /** Pointer position in view px, or null when it is outside the canvas. */
    pointer: Point | null;
}

/** Cursor position in model space and the zoom level, like the demo1 status line. */
export function StatusBar({ viewport, pointer }: StatusBarProps) {
    const model = viewport && pointer ? viewport.viewToModel(pointer) : null;

    return (
        <footer className="statusbar">
            <b>{model ? `X ${formatCoordinate(model.x)}  Y ${formatCoordinate(model.y)}` : 'X –  Y –'}</b>
            <span>Fang: –</span>
            {viewport && <span>Zoom {viewport.scale.toFixed(3)} px/mm</span>}
        </footer>
    );
}

/** One decimal, without a negative zero. */
function formatCoordinate(value: number): string {
    return (Math.round(value * 10) / 10 + 0).toFixed(1);
}
