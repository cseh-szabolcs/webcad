import type { CadDocument } from '../model/CadDocument';
import { DocumentHistory } from './commands/DocumentHistory';
import { MoveCommand } from './commands/MoveCommand';
import {
    DEFAULT_EDITOR_SETTINGS,
    DEFAULT_SNAP_SETTINGS,
    type EditorSettings,
    type SnapSettings,
} from '../../settings/editorSettings';
import { indexDocument, type DocumentIndex } from '../model/DocumentIndex';
import type { Id, Point } from '../model/Point';
import { rectFromCorners } from '../geometry/selectionGeometry';
import type { EditorKeyEvent, EditorPointerEvent } from './EditorPointerEvent';
import { buildElementShapes } from './selection/ElementShapes';
import { selectionControlFrames, selectionGrips } from './selection/grips';
import { buildSelectionUnits, expandToUnits } from './selection/grouping';
import { pickAt, pickCrossing, pickLasso, pickWindow } from './selection/picking';
import { ShapeIndex } from './selection/ShapeIndex';
import { SnapEngine, SnapMemory, type SnapResult } from './snapping/SnapEngine';

/** How far a press must travel (screen px) before it counts as a drag. */
const DRAG_THRESHOLD_PX = 3;
/** Minimum distance (screen px) between recorded lasso points. */
const LASSO_STEP_PX = 4;

/** SCHIEBEN is AutoCAD's MOVE. */
export type EditorCommand = 'SCHIEBEN';

const PROMPTS = {
    idle: 'Befehl:',
    select: 'SCHIEBEN Objekte wählen:',
    basePoint: 'Basispunkt angeben:',
    secondPoint: 'Zweiten Punkt angeben oder <ersten Punkt als Verschiebung verwenden>:',
    corner: 'Entgegengesetzte Ecke angeben:',
    lasso: 'Lasso – Leertaste wechselt Fenster/Kreuzen',
} as const;

/**
 * What the cursor shows, like AutoCAD: crosshair and pick box with no command, only the pick
 * box while a command selects objects, only the crosshair while it asks for a point.
 */
export type CursorMode = 'command' | 'select' | 'point';

/** Window: only elements completely inside; crossing: everything the area touches. */
export type SelectionMode = 'window' | 'crossing';

/** Selection rectangle or lasso in progress, in model space. */
export type SelectionArea =
    /** Window when spanned to the right, crossing to the left. */
    | { shape: 'rect'; mode: SelectionMode; first: Point; second: Point }
    /** Freehand polygon (Alt + drag), closed implicitly; the start direction sets the mode, Space toggles it. */
    | { shape: 'lasso'; mode: SelectionMode; points: readonly Point[] };

/** What the selection overlay and the UI show. Replaced, never mutated. */
export interface SelectionSnapshot {
    /** Running command, or null while the editor waits for one. */
    command: EditorCommand | null;
    /** Command line prompt. */
    prompt: string;
    /** Last command line message, e.g. "1 gefunden, 2 gesamt". */
    message: string | null;
    /**
     * Selection preview, drawn in the hover style: what a click at the cursor would pick, or
     * while a rectangle or lasso is open, what it would pick now. Groups included, already
     * selected elements left out.
     */
    hovered: ReadonlySet<Id>;
    /** Elements drawn as selected: the pickfirst selection, or the command's selection. */
    highlighted: ReadonlySet<Id>;
    /** Grips of the pickfirst selection; none while a command runs. No function yet. */
    grips: readonly Point[];
    /** Control frame lines shown with the grips (bezier end to its control point). */
    controlFrames: readonly (readonly [Point, Point])[];
    /** Selection rectangle or lasso in progress, or null. */
    area: SelectionArea | null;
    cursor: CursorMode;
    /** Snap point under the cursor during a point prompt, or null. */
    snap: SnapResult | null;
    /** Base point of SCHIEBEN once given, or null. */
    basePoint: Point | null;
    /**
     * At the second point prompt, the point a click would take now (the snap point, else the
     * cursor), for the move preview; null at other prompts and while the pointer is outside.
     */
    previewPoint: Point | null;
    /** Undo and redo are possible now (not while a command runs). */
    canUndo: boolean;
    canRedo: boolean;
}

