import type { CadDocument } from '../model/CadDocument';
import { DocumentHistory } from './commands/DocumentHistory';
import {
    DEFAULT_DYNAMIC_INPUT_SETTINGS,
    DEFAULT_EDITOR_SETTINGS,
    DEFAULT_OBJECT_TRACKING_SETTINGS,
    DEFAULT_POLAR_SETTINGS,
    DEFAULT_SNAP_SETTINGS,
    type DynamicInputSettings,
    type EditorSettings,
    type ObjectTrackingSettings,
    type PolarSettings,
    type SnapSettings,
} from '../../settings/editorSettings';
import { indexDocument, type DocumentIndex } from '../model/DocumentIndex';
import type { Id, Point } from '../model/Point';
import { rectFromCorners } from '../geometry/selectionGeometry';
import { parsePointInput, resolvePointInput } from './commandInput';
import type { EditorKeyEvent, EditorPointerEvent } from './EditorPointerEvent';
import { buildElementShapes } from './selection/ElementShapes';
import { selectionControlFrames, selectionGrips } from './selection/grips';
import { buildSelectionUnits, expandToUnits } from './selection/grouping';
import { pickAt, pickCrossing, pickLasso, pickWindow } from './selection/picking';
import { ShapeIndex } from './selection/ShapeIndex';
import { SnapEngine, SnapMemory, coincide, sameSnapPoint, type SnapResult } from './snapping/SnapEngine';
import type { SnapPoint } from './snapping/SnapGeometry';
import { orthoPoint } from './tracking/ortho';
import { t } from '../../i18n/i18n';
import { commandName, findCommand, type EditorCommand } from './commandNames';
import { LineTool, type LineMemory } from './tools/LineTool';
import { MoveTool } from './tools/MoveTool';
import type { EditorTool, Message, PointPrompt, ToolPreview, ToolStep } from './tools/EditorTool';
import {
    backspaceDynamic,
    dynamicFields,
    dynamicFormat,
    dynamicLayout,
    dynamicPoint,
    dynamicText,
    EMPTY_DYNAMIC_INPUT,
    focusNextField,
    isEmptyDynamicInput,
    isRelative,
    typeDynamic,
    typedValues,
    type DynamicContext,
    type DynamicField,
    type DynamicFormat,
    type DynamicInputState,
    type DynamicLayout,
} from './dynamicInput';
import { findPolarTrack, polarAngles, type PolarTrack } from './tracking/PolarTracking';
import {
    findObjectTrack,
    polarWins,
    toggleAcquired,
    trackingAngles,
    type AcquiredPoint,
    type BasePaths,
    type ObjectTrack,
} from './tracking/ObjectSnapTracking';

/** How far a press must travel (screen px) before it counts as a drag. */
const DRAG_THRESHOLD_PX = 3;
/** Minimum distance (screen px) between recorded lasso points. */
const LASSO_STEP_PX = 4;
const NO_POINTS: readonly SnapPoint[] = [];
const NO_ACQUIRED: readonly AcquiredPoint[] = [];

export type { EditorCommand };

/** Typed text that is neither a point nor an option, like AutoCAD. */
const INVALID_INPUT: Message = () => t('message.invalidInput');
const CANCEL: Message = () => t('message.cancel');

/** A key that types a character on the command line (Space ends the text instead). */
const isTypedCharacter = (event: EditorKeyEvent) => event.key.length === 1 && event.key !== ' ' && !event.ctrlKey;

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
    /** Text typed at the prompt so far, not yet ended with Enter. */
    input: string;
    /** The prompt takes typed text (a point prompt, or the command prompt for a command name). */
    acceptsInput: boolean;
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
    /**
     * While Tab chose the snap point: its position (from 0) among the `count` snap points in
     * the aperture, for the tooltip; null while the best point snaps.
     */
    snapCycle: { index: number; count: number } | null;
    /**
     * Snap point preview at point prompts, a deliberate deviation from AutoCAD: the snap points
     * of the objects whose outline passes through the aperture, in the enabled modes (see
     * SnapEngine.previewPoints), without the point that snaps now. Display only; empty with the
     * object snap or EditorSettings.snapPreview off.
     */
    snapPreview: readonly SnapPoint[];
    /**
     * Polar path from `from` the cursor follows at a `next` point prompt, or null
     * (also while a snap point is found or object snap tracking gives the point, which win).
     */
    polar: PolarTrack | null;
    /** Points acquired for object snap tracking in this point prompt, for the + markers. */
    acquired: readonly AcquiredPoint[];
    /**
     * Object snap tracking at a point prompt: the point on a path from an acquired point, or
     * where two paths cross; null where nothing is tracked (or a snap point wins).
     */
    objectTrack: ObjectTrack | null;
    /**
     * The point a `next` point prompt measures from (SCHIEBEN's base point at the second point),
     * or null: polar paths and the Dynamic Input dimension start there.
     */
    from: Point | null;
    /** How the point a click would take is previewed from `from`; null without `from`. */
    preview: ToolPreview | null;
    /**
     * At a `next` point prompt, the point a click would take now (the snap point, else the
     * tracking point, else the Ortho point or the point on the polar path, else the cursor), for
     * the preview; null at other prompts and while the pointer is outside.
     */
    previewPoint: Point | null;
    /** Dynamic Input fields at the current point prompt, or null where none show. */
    dynamicInput: DynamicInputView | null;
    /** Undo and redo are possible now (not while a command runs). */
    canUndo: boolean;
    canRedo: boolean;
}

