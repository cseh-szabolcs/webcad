import { t } from '../../../i18n/i18n';
import type { Id, Point, Vector2 } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddPolylineCommand } from '../commands/AddPolylineCommand';
import type { DocumentHistory } from '../commands/DocumentHistory';
import { continuePoint, type DrawingMemory } from './DrawingMemory';
import type { EditorTool, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

type State =
    | { kind: 'first' }
    /**
     * The points given so far, from the start point (the target of "Schließen") to the last one;
     * `length` while it asks for the length of a segment ("sehnenLänge").
     */
    | { kind: 'next'; points: Point[]; length: boolean };

/**
 * PLINIE (AutoCAD PLINE), so far with straight segments only: one polyline through the points
 * given. Unlike LINIE it enters the document only when the command ends, as one element and one
 * undo step, so its segments are previewed (not snapped) until then. The option "Zurück" takes
 * the last segment back, "Schließen" (from one segment on) closes the polyline and ends,
 * "sehnenLänge" (from one segment on) asks for a length and adds a segment that long in the
 * direction of the last one (a `distance` prompt from the last point). Enter
 * and Esc end too, keeping what was drawn. Enter on its own at the start point continues from
 * the end of the line or polyline drawn last.
 */
export class PolylineTool implements EditorTool {
    readonly command = 'PLINE';
    readonly highlighted = NOTHING;
    private readonly history: DocumentHistory;
    private readonly memory: DrawingMemory;
    private state: State = { kind: 'first' };
    prompt: ToolPrompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.polylineStart') };
    preview: ToolPreview | null = null;

    constructor(history: DocumentHistory, memory: DrawingMemory) {
        this.history = history;
        this.memory = memory;
    }

    start(): ToolStep {
        return {};
    }

    objectsSelected(): ToolStep {
        return {};
    }

    point(point: Point): ToolStep {
        const state = this.state;
        if (state.kind === 'first') {
            this.askNext([point]);
            return {};
        }
        const last = state.points.at(-1)!;
        // A segment of no length adds nothing
        if (point.x !== last.x || point.y !== last.y) {
            this.askNext([...state.points, point]);
        }
        return {};
    }

    /** The length of the next segment ("sehnenLänge"): only a positive one, else the prompt stays. */
    distance(distance: number): ToolStep {
        const state = this.state;
        if (state.kind !== 'next' || !state.length) {
            return {};
        }
        if (!(distance > 0)) {
            return { message: () => t('message.positiveValue') };
        }
        const { x, y } = state.points.at(-1)!;
        const direction = lastDirection(state.points);
        this.askNext([...state.points, { x: x + direction.x * distance, y: y + direction.y * distance }]);
        return {};
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        if (state.kind === 'first') {
            return text === '' ? this.continueLast() : null;
        }
        // The length prompt has no options
        if (state.length) {
            return null;
        }
        if (text === '') {
            return this.finish(state.points, false);
        }
        if (matchesKeyword(text, t('message.undoKeyword'))) {
            if (state.points.length < 2) {
                return { message: () => t('message.allSegmentsUndone') };
            }
            this.askNext(state.points.slice(0, -1));
            return {};
        }
        if (state.points.length >= 2 && matchesKeyword(text, t('message.closeKeyword'))) {
            const [start] = state.points;
            const last = state.points.at(-1)!;
            // Back on the start point: the closing segment replaces the last one
            const points =
                state.points.length > 2 && last.x === start.x && last.y === start.y ? state.points.slice(0, -1) : state.points;
            return this.finish(points, true);
        }
        if (state.points.length >= 2 && matchesKeyword(text, t('message.lengthKeyword'))) {
            this.askLength(state.points);
            return {};
        }
        return null;
    }

    cancel(): void {
        if (this.state.kind === 'next') {
            this.finish(this.state.points, false);
        }
    }

    /** Enter at the start point: on from the end point of the line or polyline drawn last, where it is now. */
    private continueLast(): ToolStep {
        const point = continuePoint(this.history.document, this.memory.lastDrawn);
        if (!point) {
            return { message: () => t('message.noLineToContinue') };
        }
        this.askNext([point]);
        return {};
    }

    /**
     * Ends the command: the polyline (with a segment at least) enters the document as one undo
     * step, run here rather than as the step's command, so Esc keeps it too.
     */
    private finish(points: readonly Point[], closed: boolean): ToolStep {
        this.state = { kind: 'first' };
        if (points.length >= 2) {
            const command = new AddPolylineCommand(points, closed);
            this.history.execute(command);
            this.memory.lastDrawn = command.polylineId;
        }
        return { done: true };
    }

    private askNext(points: Point[]): void {
        this.state = { kind: 'next', points, length: false };
        this.preview = { kind: 'polyline', points };
        const close = points.length >= 2;
        this.prompt = {
            kind: 'point',
            input: 'next',
            from: points.at(-1)!,
            text: () => t(close ? 'prompt.polylineNextClose' : 'prompt.polylineNext'),
        };
    }

    /** "sehnenLänge": the length of a segment in the direction of the last one, from the last point. */
    private askLength(points: Point[]): void {
        this.state = { kind: 'next', points, length: true };
        this.preview = { kind: 'polyline', points, direction: lastDirection(points) };
        this.prompt = { kind: 'point', input: 'distance', from: points.at(-1)!, text: () => t('prompt.polylineLength') };
    }
}

/** Unit vector of the last segment through `points` (at least two, the last two apart). */
function lastDirection(points: readonly Point[]): Vector2 {
    const to = points.at(-1)!;
    const from = points.at(-2)!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}
