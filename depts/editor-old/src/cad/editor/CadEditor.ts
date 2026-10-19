import type { CadDocument } from '../model/CadDocument';
import { createId } from '../model/createId';
import type { Id, Point } from '../model/Point';
import type { Command, CommandResult } from './commands/Command';
import { CommandManager } from './commands/CommandManager';
import { DeleteElementsCommand } from './commands/DeleteElementsCommand';
import { GroupElementsCommand } from './commands/GroupElementsCommand';
import { UngroupCommand } from './commands/UngroupCommand';
import type { EditorView, SnapMarker } from './EditorView';
import { selectionHandles, type Handle } from './selectionHandles';
import { SelectionManager } from './SelectionManager';
import { SelectTool } from './tools/SelectTool';
import type { Tool, ToolContext, ToolPointerEvent } from './tools/Tool';

const HIT_TOLERANCE_PX = 6;

export type EditorKeyEvent = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>;

/** UI-facing state. A new object is only created when a value changes. */
export interface EditorSnapshot {
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string | null;
    redoLabel: string | null;
    selectionCount: number;
    snapEnabled: boolean;
    /** At least two elements are selected and they are not already exactly one group. */
    canGroup: boolean;
    /** At least one selected element is grouped. */
    canUngroup: boolean;
}

/**
 * Owns the document, the command history, the selection and the active tool.
 * Independent of React and Paper.js; rendering goes through an EditorView.
 */
export class CadEditor implements ToolContext {
    readonly selection = new SelectionManager();
    private readonly history = new CommandManager();
    private readonly listeners = new Set<() => void>();
    private doc: CadDocument;
    private view: EditorView | null = null;
    private tool: Tool;
    private snapshot: EditorSnapshot;
    private previewState: { command: Command; result: CommandResult } | null = null;
    private activeHandle: string | null = null;
    private snapIndicator: SnapMarker | null = null;
    private snapOn = true;

    constructor(doc: CadDocument) {
        this.doc = doc;
        this.tool = new SelectTool(this);
        this.snapshot = this.createSnapshot();
        this.selection.subscribe(() => {
            this.renderSelection();
            this.emit();
        });
    }

    get document(): CadDocument {
        return this.doc;
    }

    /** The document as currently shown: the preview while dragging, otherwise the document. */
    get displayDocument(): CadDocument {
        return this.previewState?.result.document ?? this.doc;
    }

    get snapEnabled(): boolean {
        return this.snapOn;
    }

    /** Snapping is a session setting; it is not saved with the document. */
    toggleSnap(): void {
        this.snapOn = !this.snapOn;
        this.emit();
    }

    get cursor(): string {
        return this.tool.cursor;
    }

    loadDocument(doc: CadDocument): void {
        this.abortInteraction();
        this.doc = doc;
        this.history.clear();
        this.view?.setDocument(doc);
        this.selection.clear();
        this.renderSelection();
        this.emit();
    }

    attachView(view: EditorView): void {
        this.view = view;
        view.setDocument(this.doc);
        this.renderSelection();
    }

    detachView(): void {
        this.view = null;
    }

    execute(command: Command): void {
        this.apply(this.history.execute(command, this.doc));
    }

    undo(): void {
        this.abortInteraction();
        this.apply(this.history.undo(this.doc));
    }

    redo(): void {
        this.abortInteraction();
        this.apply(this.history.redo(this.doc));
    }

    preview(command: Command): void {
        const result = command.execute(this.doc);
        const ids = new Set([...(this.previewState?.result.changedElementIds ?? []), ...result.changedElementIds]);
        this.previewState = { command, result };
        this.view?.updateElements(result.document, ids);
        this.renderSelection();
    }

    commitPreview(): void {
        const preview = this.previewState;
        if (!preview) {
            return;
        }
        this.previewState = null;
        this.apply(this.history.execute(preview.command, this.doc), preview.result.changedElementIds);
    }

    cancelPreview(): void {
        const preview = this.previewState;
        if (!preview) {
            return;
        }
        this.previewState = null;
        this.view?.updateElements(this.doc, preview.result.changedElementIds);
        this.renderSelection();
    }

    handles(): Handle[] {
        return selectionHandles(this.displayDocument, this.selection.selected);
    }

    setActiveHandle(handleId: string | null): void {
        if (handleId !== this.activeHandle) {
            this.activeHandle = handleId;
            this.renderSelection();
        }
    }

    setSnapIndicator(marker: SnapMarker | null): void {
        const current = this.snapIndicator;
        if (marker?.x !== current?.x || marker?.y !== current?.y || marker?.derived !== current?.derived) {
            this.snapIndicator = marker;
            this.renderSelection();
        }
    }

