import type { CadDocument } from '../../model/CadDocument';
import type { Id, Point } from '../../model/Point';
import type { EditorKeyEvent } from '../CadEditor';
import type { Command } from '../commands/Command';
import type { SnapMarker } from '../EditorView';
import type { Handle } from '../selectionHandles';
import type { SelectionManager } from '../SelectionManager';

export interface ToolPointerEvent {
    /** CSS pixels relative to the canvas. */
    viewPoint: Point;
    /** Model space (mm, Y up). */
    modelPoint: Point;
    /** Size of one screen pixel in model units (mm), for screen-space tolerances. */
    pixelSize: number;
    button: number;
    shiftKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}

/** What tools may use from the editor. */
export interface ToolContext {
    readonly selection: SelectionManager;
    /** Committed document; commands and previews are computed against it. */
    readonly document: CadDocument;
    hitTest(viewPoint: Point): Id | null;
    /** Handles of the current selection, at their (preview) positions. */
    handles(): Handle[];
    setActiveHandle(handleId: string | null): void;
    /** Whether dragged points snap to vertices and derived points; toggled by the user. */
    readonly snapEnabled: boolean;
    /** Shows the snap marker, or hides it with null. */
    setSnapIndicator(marker: SnapMarker | null): void;
    /** Shows the command's result without adding it to the history. */
    preview(command: Command): void;
    /** Executes the previewed command as one undo step. */
    commitPreview(): void;
    cancelPreview(): void;
}

export interface Tool {
    readonly cursor: string;
    onPointerDown?(event: ToolPointerEvent): void;
    onPointerMove?(event: ToolPointerEvent): void;
    onPointerUp?(event: ToolPointerEvent): void;
    onPointerLeave?(): void;
    /** Returns true if the key was handled. */
    onKeyDown?(event: EditorKeyEvent): boolean;
    /** Abort any interaction in progress, e.g. before undo. */
    onCancel?(): void;
    onDeactivate?(): void;
}