type State =
    /** No command; clicks build the pickfirst selection (noun-verb). */
    | { kind: 'idle'; pickfirst: ReadonlySet<Id> }
    /** SCHIEBEN selects objects; clicks build the command's selection (verb-noun). */
    | { kind: 'select'; selection: ReadonlySet<Id> }
    /** SCHIEBEN asks for the base point. */
    | { kind: 'basePoint'; selection: ReadonlySet<Id> }
    /** SCHIEBEN asks for the second point. */
    | { kind: 'secondPoint'; selection: ReadonlySet<Id>; basePoint: Point };

/**
 * Object selection and the SCHIEBEN (MOVE) command of the editor like AutoCAD, independent
 * of Paper.js and React.
 *
 * With no command, a click adds the element under the cursor to the pickfirst selection,
 * Shift+click removes it and Esc clears it. SCHIEBEN takes over the pickfirst selection and
 * then asks for the base point right away; without one it first asks for objects: clicks add
 * to or remove from the command's selection, and Enter or a right click ends the selection
 * (the result becomes the "previous" selection; with nothing selected the command ends).
 * The base point and the second point snap to the drawing (see SnapEngine); a click takes
 * the snap point, or the cursor position if there is none. At the second point the snapshot
 * carries the point for the move preview; the click moves the selection as one undo step
 * (see MoveCommand) and ends the command. Esc cancels the command at any prompt. With no
 * command, undo() and redo() step through the document history.
 *
 * The derived structures (outlines, R-tree, groups, snap geometry) follow every document
 * change of the history; they are rebuilt as a whole for now.
 *
 * In both, pressing into empty space and dragging opens a rectangle; a plain click into
 * empty space does nothing. The rectangle stays open after the release, so the view can
 * still be zoomed or panned, and the next click (its opposite corner) or Enter (at the
 * cursor) ends it. To the right it selects by window, to the left by crossing. With Alt
 * held on the press, dragging draws a lasso instead, which ends on release; its start
 * direction picks window or crossing and Space toggles between them. With Shift on the
 * ending click, Enter or release the found elements are removed instead. Esc drops just
 * the rectangle or lasso.
 *
 * Picking a grouped element picks its whole group, also by window, crossing or lasso when
 * only one member qualifies. Never persisted.
 */
export class SelectionEditor {
    private readonly history: DocumentHistory;
    private readonly unsubscribeHistory: () => void;
    private index!: DocumentIndex;
    private shapes!: ShapeIndex;
    /** What a pick of each selectable element selects: its whole group, or itself. */
    private units!: ReadonlyMap<Id, readonly Id[]>;
    private snapEngine!: SnapEngine;
    private snapSettings: SnapSettings = DEFAULT_SNAP_SETTINGS;
    /** Curves touched during the current point prompt (see SnapMemory). */
    private snapMemory = new SnapMemory();
    private snap: SnapResult | null = null;
    /** Last cursor position over the canvas, to snap at once when a point prompt starts. */
    private lastPointer: EditorPointerEvent | null = null;
    private state: State = { kind: 'idle', pickfirst: new Set() };
    private previousSelection: ReadonlySet<Id> = new Set();
    /** Element under the cursor, whether selected or not. */
    private underCursor: Id | null = null;
    private message: string | null = null;
    private area: SelectionArea | null = null;
    /**
     * Press into empty space while the button is held: where it went down (view px and
     * model) and whether Alt was held. Dragging it past the threshold opens the area.
     */
    private press: { viewPoint: Point; modelPoint: Point; alt: boolean } | null = null;
    /** Elements the open area would pick, computed once per area. */
    private areaPreview: { area: SelectionArea; ids: Id[] } | null = null;
    private current: SelectionSnapshot;
    /** Document index the current snapshot was built from. */
    private snapshotIndex: DocumentIndex | null = null;
    private readonly listeners = new Set<() => void>();

    /** Half the pick box side in screen px (see EditorSettings.pickboxSize). */
    private readonly pickboxSize: number;
    /** Half the aperture box side in screen px (see EditorSettings.apertureSize). */
    private readonly apertureSize: number;

