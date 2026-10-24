import type { CadDocument } from '../model/CadDocument';
import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from '../../settings/editorSettings';
import { indexDocument, type DocumentIndex } from '../model/DocumentIndex';
import type { Id, Point } from '../model/Point';
import { rectFromCorners } from '../geometry/selectionGeometry';
import type { EditorKeyEvent, EditorPointerEvent } from './EditorPointerEvent';
import { buildElementShapes } from './selection/ElementShapes';
import { selectionControlFrames, selectionGrips } from './selection/grips';
import { buildSelectionUnits, expandToUnits } from './selection/grouping';
import { pickAt, pickCrossing, pickLasso, pickWindow } from './selection/picking';
import { ShapeIndex } from './selection/ShapeIndex';

/** How far a press must travel (screen px) before it counts as a drag. */
const DRAG_THRESHOLD_PX = 3;
/** Minimum distance (screen px) between recorded lasso points. */
const LASSO_STEP_PX = 4;

export type EditorCommand = 'AUSWAHL';

const PROMPTS = {
    idle: 'Befehl:',
    AUSWAHL: 'AUSWAHL Objekte wählen:',
    corner: 'Entgegengesetzte Ecke angeben:',
    lasso: 'Lasso – Leertaste wechselt Fenster/Kreuzen',
} as const;

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
}

type State =
    /** No command; clicks build the pickfirst selection (noun-verb). */
    | { kind: 'idle'; pickfirst: ReadonlySet<Id> }
    /** AUSWAHL runs; clicks build the command's selection (verb-noun). */
    | { kind: 'select'; selection: ReadonlySet<Id> };

/**
 * Object selection of the editor like AutoCAD, independent of Paper.js and React.
 *
 * With no command, a click adds the element under the cursor to the pickfirst selection,
 * Shift+click removes it and Esc clears it. The AUSWAHL command takes over the pickfirst
 * selection; clicks then add to or remove from the command's selection, Enter or a right
 * click ends the command (the result becomes the "previous" selection, nothing stays
 * highlighted) and Esc cancels it.
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
    private readonly index: DocumentIndex;
    private readonly shapes: ShapeIndex;
    /** What a pick of each selectable element selects: its whole group, or itself. */
    private readonly units: ReadonlyMap<Id, readonly Id[]>;
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
    private readonly listeners = new Set<() => void>();

    /** Half the pick box side in screen px (see EditorSettings.pickboxSize). */
    private readonly pickboxSize: number;

    constructor(doc: CadDocument, settings: Pick<EditorSettings, 'pickboxSize'> = DEFAULT_EDITOR_SETTINGS) {
        this.pickboxSize = settings.pickboxSize;
        this.index = indexDocument(doc);
        const shapes = buildElementShapes(doc);
        this.shapes = new ShapeIndex(shapes);
        this.units = buildSelectionUnits(
            doc,
            shapes.map((shape) => shape.id),
        );
        this.current = this.buildSnapshot(null);
    }

    get snapshot(): SelectionSnapshot {
        return this.current;
    }

    /** Result of the last completed AUSWAHL, for later commands ("Vorherige"). */
    get previous(): ReadonlySet<Id> {
        return this.previousSelection;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Starts AUSWAHL with the pickfirst selection; does nothing while it already runs. */
    startSelectCommand(): void {
        if (this.state.kind === 'select') {
            return;
        }
        const selection = this.state.pickfirst;
        this.state = { kind: 'select', selection };
        this.message = selection.size > 0 ? `${selection.size} gefunden` : null;
        this.changed();
    }

    pointerDown(event: EditorPointerEvent): void {
        if (event.button === 2) {
            if (this.area === null && this.state.kind === 'select') {
                this.finishSelectCommand();
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
        if (state.kind === 'select') {
            if (event.key === 'Enter') {
                this.finishSelectCommand();
                return true;
            }
            if (event.key === 'Escape') {
                this.state = { kind: 'idle', pickfirst: new Set() };
                this.message = '*Abbruch*';
                this.changed();
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

    private finishSelectCommand(): void {
        if (this.state.kind !== 'select') {
            return;
        }
        this.previousSelection = this.state.selection;
        this.state = { kind: 'idle', pickfirst: new Set() };
        this.message = null;
        this.changed();
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
     * them with `remove`. While AUSWAHL runs, reports the counts (of elements, members
     * included) on the command line like AutoCAD.
     */
    private applyPicked(hits: readonly Id[], remove: boolean): void {
        const picked = expandToUnits(hits, this.units);
        const state = this.state;
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
        const command = state.kind === 'select' ? 'AUSWAHL' : null;
        const highlighted = state.kind === 'idle' ? state.pickfirst : state.selection;
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
            if (this.underCursor !== null) {
                previewed = expandToUnits([this.underCursor], this.units);
            }
        }
        const hovered = new Set(previewed.filter((id) => !highlighted.has(id)));
        const sameSelection = previous !== null && command === previous.command && sameIds(highlighted, previous.highlighted);
        if (
            sameSelection &&
            this.message === previous.message &&
            area === previous.area &&
            sameIds(hovered, previous.hovered)
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
            prompt: area !== null ? PROMPTS[area.shape === 'rect' ? 'corner' : 'lasso'] : command === null ? PROMPTS.idle : PROMPTS[command],
            message: this.message,
            hovered,
            highlighted,
            grips,
            controlFrames,
            area,
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
