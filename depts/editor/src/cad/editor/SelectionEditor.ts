import type { CadDocument } from '../model/CadDocument';
import { DocumentHistory } from './commands/DocumentHistory';
import { MoveCommand } from './commands/MoveCommand';
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
import { matchesKeyword, parsePointInput, resolvePointInput } from './commandInput';
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

/**
 * Command line message, translated only when a snapshot is built, so a language change shows
 * at once (see refreshTexts).
 */
type Message = () => string;

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
     * Polar path from the base point the cursor follows at the second point prompt, or null
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
    /** Base point of SCHIEBEN once given, or null. */
    basePoint: Point | null;
    /**
     * At the second point prompt, the point a click would take now (the snap point, else the
     * tracking point, else the Ortho point or the point on the polar path, else the cursor), for the move preview; null
     * at other prompts and while the pointer is outside.
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
    /** Measured from the base point (or the last point), not from the origin. */
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
    /** SCHIEBEN selects objects; clicks build the command's selection (verb-noun). */
    | { kind: 'select'; selection: ReadonlySet<Id> }
    /** SCHIEBEN asks for the base point. */
    | { kind: 'basePoint'; selection: ReadonlySet<Id> }
    /** SCHIEBEN asks for the second point. */
    | { kind: 'secondPoint'; selection: ReadonlySet<Id>; basePoint: Point }
    /** SCHIEBEN asks for the displacement vector (option "Verschiebung"); a click gives it as a point. */
    | { kind: 'displacement'; selection: ReadonlySet<Id> };

type PointPromptState = Extract<State, { kind: 'basePoint' | 'secondPoint' | 'displacement' }>;