    /** Works on the document of `history` (a plain document gets a history of its own). */
    constructor(
        history: DocumentHistory | CadDocument,
        settings: Pick<EditorSettings, 'pickboxSize' | 'apertureSize'> = DEFAULT_EDITOR_SETTINGS,
    ) {
        this.pickboxSize = settings.pickboxSize;
        this.apertureSize = settings.apertureSize;
        this.history = history instanceof DocumentHistory ? history : new DocumentHistory(history);
        this.derive(this.history.document);
        this.unsubscribeHistory = this.history.subscribe(({ document }) => {
            this.derive(document);
            this.changed();
        });
        this.current = this.buildSnapshot(null);
    }

    /** Stops following the history. */
    dispose(): void {
        this.unsubscribeHistory();
        this.listeners.clear();
    }

    get snapshot(): SelectionSnapshot {
        return this.current;
    }

    /** Selection the last SCHIEBEN worked on, for later commands ("Vorherige"). */
    get previous(): ReadonlySet<Id> {
        return this.previousSelection;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Reverts the last command; only with no command running. Returns true if something was undone. */
    undo(): boolean {
        if (this.state.kind !== 'idle' || this.area !== null) {
            return false;
        }
        const command = this.history.undo();
        if (!command) {
            return false;
        }
        this.endCommand(`Rückgängig: ${command.label}`);
        return true;
    }

    /** Runs the last undone command again; only with no command running. */
    redo(): boolean {
        if (this.state.kind !== 'idle' || this.area !== null) {
            return false;
        }
        const command = this.history.redo();
        if (!command) {
            return false;
        }
        this.endCommand(`Wiederherstellen: ${command.label}`);
        return true;
    }

    /**
     * Starts SCHIEBEN: with a pickfirst selection straight at the base point, otherwise by
     * selecting objects. Does nothing while a command runs.
     */
    startMoveCommand(): void {
        if (this.state.kind !== 'idle') {
            return;
        }
        const selection = this.state.pickfirst;
        this.area = null;
        this.press = null;
        if (selection.size > 0) {
            this.askBasePoint(selection);
            this.message = `${selection.size} gefunden`;
        } else {
            this.state = { kind: 'select', selection };
            this.message = null;
        }
        this.changed();
    }

    /** Switches the running object snaps; takes effect at the cursor right away. */
    setSnapSettings(settings: SnapSettings): void {
        this.snapSettings = settings;
        if (this.lastPointer !== null && (this.state.kind === 'basePoint' || this.state.kind === 'secondPoint')) {
            this.snap = this.snapAt(this.lastPointer);
            this.changed();
        }
    }

    pointerDown(event: EditorPointerEvent): void {
        const state = this.state;
        if (state.kind === 'basePoint' || state.kind === 'secondPoint') {
            if (event.button === 0) {
                this.pointGiven(this.snapAt(event)?.point ?? event.modelPoint);
            }
            return;
        }
        if (event.button === 2) {
            if (this.area === null && state.kind === 'select') {
                this.finishSelection();
            }
            return;
        }
        if (event.button !== 0 || this.press !== null) {
            return;
        }
        if (this.area?.shape === 'rect') {
            // The rectangle stayed open after the drag; this click sets its opposite corner
            this.finishRect(this.area.first, event.modelPoint, event.shiftKey);
            return;
        }
        if (this.area !== null) {
            return;
        }
        const id = this.pick(event);
        if (id === null) {
            // Becomes a rectangle or lasso only once dragged; a plain click does nothing
            this.press = { viewPoint: event.viewPoint, modelPoint: event.modelPoint, alt: event.altKey };
            return;
        }
        this.applyPicked([id], event.shiftKey);
    }

    pointerMove(event: EditorPointerEvent): void {
        this.lastPointer = event;
        if (this.state.kind === 'basePoint' || this.state.kind === 'secondPoint') {
            this.snap = this.snapAt(event);
            this.changed();
            return;
        }
        this.underCursor = this.pick(event);
        const press = this.press;
        const area = this.area;
        if (press !== null && area === null) {
            const dx = event.viewPoint.x - press.viewPoint.x;
            const dy = event.viewPoint.y - press.viewPoint.y;
            if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
                const first = press.modelPoint;
                const second = event.modelPoint;
                this.area = press.alt
                    ? { shape: 'lasso', mode: dx >= 0 ? 'window' : 'crossing', points: [first, second] }
                    : { shape: 'rect', mode: areaMode(first, second), first, second };
            }
        } else if (area?.shape === 'rect') {
            this.area = { ...area, mode: areaMode(area.first, event.modelPoint), second: event.modelPoint };
        } else if (area?.shape === 'lasso') {
            const last = area.points[area.points.length - 1];
            const distance = Math.hypot(event.modelPoint.x - last.x, event.modelPoint.y - last.y);
            if (distance >= LASSO_STEP_PX * event.pixelSize) {
                this.area = { ...area, points: [...area.points, event.modelPoint] };
            }
        }
        this.changed();
    }

