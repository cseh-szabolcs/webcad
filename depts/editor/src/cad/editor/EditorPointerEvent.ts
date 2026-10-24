import type { Point } from '../model/Point';

/** Canvas pointer input as the editor sees it. */
export interface EditorPointerEvent {
    /** CSS pixels relative to the canvas. */
    viewPoint: Point;
    /** Model space (mm, Y up). */
    modelPoint: Point;
    /** Size of one screen pixel in mm, for screen-space tolerances. */
    pixelSize: number;
    /** 0 left, 2 right; the middle button never reaches the editor (it pans). */
    button: number;
    shiftKey: boolean;
    /** Option on macOS. */
    altKey: boolean;
}

export interface EditorKeyEvent {
    key: string;
    /** Shift+Enter ends an open selection rectangle by removing what it finds. */
    shiftKey?: boolean;
}