function isPointPrompt(state: State): state is PointPromptState {
    return state.kind === 'basePoint' || state.kind === 'secondPoint' || state.kind === 'displacement';
}

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
 * (see MoveCommand) and ends the command. Where nothing snaps at the second point, Ortho
 * forces the point onto the horizontal or vertical through the base point (see orthoPoint);
 * with Ortho off, polar tracking (see PolarTracking) puts it on the nearest polar path from
 * the base point. Both also work with the object snap off. With object snap tracking on (see
 * ObjectSnapTracking), a snap point that stays the snap point for the acquire delay is acquired
 * (dwelling on it again drops it); where nothing snaps, the point follows a horizontal or
 * vertical path (or one at the polar angles) from an acquired point, or takes the crossing of
 * two such paths, also with the polar path or the Ortho axis from the base point. The acquired
 * points hold for one point prompt. While several points lie in the aperture, Tab
 * switches to the next one (Shift+Tab back), until the cursor moves more than the aperture
 * size (half the box side) from where Tab was pressed. Esc cancels the command at any prompt. With
 * no command, undo() and redo() step through the document history.
 *
 * At the point prompts the keyboard types on the command line (see commandInput): Enter ends
 * the text (so does Space once something is typed), Backspace edits it and Esc drops it. A
 * typed point is absolute (`x,y`, `abstand<winkel`) or relative (`@…`) to the base point, at
 * the base point prompt to the last point given; a plain number at the second point goes that
 * far from the base point towards the cursor (direct distance entry). Enter on its own (or
 * "V") at the base point prompt asks for the displacement vector instead, and at the second
 * point takes the base point itself as the displacement, like AutoCAD. Direct distance entry
 * follows the Ortho direction, or the polar path while the cursor is on one; on a single
 * object snap tracking path it goes that far from the acquired point along the path.
 *
 * With Dynamic Input on (see dynamicInput), a point prompt that shows fields takes the keys into
 * them instead: X/Y (absolute) at the first point, distance and angle relative to the base point
 * at the second; untyped fields show the live values at the pointer. Typed numbers bind the point
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
    /** Polar path at the cursor during the second point prompt (see PolarTracking). */
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
    /** Text typed at the current point prompt or the command prompt. */
    private input = '';
    private dynamicInputSettings: DynamicInputSettings = DEFAULT_DYNAMIC_INPUT_SETTINGS;
    /** Text typed into the Dynamic Input fields, at point prompts that show them (instead of `input`). */
    private dynamic: DynamicInputState = EMPTY_DYNAMIC_INPUT;
    /** Last point given, the reference of relative input at the base point prompt (AutoCAD's LASTPOINT). */
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
            this.message = () => t('message.found', { count: selection.size });
        } else {
            this.state = { kind: 'select', selection };
            this.message = null;
        }
        this.changed();
    }

    /** Publishes the texts again after a language change. */
    refreshTexts(): void {
        this.changed();
    }

    /** Switches the running object snaps; takes effect at the cursor right away. */
    setSnapSettings(settings: SnapSettings): void {
        this.snapSettings = settings;
        if (this.lastPointer !== null && isPointPrompt(this.state)) {
            this.snapCycle = null;
            this.updateSnap(this.lastPointer);
            this.changed();
        }
    }

    /** Switches polar tracking or its angles; takes effect at the cursor right away. */
    setPolarSettings(settings: PolarSettings): void {
        this.polarSettings = settings;
        if (this.lastPointer !== null && isPointPrompt(this.state)) {
            this.updateSnap(this.lastPointer);
            this.changed();
        }
    }

    /** Switches Ortho; takes effect at the cursor right away. Polar tracking is off while it is on. */
    setOrtho(enabled: boolean): void {
        this.ortho = enabled;
        if (this.lastPointer !== null && isPointPrompt(this.state)) {
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
        if (isPointPrompt(this.state)) {
            this.updateSnap(this.lastPointer);
        }
        this.changed();
    }

    /** Switches Dynamic Input or its parts; text typed at a point prompt is dropped. */
    setDynamicInputSettings(settings: DynamicInputSettings): void {
        this.dynamicInputSettings = settings;
        if (isPointPrompt(this.state)) {
            this.input = '';
            this.dynamic = EMPTY_DYNAMIC_INPUT;
        }
        this.changed();
    }

    pointerDown(event: EditorPointerEvent): void {
        const state = this.state;
        if (isPointPrompt(state)) {
            if (event.button === 0) {
                // A click gives the point, bound by typed Dynamic Input values; other typed text is dropped
                this.updateSnap(event);
                const point = this.pointAt(event.modelPoint);
                this.input = '';
                this.dynamic = EMPTY_DYNAMIC_INPUT;
                this.pointGiven(point);
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
        if (isPointPrompt(this.state)) {
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
            if (!isPointPrompt(state)) {
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
        if (isPointPrompt(state)) {
            return this.typeKey(event);
        }
        if (state.kind !== 'idle') {
            if (event.key === 'Escape') {
                this.endCommand(CANCEL);
                return true;
            }
            if (event.key === 'Enter' && state.kind === 'select') {
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
                this.endCommand(CANCEL);
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
                this.endCommand(CANCEL);
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
        if (command === 'MOVE') {
            this.startMoveCommand();
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

    /** Typed command line text at a point prompt: a point, an option, or the default when empty. */
    private submitText(text: string): void {
        const state = this.state as PointPromptState;
        if (state.kind === 'basePoint' && (text === '' || matchesKeyword(text, t('message.displacementKeyword')))) {
            this.state = { kind: 'displacement', selection: state.selection };
            this.startPointPrompt();
            this.message = null;
            this.changed();
            return;
        }
        if (text === '') {
            // The base point as displacement, or the default <0,0>
            this.moveBy(state.selection, state.kind === 'secondPoint' ? state.basePoint : { x: 0, y: 0 });
            return;
        }
        const parsed = parsePointInput(text);
        const reference = state.kind === 'secondPoint' ? state.basePoint : state.kind === 'basePoint' ? this.lastPoint : { x: 0, y: 0 };
        // Direct distance entry needs a base point to measure from
        const toward = state.kind === 'secondPoint' ? this.previewPoint() : null;
        // On a single tracking path a distance goes from the acquired point along it, like AutoCAD
        const track = this.objectTrack?.paths.length === 1 ? this.objectTrack : null;
        const point =
            parsed?.kind === 'distance' && track !== null
                ? resolvePointInput(parsed, track.paths[0].origin, track.point)
                : parsed && resolvePointInput(parsed, reference, toward);
        if (point === null) {
            this.message = INVALID_INPUT;
            this.changed();
            return;
        }
        this.pointGiven(point);
    }

    /** A point given at a point prompt: clicked (at the snap point or the cursor) or typed. */
    private pointGiven(point: Point): void {
        const state = this.state;
        if (state.kind === 'basePoint') {
            this.lastPoint = point;
            this.state = { kind: 'secondPoint', selection: state.selection, basePoint: point };
            this.startPointPrompt();
            this.message = null;
            this.changed();
        } else if (state.kind === 'secondPoint') {
            this.lastPoint = point;
            this.moveBy(state.selection, { x: point.x - state.basePoint.x, y: point.y - state.basePoint.y });
        } else if (state.kind === 'displacement') {
            this.moveBy(state.selection, point);
        }
    }

    /** Ends SCHIEBEN by moving the selection by `delta`. */
    private moveBy(selection: ReadonlySet<Id>, delta: Point): void {
        this.endCommand(null);
        // A zero displacement changes nothing, so it leaves no undo step either
        if (delta.x !== 0 || delta.y !== 0) {
            this.history.execute(new MoveCommand(selection, delta));
        }
    }

    /**
     * At the second point prompt, the point a click would take now (see pointAt); without a
     * pointer only a point fixed by typed Dynamic Input values.
     */
    private previewPoint(): Point | null {
        if (this.state.kind !== 'secondPoint') {
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
        return isPointPrompt(this.state) ? dynamicLayout(this.dynamicInputSettings, this.state.kind) : null;
    }

    private dynamicContext(): DynamicContext {
        const state = this.state as PointPromptState;
        const track = this.objectTrack?.paths.length === 1 ? this.objectTrack.paths[0] : null;
        return {
            prompt: state.kind,
            basePoint: state.kind === 'secondPoint' ? state.basePoint : null,
            lastPoint: this.lastPoint,
            trackOrigin: track?.origin ?? null,
        };
    }

    /**
     * The point a click at `cursor` gives without Dynamic Input: the snap point; else the object
     * snap tracking point; else at the second point the Ortho point or the point on the polar
     * path; else the cursor itself.
     */
    private trackedPointAt(cursor: Point): Point {
        if (this.snap !== null) {
            return this.snap.point;
        }
        if (this.objectTrack !== null) {
            return this.objectTrack.point;
        }
        if (this.state.kind === 'secondPoint' && this.ortho) {
            return orthoPoint(this.state.basePoint, cursor);
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
     * nothing snaps, looks for object snap tracking and, at the second point prompt with Ortho
     * off, for a polar path from the base point; the nearer of a single tracking path and the
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
            query !== null && this.showSnapPreview && isPointPrompt(this.state)
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
        const state = this.state;
        const polar =
            event !== null && this.snap === null && state.kind === 'secondPoint' && !this.ortho
                ? findPolarTrack(
                      {
                          reference: state.basePoint,
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
     * acquired points. At the second point the tracking paths also cross the polar paths from
     * the base point, or with Ortho its axis, which then is the only place the point may go.
     */
    private findObjectTrack(event: EditorPointerEvent): ObjectTrack | null {
        const state = this.state;
        if (!this.objectTrackingSettings.enabled || !this.snapSettings.enabled || !isPointPrompt(state)) {
            return null;
        }
        const basePoint = state.kind === 'secondPoint' ? state.basePoint : null;
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
            this.objectTrackingSettings.enabled && isPointPrompt(this.state) && this.lastPointer !== null ? this.snap : null;
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
        const command: EditorCommand | null = state.kind === 'idle' ? null : 'MOVE';
        const highlighted = state.kind === 'idle' ? state.pickfirst : state.selection;
        const pointPrompt = isPointPrompt(state);
        const basePoint = state.kind === 'secondPoint' ? state.basePoint : null;
        const snap = pointPrompt ? this.snap : null;
        const snapCycle =
            pointPrompt && this.snapCycle !== null ? { index: this.snapCycle.index, count: this.snapCandidates.length } : null;
        const polar = state.kind === 'secondPoint' ? this.polar : null;
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
        const prompt = t(`prompt.${area !== null ? (area.shape === 'rect' ? 'corner' : 'lasso') : state.kind}`, {
            command: command && commandName(command),
        });
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
            basePoint === previous.basePoint &&
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
            cursor: pointPrompt ? 'point' : state.kind === 'select' ? 'select' : 'command',
            snap,
            snapCycle,
            snapPreview,
            polar,
            acquired,
            objectTrack,
            basePoint,
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