/** What the Dynamic Input display shows at a point prompt (see dynamicInput). */
export interface DynamicInputView {
    layout: DynamicLayout;
    format: DynamicFormat;
    /** Measured from `from` (or the last point), not from the origin. */
    relative: boolean;
    fields: readonly [DynamicField, DynamicField];
    /** The point a click or Enter takes now (also without a pointer once typed values fix it), or null. */
    point: Point | null;
    /** Typed values bind the point. */
    bound: boolean;
}

type State =
    /** No command; clicks build the pickfirst selection (noun-verb). */
    | { kind: 'idle'; pickfirst: ReadonlySet<Id> }
    /**
     * A command runs (see EditorTool); while it selects objects, clicks build `selection`
     * (verb-noun).
     */
    | { kind: 'command'; tool: EditorTool; selection: ReadonlySet<Id> };

/**
 * The editor core like AutoCAD, independent of Paper.js and React: object selection, and for
 * the running command (an EditorTool such as MoveTool) its object selection and point prompts.
 *
 * With no command, a click adds the element under the cursor to the pickfirst selection,
 * Shift+click removes it and Esc clears it. A command may take over the pickfirst selection;
 * when it selects objects, clicks add to or remove from the command's selection, and Enter or a
 * right click ends the selection (the result becomes the "previous" selection; with nothing
 * selected the command ends). A right click acts like Enter everywhere: at a point prompt it
 * ends the typed text (or takes the tool's default), at "Befehl:" it runs the typed name or
 * repeats the last command; it is ignored while a rectangle or lasso is being spanned.
 *
 * Points snap to the drawing (see SnapEngine); a click takes the snap point, or the cursor
 * position if there is none. At a `next` prompt (see PointPromptKind) the snapshot carries the
 * point for the tool's preview. Where nothing snaps there, Ortho forces the point onto the
 * horizontal or vertical through the prompt's `from` point (see orthoPoint); with Ortho off,
 * polar tracking (see PolarTracking) puts it on the nearest polar path from it. Both also work
 * with the object snap off. With object snap tracking on (see ObjectSnapTracking), a snap point
 * that stays the snap point for the acquire delay is acquired (dwelling on it again drops it);
 * where nothing snaps, the point follows a horizontal or vertical path (or one at the polar
 * angles) from an acquired point, or takes the crossing of two such paths, also with the polar
 * path or the Ortho axis from `from`. The acquired points hold for one point prompt. While
 * several points lie in the aperture, Tab switches to the next one (Shift+Tab back), until the
 * cursor moves more than the aperture size (half the box side) from where Tab was pressed. Esc
 * cancels the command at any prompt. With no command, undo() and redo() step through the
 * document history.
 *
 * At the point prompts the keyboard types on the command line (see commandInput): Enter ends
 * the text (so does Space once something is typed), Backspace edits it and Esc drops it. A
 * typed point is absolute (`x,y`, `abstand<winkel`) or relative (`@…`) to `from`, at a `point`
 * prompt to the last point given; a plain number at a `next` prompt goes that far from `from`
 * towards the cursor (direct distance entry). Enter on its own and other text that is no point
 * go to the tool (an option, or the default). Direct distance entry follows the Ortho
 * direction, or the polar path while the cursor is on one; on a single object snap tracking
 * path it goes that far from the acquired point along the path.
 *
 * With Dynamic Input on (see dynamicInput), a point prompt that shows fields takes the keys into
 * them instead: X/Y (absolute) at a `point` prompt, distance and angle relative to `from` at a
 * `next` one; untyped fields show the live values at the pointer. Typed numbers bind the point
 * at once, so the preview and a click follow them, and Tab moves between the fields once
 * something is typed (before, it still cycles the snap points). Text that is no number goes on
 * as if typed on the command line (an option keyword, or an invalid entry).
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
    /** Outlines touched during the current point prompt (see SnapMemory). */
    private snapMemory = new SnapMemory();
    private snap: SnapResult | null = null;
    /** Snap points in the aperture at the last cursor position, best first (see SnapEngine.candidates). */
    private snapCandidates: SnapResult[] = [];
    /** Tab cycle: index of the chosen snap point and the view point where Tab was pressed last. */
    private snapCycle: { index: number; anchor: Point } | null = null;
    /** Snap point preview at the last cursor position (see SnapEngine.previewPoints). */
    private snapPreview: readonly SnapPoint[] = NO_POINTS;
    private polarSettings: PolarSettings = DEFAULT_POLAR_SETTINGS;
    /** Polar path at the cursor during a `next` point prompt (see PolarTracking). */
    private polar: PolarTrack | null = null;
    /** Ortho mode (F8); excludes polar tracking. */
    private ortho = false;
    private objectTrackingSettings: ObjectTrackingSettings = DEFAULT_OBJECT_TRACKING_SETTINGS;
    /** Points acquired for object snap tracking in the current point prompt. */
    private acquired: readonly AcquiredPoint[] = NO_ACQUIRED;
    /** Object snap tracking at the cursor (see ObjectSnapTracking). */
    private objectTrack: ObjectTrack | null = null;
    /**
     * The snap point the cursor dwells on and the timer that acquires it; the timer is null once
     * it fired, so a point toggles once per dwell until the snap point changes.
     */
    private dwell: { snap: SnapResult; timer: ReturnType<typeof setTimeout> | null } | null = null;
    /** Last cursor position over the canvas, to snap at once when a point prompt starts. */
    private lastPointer: EditorPointerEvent | null = null;
    private state: State = { kind: 'idle', pickfirst: new Set() };
    /** The command started last, which Enter at "Befehl:" repeats. */
    private lastCommand: EditorCommand | null = null;
    private readonly lineMemory: LineMemory = { lastLine: null };
    /** The running tool's prompt the editor last started, to notice when the tool asks anew. */
    private prompt: EditorTool['prompt'] | null = null;
    /** Text typed at the current point prompt or the command prompt. */
    private input = '';
    private dynamicInputSettings: DynamicInputSettings = DEFAULT_DYNAMIC_INPUT_SETTINGS;
    /** Text typed into the Dynamic Input fields, at point prompts that show them (instead of `input`). */
    private dynamic: DynamicInputState = EMPTY_DYNAMIC_INPUT;
    /** Last point given, the reference of relative input at a `point` prompt (AutoCAD's LASTPOINT). */
    private lastPoint: Point = { x: 0, y: 0 };
    private previousSelection: ReadonlySet<Id> = new Set();
    /** Element under the cursor, whether selected or not. */
    private underCursor: Id | null = null;
    private message: Message | null = null;
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
    /** See EditorSettings.polarTolerance. */
    private readonly polarTolerance: number;
    /** See EditorSettings.snapPreview. */
    private readonly showSnapPreview: boolean;
    /** See EditorSettings.trackingAcquireDelay. */
    private readonly trackingAcquireDelay: number;

    /** Works on the document of `history` (a plain document gets a history of its own). */
    constructor(
        history: DocumentHistory | CadDocument,
        settings: Pick<
            EditorSettings,
            'pickboxSize' | 'apertureSize' | 'polarTolerance' | 'snapPreview' | 'trackingAcquireDelay'
        > = DEFAULT_EDITOR_SETTINGS,
    ) {
        this.pickboxSize = settings.pickboxSize;
        this.apertureSize = settings.apertureSize;
        this.polarTolerance = settings.polarTolerance;
        this.showSnapPreview = settings.snapPreview;
        this.trackingAcquireDelay = settings.trackingAcquireDelay;
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
        this.stopDwell();
        this.unsubscribeHistory();
        this.listeners.clear();
    }

    get snapshot(): SelectionSnapshot {
        return this.current;
    }

    /** Selection the last command worked on, for later commands ("Vorherige"). */
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
        this.endCommand(() => t('message.undone', { command: commandName(command.label) }));
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
        this.endCommand(() => t('message.redone', { command: commandName(command.label) }));
        return true;
    }

    /**
     * Starts a command, e.g. SCHIEBEN (with a pickfirst selection straight at the base point,
     * otherwise by selecting objects) or LINIE. Another running command is cancelled first, like
     * a toolbar click in AutoCAD; the same command keeps running.
     */
    startCommand(command: EditorCommand): void {
        const state = this.state;
        if (state.kind === 'command') {
            if (state.tool.command === command) {
                return;
            }
            this.cancelCommand();
        }
        this.startTool(command === 'LINE' ? new LineTool(this.history, this.lineMemory) : new MoveTool());
    }

    /** Publishes the texts again after a language change. */
    refreshTexts(): void {
        this.changed();
    }

    /** Switches the running object snaps; takes effect at the cursor right away. */
    setSnapSettings(settings: SnapSettings): void {
        this.snapSettings = settings;
        if (this.lastPointer !== null && this.pointPrompt() !== null) {
            this.snapCycle = null;
            this.updateSnap(this.lastPointer);
            this.changed();
        }
    }

    /** Switches polar tracking or its angles; takes effect at the cursor right away. */
    setPolarSettings(settings: PolarSettings): void {
        this.polarSettings = settings;
        if (this.lastPointer !== null && this.pointPrompt() !== null) {
            this.updateSnap(this.lastPointer);
            this.changed();
        }
    }

    /** Switches Ortho; takes effect at the cursor right away. Polar tracking is off while it is on. */
    setOrtho(enabled: boolean): void {
        this.ortho = enabled;
        if (this.lastPointer !== null && this.pointPrompt() !== null) {
            this.updateSnap(this.lastPointer);
            this.changed();
        }
    }

    /**
     * Switches object snap tracking or its angles; takes effect at the cursor right away.
     * Switching it off drops the acquired points.
     */
    setObjectTrackingSettings(settings: ObjectTrackingSettings): void {
        this.objectTrackingSettings = settings;
        if (!settings.enabled) {
            this.acquired = NO_ACQUIRED;
        }
        if (this.pointPrompt() !== null) {
            this.updateSnap(this.lastPointer);
        }
        this.changed();
    }

    /** Switches Dynamic Input or its parts; text typed at a point prompt is dropped. */
    setDynamicInputSettings(settings: DynamicInputSettings): void {
        this.dynamicInputSettings = settings;
        if (this.pointPrompt() !== null) {
            this.input = '';
            this.dynamic = EMPTY_DYNAMIC_INPUT;
        }
        this.changed();
    }

    pointerDown(event: EditorPointerEvent): void {
        const state = this.state;
        if (this.pointPrompt() !== null) {
            if (event.button === 0) {
                // A click gives the point, bound by typed Dynamic Input values; other typed text is dropped
                this.updateSnap(event);
                const point = this.pointAt(event.modelPoint);
                this.input = '';
                this.dynamic = EMPTY_DYNAMIC_INPUT;
                this.pointGiven(point);
            } else if (event.button === 2) {
                // Like Enter, as with AutoCAD's right-click customization "ENTER"
                this.submitInput();
            }
            return;
        }
        if (event.button === 2) {
            // Ignored while a rectangle or lasso is being spanned, so it never starts a command
            if (this.area !== null || this.press !== null) {
                return;
            }
            if (this.selecting()) {
                this.finishSelection();
            } else if (state.kind === 'idle' && this.input !== '') {
                this.runTypedCommand();
            } else if (state.kind === 'idle' && this.lastCommand !== null) {
                // Repeats the last command, like AutoCAD's right-click customization "Repeat Last Command"
                this.startCommand(this.lastCommand);
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
        if (this.pointPrompt() !== null) {
            this.updateSnap(event);
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
        this.updateSnap(null);
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
        if (event.key === 'Tab') {
            // Handled at every point prompt, so the browser focus never moves away
            if (this.pointPrompt() === null) {
                return false;
            }
            // With typed Dynamic Input values Tab moves between the fields, else it cycles the snap points
            if (this.dynamicPromptLayout() !== null && !isEmptyDynamicInput(this.dynamic)) {
                this.dynamic = focusNextField(this.dynamic);
                this.changed();
            } else {
                this.cycleSnap(event.shiftKey ? -1 : 1);
            }
            return true;
        }
        if (this.pointPrompt() !== null) {
            return this.typeKey(event);
        }
        if (state.kind !== 'idle') {
            if (event.key === 'Escape') {
                this.cancelCommand();
                return true;
            }
            if (event.key === 'Enter' && this.selecting()) {
                this.finishSelection();
                return true;
            }
            return false;
        }
        if (this.area === null && this.typeCommandKey(event)) {
            return true;
        }
        if (event.key === 'Escape' && state.pickfirst.size > 0) {
            this.state = { kind: 'idle', pickfirst: new Set() };
            this.changed();
            return true;
        }
        return false;
    }

    /** Starts a command; does nothing while one runs. */
    private startTool(tool: EditorTool): void {
        const state = this.state;
        if (state.kind !== 'idle') {
            return;
        }
        this.area = null;
        this.press = null;
        this.lastCommand = tool.command;
        this.state = { kind: 'command', tool, selection: new Set() };
        this.prompt = null;
        const step = tool.start(state.pickfirst);
        if (tool.highlighted.size > 0) {
            this.previousSelection = tool.highlighted;
        }
        this.applyStep(step);
    }

    /**
     * Follows up what the tool did: ends the command (and runs its document command), or starts
     * its new prompt; shows its message.
     */
    private applyStep(step: ToolStep): void {
        const state = this.state;
        if (state.kind !== 'command') {
            return;
        }
        if (step.done) {
            this.endCommand(step.message ?? null);
            if (step.command) {
                this.history.execute(step.command);
            }
            return;
        }
        const prompt = state.tool.prompt;
        if (prompt !== this.prompt) {
            this.prompt = prompt;
            if (prompt.kind === 'select') {
                this.state = { ...state, selection: new Set() };
            } else {
                this.underCursor = null;
                this.startPointPrompt();
            }
        }
        this.message = step.message ?? null;
        this.changed();
    }

    /** The running command's point prompt, or null at other prompts. */
    private pointPrompt(): PointPrompt | null {
        const state = this.state;
        return state.kind === 'command' && state.tool.prompt.kind === 'point' ? state.tool.prompt : null;
    }

    /** The running command selects objects. */
    private selecting(): boolean {
        return this.state.kind === 'command' && this.state.tool.prompt.kind === 'select';
    }

    /** The point the current `next` prompt measures from, or null. */
    private from(): Point | null {
        const prompt = this.pointPrompt();
        return prompt?.input === 'next' ? prompt.from : null;
    }

    /** Esc: the tool tidies up, the command ends. */
    private cancelCommand(): void {
        if (this.state.kind === 'command') {
            this.state.tool.cancel();
        }
        this.endCommand(CANCEL);
    }

    /** Ends the command's object selection: on to its next prompt, or out if nothing is selected. */
    private finishSelection(): void {
        const state = this.state;
        if (state.kind !== 'command' || !this.selecting()) {
            return;
        }
        if (state.selection.size === 0) {
            this.endCommand(null);
            return;
        }
        this.previousSelection = state.selection;
        this.applyStep(state.tool.objectsSelected(state.selection));
    }

    /**
     * A key at a point prompt: types on the command line, or ends, edits or drops the text.
     * Every printable key is taken, so none triggers anything else; Ctrl/⌘ shortcuts are not.
     */
    private typeKey(event: EditorKeyEvent): boolean {
        if (this.dynamicPromptLayout() !== null) {
            return this.typeDynamicKey(event);
        }
        const { key } = event;
        if (key === 'Escape') {
            if (this.input === '') {
                this.cancelCommand();
            } else {
                this.input = '';
                this.changed();
            }
            return true;
        }
        if (key === 'Enter' || (key === ' ' && this.input !== '')) {
            this.submitInput();
            return true;
        }
        if (key === 'Backspace') {
            this.input = this.input.slice(0, -1);
            this.changed();
            return true;
        }
        if (isTypedCharacter(event)) {
            this.input += key;
            this.changed();
            return true;
        }
        return false;
    }

    /**
     * A key at a point prompt that shows Dynamic Input fields: types into the focused field (`,`
     * and `<` move on to the second), ends, edits or drops the text like typeKey.
     */
    private typeDynamicKey(event: EditorKeyEvent): boolean {
        const { key } = event;
        const empty = isEmptyDynamicInput(this.dynamic);
        if (key === 'Escape') {
            if (empty) {
                this.cancelCommand();
            } else {
                this.dynamic = EMPTY_DYNAMIC_INPUT;
                this.changed();
            }
            return true;
        }
        if (key === 'Enter' || (key === ' ' && !empty)) {
            this.submitInput();
            return true;
        }
        if (key === 'Backspace') {
            this.dynamic = backspaceDynamic(this.dynamic);
        } else if (isTypedCharacter(event)) {
            this.dynamic = typeDynamic(this.dynamic, key);
        } else {
            return false;
        }
        this.changed();
        return true;
    }

    /**
     * A key at the command prompt: types a command name (or alias) on the command line, ends
     * the text with Enter or Space and runs the command, edits or drops the text. Only takes
     * Space, Enter, Backspace and Esc while there is text, so they keep their meaning otherwise.
     */
    private typeCommandKey(event: EditorKeyEvent): boolean {
        const { key } = event;
        if (isTypedCharacter(event)) {
            this.input += key;
        } else if (this.input === '') {
            // Enter on its own repeats the last command, like AutoCAD; Space keeps panning
            if (key === 'Enter' && this.lastCommand !== null) {
                this.startCommand(this.lastCommand);
                return true;
            }
            return false;
        } else if (key === 'Escape') {
            this.input = '';
        } else if (key === 'Backspace') {
            this.input = this.input.slice(0, -1);
        } else if (key === 'Enter' || key === ' ') {
            this.runTypedCommand();
            return true;
        } else {
            return false;
        }
        this.changed();
        return true;
    }

    /** Runs the command the typed text names, like AutoCAD's command line. */
    private runTypedCommand(): void {
        const text = this.input.trim();
        this.input = '';
        const command = findCommand(text);
        if (command !== null) {
            this.startCommand(command);
            return;
        }
        this.message = () => t('message.unknownCommand', { name: text.toUpperCase() });
        this.changed();
    }

    /**
     * Enter at a point prompt: takes the typed point, option or default (see the class comment).
     * Typed Dynamic Input numbers give the point they bind; other text in the fields counts as
     * typed on the command line.
     */
    private submitInput(): void {
        if (this.dynamicPromptLayout() !== null) {
            const dynamic = this.dynamic;
            this.dynamic = EMPTY_DYNAMIC_INPUT;
            const values = typedValues(dynamic);
            if (values !== 'text' && (values[0] !== null || values[1] !== null)) {
                const point = this.dynamicBoundPoint(dynamic);
                if (point === null) {
                    this.message = INVALID_INPUT;
                    this.changed();
                } else {
                    this.pointGiven(point);
                }
                return;
            }
            this.submitText(dynamicText(dynamic, this.dynamicContext()).trim());
            return;
        }
        const text = this.input.trim();
        this.input = '';
        this.submitText(text);
    }

    /**
     * Typed command line text at a point prompt: a point, else an option of the tool or, when
     * empty, its default.
     */
    private submitText(text: string): void {
        const { tool } = this.state as Extract<State, { kind: 'command' }>;
        const prompt = this.pointPrompt()!;
        const parsed = text === '' ? null : parsePointInput(text);
        if (parsed === null) {
            const step = tool.text(text);
            if (step === null) {
                this.message = INVALID_INPUT;
                this.changed();
            } else {
                this.applyStep(step);
            }
            return;
        }
        const from = this.from();
        const reference = from ?? (prompt.input === 'point' ? this.lastPoint : { x: 0, y: 0 });
        // Direct distance entry needs a point to measure from
        const toward = from !== null ? this.previewPoint() : null;
        // On a single tracking path a distance goes from the acquired point along it, like AutoCAD
        const track = this.objectTrack?.paths.length === 1 ? this.objectTrack : null;
        const point =
            parsed.kind === 'distance' && track !== null
                ? resolvePointInput(parsed, track.paths[0].origin, track.point)
                : resolvePointInput(parsed, reference, toward);
        if (point === null) {
            this.message = INVALID_INPUT;
            this.changed();
            return;
        }
        this.pointGiven(point);
    }

    /**
     * A point given at a point prompt: clicked (at the snap point or the cursor) or typed. It
     * becomes the last point (AutoCAD's LASTPOINT) unless it is a vector.
     */
    private pointGiven(point: Point): void {
        const state = this.state;
        const prompt = this.pointPrompt();
        if (state.kind !== 'command' || prompt === null) {
            return;
        }
        if (prompt.input !== 'vector') {
            this.lastPoint = point;
        }
        this.applyStep(state.tool.point(point));
    }

    /**
     * At a `next` point prompt, the point a click would take now (see pointAt); without a
     * pointer only a point fixed by typed Dynamic Input values.
     */
    private previewPoint(): Point | null {
        if (this.from() === null) {
            return null;
        }
        return this.lastPointer !== null ? this.pointAt(this.lastPointer.modelPoint) : this.dynamicBoundPoint(this.dynamic);
    }

    /** The point a click at `cursor` gives: the tracked point (see trackedPointAt), bound by typed Dynamic Input values. */
    private pointAt(cursor: Point): Point {
        const point = this.trackedPointAt(cursor);
        if (this.dynamicPromptLayout() === null) {
            return point;
        }
        return dynamicPoint(this.dynamic, this.dynamicContext(), point) ?? point;
    }

    /** The point typed Dynamic Input values bind, the rest taken at the pointer; null if they bind none. */
    private dynamicBoundPoint(dynamic: DynamicInputState): Point | null {
        const point = this.lastPointer !== null ? this.trackedPointAt(this.lastPointer.modelPoint) : null;
        return dynamicPoint(dynamic, this.dynamicContext(), point);
    }

    /** Which Dynamic Input fields the current prompt shows, or null for none (typing goes to the command line). */
    private dynamicPromptLayout(): DynamicLayout | null {
        const prompt = this.pointPrompt();
        return prompt !== null ? dynamicLayout(this.dynamicInputSettings, prompt.input) : null;
    }

    private dynamicContext(): DynamicContext {
        const track = this.objectTrack?.paths.length === 1 ? this.objectTrack.paths[0] : null;
        return {
            prompt: this.pointPrompt()!.input,
            from: this.from(),
            lastPoint: this.lastPoint,
            trackOrigin: track?.origin ?? null,
        };
    }

    /**
     * The point a click at `cursor` gives without Dynamic Input: the snap point; else the object
     * snap tracking point; else at a `next` prompt the Ortho point or the point on the polar
     * path; else the cursor itself.
     */
    private trackedPointAt(cursor: Point): Point {
        if (this.snap !== null) {
            return this.snap.point;
        }
        if (this.objectTrack !== null) {
            return this.objectTrack.point;
        }
        const from = this.from();
        if (from !== null && this.ortho) {
            return orthoPoint(from, cursor);
        }
        return this.polar?.point ?? cursor;
    }

    /**
     * Each point prompt starts with a fresh snap memory and no acquired points, and snaps at
     * the cursor anew.
     */
    private startPointPrompt(): void {
        this.dynamic = EMPTY_DYNAMIC_INPUT;
        this.snapMemory = new SnapMemory();
        this.snap = null;
        this.snapCycle = null;
        this.polar = null;
        this.acquired = NO_ACQUIRED;
        this.objectTrack = null;
        this.stopDwell();
        this.updateSnap(this.lastPointer);
        // The point just clicked is not acquired by resting on it; only after the snap changed
        if (this.dwell?.timer != null) {
            clearTimeout(this.dwell.timer);
            this.dwell.timer = null;
        }
    }

    /** Tab: the next (or with -1 the previous) snap point in the aperture, wrapping around. */
    private cycleSnap(step: 1 | -1): void {
        const count = this.snapCandidates.length;
        if (count < 2 || this.lastPointer === null) {
            return;
        }
        const index = ((this.snapCycle?.index ?? 0) + step + count) % count;
        this.snapCycle = { index, anchor: this.lastPointer.viewPoint };
        this.snap = this.snapCandidates[index];
        this.polar = null;
        this.objectTrack = null;
        this.updateDwell();
        this.changed();
    }

    private endCommand(message: Message | null): void {
        this.state = { kind: 'idle', pickfirst: new Set() };
        this.prompt = null;
        this.input = '';
        this.dynamic = EMPTY_DYNAMIC_INPUT;
        this.message = message;
        this.acquired = NO_ACQUIRED;
        this.updateSnap(null);
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

    /**
     * Snaps at the cursor (or nowhere with null). A point chosen by Tab stays chosen while it is
     * in the aperture and the cursor stays within the aperture size of where Tab was pressed;
     * otherwise the best point snaps, with the previous snap point kept by hysteresis. Where
     * nothing snaps, looks for object snap tracking and, at a `next` prompt with Ortho off, for
     * a polar path from its `from` point; the nearer of a single tracking path and the
     * polar path wins. Also finds the snap point preview at point prompts and keeps the timer
     * that acquires the snap point the cursor dwells on.
     */
    private updateSnap(event: EditorPointerEvent | null): void {
        const cycle = this.snapCycle;
        const query =
            event === null || !this.snapSettings.enabled
                ? null
                : {
                      cursor: event.modelPoint,
                      pixelSize: event.pixelSize,
                      aperture: this.apertureSize,
                      modes: this.snapSettings.modes,
                  };
        const candidates =
            query === null ? [] : this.snapEngine.candidates(query, this.snapMemory, cycle === null ? this.snap : null);
        this.snapPreview =
            query !== null && this.showSnapPreview && this.pointPrompt() !== null
                ? this.snapEngine.previewPoints(query, this.snapMemory)
                : NO_POINTS;
        const chosen = this.snap;
        const cycling =
            cycle !== null &&
            event !== null &&
            chosen !== null &&
            Math.hypot(event.viewPoint.x - cycle.anchor.x, event.viewPoint.y - cycle.anchor.y) <= this.apertureSize;
        const index = cycling ? candidates.findIndex((candidate) => sameSnapPoint(candidate, chosen)) : -1;
        this.snapCandidates = candidates;
        this.snapCycle = index >= 0 ? { ...cycle!, index } : null;
        this.snap = candidates[Math.max(index, 0)] ?? null;
        const from = this.from();
        const polar =
            event !== null && this.snap === null && from !== null && !this.ortho
                ? findPolarTrack(
                      {
                          reference: from,
                          cursor: event.modelPoint,
                          pixelSize: event.pixelSize,
                          tolerance: this.polarTolerance,
                      },
                      this.polarSettings,
                      this.polar,
                  )
                : null;
        let objectTrack = event !== null && this.snap === null ? this.findObjectTrack(event) : null;
        if (
            event !== null &&
            objectTrack?.paths.length === 1 &&
            polar !== null &&
            polarWins(polar, objectTrack, event.modelPoint, event.pixelSize, this.polar !== null)
        ) {
            objectTrack = null;
        }
        this.objectTrack = objectTrack;
        this.polar = objectTrack === null ? polar : null;
        this.updateDwell();
    }

    /**
     * Object snap tracking at the cursor: needs it and the object snap on, a point prompt and
     * acquired points. At a `next` prompt the tracking paths also cross the polar paths from its
     * `from` point, or with Ortho its axis, which then is the only place the point may go.
     */
    private findObjectTrack(event: EditorPointerEvent): ObjectTrack | null {
        if (!this.objectTrackingSettings.enabled || !this.snapSettings.enabled || this.pointPrompt() === null) {
            return null;
        }
        const basePoint = this.from();
        let cursor = event.modelPoint;
        let base: BasePaths | null = null;
        if (basePoint !== null && this.ortho) {
            cursor = orthoPoint(basePoint, cursor);
            base = { origin: basePoint, angles: cursor.y === basePoint.y ? [0, 180] : [90, 270], source: 'ortho' };
        } else if (basePoint !== null && this.polarSettings.enabled) {
            base = { origin: basePoint, angles: polarAngles(this.polarSettings), source: 'polar' };
        }
        return findObjectTrack(
            { cursor, pixelSize: event.pixelSize, tolerance: this.polarTolerance, aperture: this.apertureSize },
            this.acquired,
            trackingAngles(this.objectTrackingSettings, this.polarSettings),
            { base, single: base?.source !== 'ortho', previous: this.objectTrack },
        );
    }

    /**
     * Restarts the acquire timer when the snap point changes, stops it where nothing snaps or
     * object snap tracking is off.
     */
    private updateDwell(): void {
        const snap =
            this.objectTrackingSettings.enabled && this.pointPrompt() !== null && this.lastPointer !== null ? this.snap : null;
        if (snap !== null && this.dwell !== null && sameSnapPoint(this.dwell.snap, snap)) {
            return;
        }
        this.stopDwell();
        if (snap !== null) {
            this.dwell = { snap, timer: setTimeout(() => this.acquire(), this.trackingAcquireDelay) };
        }
    }

    /** The cursor dwelt on the snap point: acquires it, or drops it if it was acquired. */
    private acquire(): void {
        const dwell = this.dwell;
        if (dwell === null) {
            return;
        }
        dwell.timer = null;
        this.acquired = toggleAcquired(this.acquired, { point: dwell.snap.point, mode: dwell.snap.mode });
        this.updateSnap(this.lastPointer);
        this.changed();
    }

    private stopDwell(): void {
        if (this.dwell?.timer != null) {
            clearTimeout(this.dwell.timer);
        }
        this.dwell = null;
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
     * them with `remove`. While a command selects, reports the counts (of elements, members
     * included) on the command line like AutoCAD.
     */
    private applyPicked(hits: readonly Id[], remove: boolean): void {
        const picked = expandToUnits(hits, this.units);
        const state = this.state;
        if (state.kind !== 'idle' && !this.selecting()) {
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
            this.state = { ...state, selection: after };
            const duplicates = picked.filter((id) => before.has(id)).length;
            const counts = { count: picked.length, total: after.size };
            this.message = remove
                ? () => t('message.foundRemovedTotal', { ...counts, removed: before.size - after.size })
                : duplicates > 0
                  ? () => t('message.foundDuplicatesTotal', { ...counts, duplicates })
                  : () => t('message.foundTotal', counts);
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
        const command: EditorCommand | null = state.kind === 'idle' ? null : state.tool.command;
        const selecting = this.selecting();
        const highlighted = state.kind === 'idle' ? state.pickfirst : selecting ? state.selection : state.tool.highlighted;
        const pointPrompt = this.pointPrompt() !== null;
        const from = this.from();
        const preview = from !== null && state.kind === 'command' ? state.tool.preview : null;
        const snap = pointPrompt ? this.snap : null;
        const snapCycle =
            pointPrompt && this.snapCycle !== null ? { index: this.snapCycle.index, count: this.snapCandidates.length } : null;
        const polar = from !== null ? this.polar : null;
        const acquired = pointPrompt ? this.acquired : NO_ACQUIRED;
        const objectTrack = pointPrompt ? this.objectTrack : null;
        // Not under the active snap marker
        const snapPreview = pointPrompt
            ? this.snapPreview.filter(({ point }) => snap === null || !coincide(point, snap.point))
            : NO_POINTS;
        const previewPoint = this.previewPoint();
        const dynamicInput = this.dynamicInputView();
        const input = dynamicInput !== null ? dynamicText(this.dynamic, this.dynamicContext()) : this.input;
        const idle = state.kind === 'idle' && this.area === null;
        const canUndo = idle && this.history.undoCommand !== null;
        const canRedo = idle && this.history.redoCommand !== null;
        const area = this.area;
        const prompt =
            area !== null
                ? t(area.shape === 'rect' ? 'prompt.corner' : 'prompt.lasso')
                : state.kind === 'idle'
                  ? t('prompt.idle')
                  : state.tool.prompt.text();
        const message = this.message?.() ?? null;
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
            prompt === previous.prompt &&
            message === previous.message &&
            input === previous.input &&
            area === previous.area &&
            sameIds(hovered, previous.hovered) &&
            sameSnap(snap, previous.snap) &&
            sameCycle(snapCycle, previous.snapCycle) &&
            sameSnapPoints(snapPreview, previous.snapPreview) &&
            samePolar(polar, previous.polar) &&
            acquired === previous.acquired &&
            sameObjectTrack(objectTrack, previous.objectTrack) &&
            samePoint(from, previous.from) &&
            preview === previous.preview &&
            samePoint(previewPoint, previous.previewPoint) &&
            sameDynamicInput(dynamicInput, previous.dynamicInput) &&
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
            prompt,
            input,
            acceptsInput: pointPrompt || (state.kind === 'idle' && area === null),
            message,
            hovered,
            highlighted,
            grips,
            controlFrames,
            area,
            cursor: pointPrompt ? 'point' : selecting ? 'select' : 'command',
            snap,
            snapCycle,
            snapPreview,
            polar,
            acquired,
            objectTrack,
            from,
            preview,
            previewPoint,
            dynamicInput,
            canUndo,
            canRedo,
        };
    }

    /** The Dynamic Input fields at the current point prompt, with live values at the pointer. */
    private dynamicInputView(): DynamicInputView | null {
        const layout = this.dynamicPromptLayout();
        if (layout === null) {
            return null;
        }
        const dynamic = this.dynamic;
        const ctx = this.dynamicContext();
        const tracked = this.lastPointer !== null ? this.trackedPointAt(this.lastPointer.modelPoint) : null;
        const bound = dynamicPoint(dynamic, ctx, tracked);
        const point = bound ?? tracked;
        return {
            layout,
            format: dynamicFormat(dynamic, ctx),
            relative: isRelative(dynamic, ctx),
            fields: dynamicFields(dynamic, ctx, point),
            point,
            bound: bound !== null,
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

function sameSnapPoints(a: readonly SnapPoint[], b: readonly SnapPoint[]): boolean {
    return a === b || (a.length === b.length && a.every((p, i) => p.mode === b[i].mode && samePoint(p.point, b[i].point)));
}

function samePolar(a: PolarTrack | null, b: PolarTrack | null): boolean {
    return a === b || (a !== null && b !== null && a.angle === b.angle && samePoint(a.point, b.point));
}

function sameObjectTrack(a: ObjectTrack | null, b: ObjectTrack | null): boolean {
    return (
        a === b ||
        (a !== null &&
            b !== null &&
            samePoint(a.point, b.point) &&
            a.paths.length === b.paths.length &&
            a.paths.every((path, i) => path.angle === b.paths[i].angle && samePoint(path.origin, b.paths[i].origin)))
    );
}

function sameDynamicInput(a: DynamicInputView | null, b: DynamicInputView | null): boolean {
    return (
        a === b ||
        (a !== null &&
            b !== null &&
            a.layout === b.layout &&
            a.format === b.format &&
            a.relative === b.relative &&
            a.bound === b.bound &&
            samePoint(a.point, b.point) &&
            a.fields.every(
                (field, i) =>
                    field.kind === b.fields[i].kind &&
                    field.text === b.fields[i].text &&
                    field.typed === b.fields[i].typed &&
                    field.focused === b.fields[i].focused,
            ))
    );
}

function sameCycle(a: SelectionSnapshot['snapCycle'], b: SelectionSnapshot['snapCycle']): boolean {
    return a === b || (a !== null && b !== null && a.index === b.index && a.count === b.count);
}