    /**
     * Ends a lasso. A dragged rectangle stays open, so the view can still be zoomed or panned;
     * the next click or Enter ends it.
     */
    pointerUp(event: EditorPointerEvent): void {
        if (event.button !== 0) {
            return;
        }
        this.press = null;
        const area = this.area;
        if (area?.shape !== 'lasso') {
            return;
        }
        this.area = null;
        const polygon = [...area.points, event.modelPoint];
        if (polygon.length < 3) {
            this.changed();
            return;
        }
        this.applyPicked(pickLasso(this.shapes, polygon, area.mode), event.shiftKey);
    }

    /**
     * The browser aborted the press: drops a lasso without selecting; a rectangle stays open,
     * as after a release.
     */
    pointerCancel(): void {
        this.press = null;
        if (this.area?.shape === 'lasso') {
            this.area = null;
            this.changed();
        }
    }

    pointerLeave(): void {
        this.underCursor = null;
        this.lastPointer = null;
        this.snap = null;
        this.changed();
    }

    /** Returns true if the key was handled. */
    keyDown(event: EditorKeyEvent): boolean {
        const area = this.area;
        if (area?.shape === 'lasso' && event.key === ' ') {
            this.area = { ...area, mode: area.mode === 'window' ? 'crossing' : 'window' };
            this.changed();
            return true;
        }
        if (area?.shape === 'rect' && event.key === 'Enter') {
            this.press = null;
            this.finishRect(area.first, area.second, event.shiftKey ?? false);
            return true;
        }
        if (area !== null && (event.key === 'Escape' || event.key === 'Enter')) {
            this.area = null;
            this.press = null;
            this.changed();
            return true;
        }
        const state = this.state;
        if (state.kind !== 'idle') {
            if (event.key === 'Escape') {
                this.endCommand('*Abbruch*');
                return true;
            }
            // At the point prompts Enter will take the displacement option, not built yet
            if (event.key === 'Enter' && state.kind === 'select') {
                this.finishSelection();
                return true;
            }
            return false;
        }
        if (event.key === 'Escape' && state.pickfirst.size > 0) {
            this.state = { kind: 'idle', pickfirst: new Set() };
            this.changed();
            return true;
        }
        return false;
    }

    /** Ends the object selection of SCHIEBEN: on to the base point, or out if nothing is selected. */
    private finishSelection(): void {
        if (this.state.kind !== 'select') {
            return;
        }
        if (this.state.selection.size === 0) {
            this.endCommand(null);
            return;
        }
        this.askBasePoint(this.state.selection);
        this.message = null;
        this.changed();
    }

    private askBasePoint(selection: ReadonlySet<Id>): void {
        this.previousSelection = selection;
        this.state = { kind: 'basePoint', selection };
        this.underCursor = null;
        this.startPointPrompt();
    }