    deleteSelection(): void {
        this.abortInteraction();
        if (this.selection.selected.size > 0) {
            this.execute(new DeleteElementsCommand(this.selection.selected));
        }
    }

    /** Puts the selection into a new group; the selection stays as it is. */
    groupSelection(): void {
        this.abortInteraction();
        if (this.createSnapshot().canGroup) {
            const group = { id: createId(), name: nextGroupName(this.doc) };
            this.execute(new GroupElementsCommand(this.selection.selected, group));
        }
    }

    /** Dissolves the groups of the selected elements; their members stay selected. */
    ungroupSelection(): void {
        this.abortInteraction();
        if (this.createSnapshot().canUngroup) {
            this.execute(new UngroupCommand(this.selection.selected));
        }
    }

    hitTest(viewPoint: Point): Id | null {
        return this.view?.hitTest(viewPoint, HIT_TOLERANCE_PX) ?? null;
    }

    pointerDown(event: ToolPointerEvent): void {
        this.tool.onPointerDown?.(event);
    }

    pointerMove(event: ToolPointerEvent): void {
        this.tool.onPointerMove?.(event);
    }

    pointerUp(event: ToolPointerEvent): void {
        this.tool.onPointerUp?.(event);
    }

    pointerLeave(): void {
        this.tool.onPointerLeave?.();
    }

    /** Returns true if the key was handled and its default action should be prevented. */
    handleKeyDown(event: EditorKeyEvent): boolean {
        if (this.tool.onKeyDown?.(event)) {
            return true;
        }
        const mod = event.metaKey || event.ctrlKey;
        const key = event.key.toLowerCase();
        if (mod && key === 'g') {
            if (event.shiftKey) {
                this.ungroupSelection();
            } else {
                this.groupSelection();
            }
            return true;
        }
        if (mod && key === 'z') {
            if (event.shiftKey) {
                this.redo();
            } else {
                this.undo();
            }
            return true;
        }
        if (event.key === 'F3') {
            this.toggleSnap();
            return true;
        }
        if (event.ctrlKey && key === 'y') {
            this.redo();
            return true;
        }
        if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) {
            this.deleteSelection();
            return true;
        }
        if (event.key === 'Escape') {
            this.selection.clear();
            return true;
        }
        return false;
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    getSnapshot = (): EditorSnapshot => this.snapshot;

    /** Ends a drag in progress without committing it. */
    private abortInteraction(): void {
        this.tool.onCancel?.();
        this.cancelPreview();
    }

    private apply(result: CommandResult | null, alsoChanged: Iterable<Id> = []): void {
        if (!result) {
            return;
        }
        this.doc = result.document;
        this.view?.updateElements(this.doc, new Set([...alsoChanged, ...result.changedElementIds]));
        this.selection.prune(this.doc);
        // Items may have been rebuilt, so the overlay is redrawn even if the selection is unchanged
        this.renderSelection();
        this.emit();
    }

    private renderSelection(): void {
        this.view?.renderSelection({
            selected: this.selection.selected,
            hovered: this.selection.hovered,
            handles: this.handles(),
            activeHandle: this.activeHandle,
            snap: this.snapIndicator,
        });
    }

    private emit(): void {
        const next = this.createSnapshot();
        const current = this.snapshot;
        const changed = (Object.keys(next) as (keyof EditorSnapshot)[]).some((key) => next[key] !== current[key]);
        if (changed) {
            this.snapshot = next;
        }
        this.listeners.forEach((listener) => listener());
    }

    private createSnapshot(): EditorSnapshot {
        const selectedGroupIds = new Set(
            this.doc.elements
                .filter((element) => this.selection.selected.has(element.id))
                .map((element) => element.groupId),
        );
        return {
            canUndo: this.history.canUndo,
            canRedo: this.history.canRedo,
            undoLabel: this.history.undoLabel,
            redoLabel: this.history.redoLabel,
            selectionCount: this.selection.selected.size,
            snapEnabled: this.snapOn,
            canGroup: this.selection.selected.size > 1 && (selectedGroupIds.size > 1 || selectedGroupIds.has(null)),
            canUngroup: [...selectedGroupIds].some((groupId) => groupId !== null),
        };
    }
}

/** "Group N" with the smallest N not used by an existing group name. */
function nextGroupName(doc: CadDocument): string {
    const names = new Set(doc.groups.map((group) => group.name));
    let n = 1;
    while (names.has(`Group ${n}`)) {
        n++;
    }
    return `Group ${n}`;
}