    /** A click at a point prompt, at the snap point or the cursor. */
    private pointGiven(point: Point): void {
        const state = this.state;
        if (state.kind === 'basePoint') {
            this.state = { kind: 'secondPoint', selection: state.selection, basePoint: point };
            this.startPointPrompt();
            this.message = null;
            this.changed();
        } else if (state.kind === 'secondPoint') {
            const delta = { x: point.x - state.basePoint.x, y: point.y - state.basePoint.y };
            this.endCommand(null);
            // A zero displacement changes nothing, so it leaves no undo step either
            if (delta.x !== 0 || delta.y !== 0) {
                this.history.execute(new MoveCommand(state.selection, delta));
            }
        }
    }

    /** Each point prompt starts with a fresh snap memory; the cursor snaps again on its next move. */
    private startPointPrompt(): void {
        this.snapMemory = new SnapMemory();
        if (this.lastPointer !== null) {
            this.snap = this.snapAt(this.lastPointer);
        }
    }

    private endCommand(message: string | null): void {
        this.state = { kind: 'idle', pickfirst: new Set() };
        this.message = message;
        this.snap = null;
        this.changed();
    }

    /** Builds the structures derived from the document; drops selected elements that are gone. */
    private derive(doc: CadDocument): void {
        this.index = indexDocument(doc);
        this.snapEngine = new SnapEngine(doc);
        const shapes = buildElementShapes(doc);
        this.shapes = new ShapeIndex(shapes);
        this.units = buildSelectionUnits(
            doc,
            shapes.map((shape) => shape.id),
        );
        this.underCursor = null;
        this.areaPreview = null;
        const exists = (ids: ReadonlySet<Id>) => new Set([...ids].filter((id) => this.units.has(id)));
        const state = this.state;
        this.state = state.kind === 'idle' ? { kind: 'idle', pickfirst: exists(state.pickfirst) } : { ...state, selection: exists(state.selection) };
        this.previousSelection = exists(this.previousSelection);
    }

    private snapAt(event: EditorPointerEvent): SnapResult | null {
        if (!this.snapSettings.enabled) {
            return null;
        }
        return this.snapEngine.find(
            {
                cursor: event.modelPoint,
                pixelSize: event.pixelSize,
                aperture: this.apertureSize,
                modes: this.snapSettings.modes,
            },
            this.snapMemory,
        );
    }

    /** Elements the area would pick in its current state, before group expansion. */
    private areaHits(area: SelectionArea): Id[] {
        if (area.shape === 'lasso') {
            return pickLasso(this.shapes, area.points, area.mode);
        }
        const rect = rectFromCorners(area.first, area.second);
        return area.mode === 'window' ? pickWindow(this.shapes, rect) : pickCrossing(this.shapes, rect);
    }

    private finishRect(first: Point, second: Point, remove: boolean): void {
        const rect = rectFromCorners(first, second);
        this.area = null;
        const picked = areaMode(first, second) === 'window' ? pickWindow(this.shapes, rect) : pickCrossing(this.shapes, rect);
        this.applyPicked(picked, remove);
    }

    /**
     * Adds the picked elements and their group members to the current selection, or removes
     * them with `remove`. While SCHIEBEN selects, reports the counts (of elements, members
     * included) on the command line like AutoCAD.
     */
    private applyPicked(hits: readonly Id[], remove: boolean): void {
        const picked = expandToUnits(hits, this.units);
        const state = this.state;
        if (state.kind !== 'idle' && state.kind !== 'select') {
            return;
        }
        const before = state.kind === 'idle' ? state.pickfirst : state.selection;
        const after = new Set(before);
        for (const id of picked) {
            if (remove) {
                after.delete(id);
            } else {
                after.add(id);
            }
        }
        if (state.kind === 'idle') {
            this.state = { kind: 'idle', pickfirst: after };
        } else {
            this.state = { kind: 'select', selection: after };
            const duplicates = picked.filter((id) => before.has(id)).length;
            this.message = remove
                ? `${picked.length} gefunden, ${before.size - after.size} entfernt, ${after.size} gesamt`
                : `${picked.length} gefunden${duplicates > 0 ? ` (${duplicates} doppelt)` : ''}, ${after.size} gesamt`;
        }
        this.changed();
    }

    private pick(event: EditorPointerEvent): Id | null {
        return pickAt(this.shapes, event.modelPoint, this.pickboxSize * event.pixelSize);
    }

    /** Rebuilds the snapshot and notifies if anything visible differs. */
    private changed(): void {
        const next = this.buildSnapshot(this.current);
        if (next !== this.current) {
            this.current = next;
            this.listeners.forEach((listener) => listener());
        }
    }

    /** New snapshot, or `previous` itself when nothing changed; reuses its grips if possible. */
    private buildSnapshot(previous: SelectionSnapshot | null): SelectionSnapshot {
        const state = this.state;
        const command = state.kind === 'idle' ? null : 'SCHIEBEN';
        const highlighted = state.kind === 'idle' ? state.pickfirst : state.selection;
        const pointPrompt = state.kind === 'basePoint' || state.kind === 'secondPoint';
        const basePoint = state.kind === 'secondPoint' ? state.basePoint : null;
        const snap = pointPrompt ? this.snap : null;
        const previewPoint =
            state.kind === 'secondPoint' && this.lastPointer !== null ? (snap?.point ?? this.lastPointer.modelPoint) : null;
        const idle = state.kind === 'idle' && this.area === null;
        const canUndo = idle && this.history.undoCommand !== null;
        const canRedo = idle && this.history.redoCommand !== null;
        const area = this.area;
        let previewed: Id[] = [];
        if (area !== null) {
            // Instead of the rollover, like AutoCAD's selection preview for windows
            if (this.areaPreview?.area !== area) {
                this.areaPreview = { area, ids: expandToUnits(this.areaHits(area), this.units) };
            }
            previewed = this.areaPreview.ids;
        } else {
            this.areaPreview = null;
            // No rollover at point prompts, like AutoCAD
            if (this.underCursor !== null && !pointPrompt) {
                previewed = expandToUnits([this.underCursor], this.units);
            }
        }
        const hovered = new Set(previewed.filter((id) => !highlighted.has(id)));
        // Grips follow the geometry, so a document change rebuilds them
        const sameDocument = this.snapshotIndex === this.index;
        this.snapshotIndex = this.index;
        const sameSelection =
            previous !== null && sameDocument && command === previous.command && sameIds(highlighted, previous.highlighted);
        if (
            sameSelection &&
            this.message === previous.message &&
            area === previous.area &&
            sameIds(hovered, previous.hovered) &&
            sameSnap(snap, previous.snap) &&
            basePoint === previous.basePoint &&
            samePoint(previewPoint, previous.previewPoint) &&
            canUndo === previous.canUndo &&
            canRedo === previous.canRedo
        ) {
            return previous;
        }
        let grips: readonly Point[] = [];
        let controlFrames: SelectionSnapshot['controlFrames'] = [];
        if (sameSelection) {
            grips = previous.grips;
            controlFrames = previous.controlFrames;
        } else if (state.kind === 'idle') {
            const elements = [...state.pickfirst].map((id) => this.index.elements.get(id)!);
            grips = selectionGrips(elements, this.index);
            controlFrames = selectionControlFrames(elements, this.index);
        }
        return {
            command,
            prompt: area !== null ? PROMPTS[area.shape === 'rect' ? 'corner' : 'lasso'] : PROMPTS[state.kind],
            message: this.message,
            hovered,
            highlighted,
            grips,
            controlFrames,
            area,
            cursor: pointPrompt ? 'point' : state.kind === 'select' ? 'select' : 'command',
            snap,
            basePoint,
            previewPoint,
            canUndo,
            canRedo,
        };
    }
}

/** Spanned to the right (or straight up or down) selects by window, to the left by crossing. */
function areaMode(first: Point, second: Point): SelectionMode {
    return second.x >= first.x ? 'window' : 'crossing';
}

function sameIds(a: ReadonlySet<Id>, b: ReadonlySet<Id>): boolean {
    return a.size === b.size && [...a].every((id) => b.has(id));
}

function samePoint(a: Point | null, b: Point | null): boolean {
    return a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);
}

/** Same mode at the same point; a new search returns new objects for an unchanged snap. */
function sameSnap(a: SnapResult | null, b: SnapResult | null): boolean {
    return a === b || (a !== null && b !== null && a.mode === b.mode && samePoint(a.point, b.point));
}
