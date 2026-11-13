import { t } from '../../../i18n/i18n';
import type { Id, Point, Vector2 } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddLineCommand } from '../commands/AddLineCommand';
import type { DocumentHistory } from '../commands/DocumentHistory';
import { continueFrom, type DrawingMemory } from './DrawingMemory';
import type { EditorTool, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

type State =
    | { kind: 'first' }
    /** Continuing from an arc: the length of the first line, which leaves `start` in `direction` (a unit vector). */
    | { kind: 'length'; start: Point; direction: Vector2 }
    /** A series from `start` (the target of "Schließen"); `segments` were drawn in this run, in order. */
    | { kind: 'next'; start: Point; last: Point; segments: AddLineCommand[] };

/**
 * LINIE (AutoCAD LINE): a series of connected but separate lines. After the first point every
 * point adds a line from the last one at once (see AddLineCommand), so it shows and snaps right
 * away; the option "Zurück" takes the last one back, "Schließen" (from two segments on) adds
 * one back to the first point and ends. Enter ends, Esc too; the lines drawn
 * stay and are one undo step together. Enter on its own at the first point continues from the
 * end of the line, polyline or arc drawn last; from an arc tangentially, so the first line only
 * takes its length (a `distance` prompt from that end).
 */
export class LineTool implements EditorTool {
    readonly command = 'LINE';
    preview: ToolPreview = 'line';
    readonly highlighted = NOTHING;
    private readonly history: DocumentHistory;
    private readonly memory: DrawingMemory;
    /** What was drawn last before this run, for "continue" once all its segments are taken back. */
    private readonly lineBefore: Id | null;
    private state: State = { kind: 'first' };
    prompt: ToolPrompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.lineFirst') };

    constructor(history: DocumentHistory, memory: DrawingMemory) {
        this.history = history;
        this.memory = memory;
        this.lineBefore = memory.lastDrawn;
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
            this.askNext({ kind: 'next', start: point, last: point, segments: [] });
            return {};
        }
        if (state.kind === 'length') {
            // The editor gives a point as its distance
            return {};
        }
        // A segment of no length draws nothing
        if (point.x !== state.last.x || point.y !== state.last.y) {
            this.addSegment(state, point);
            this.askNext(state);
        }
        return {};
    }

    /** The length of the line that continues an arc: only a positive one, else the prompt stays. */
    distance(distance: number): ToolStep {
        const state = this.state;
        if (state.kind !== 'length') {
            return {};
        }
        if (!(distance > 0)) {
            return { message: () => t('message.positiveValue') };
        }
        const { start, direction } = state;
        const series: Extract<State, { kind: 'next' }> = { kind: 'next', start, last: start, segments: [] };
        this.addSegment(series, { x: start.x + direction.x * distance, y: start.y + direction.y * distance });
        this.askNext(series);
        return {};
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        if (state.kind === 'first') {
            return text === '' ? this.continueLast() : null;
        }
        // The length prompt has no options
        if (state.kind === 'length') {
            return null;
        }
        if (text === '') {
            return this.finish(state);
        }
        if (matchesKeyword(text, t('message.undoKeyword'))) {
            return this.undoSegment(state);
        }
        if (state.segments.length >= 2 && matchesKeyword(text, t('message.closeKeyword'))) {
            if (state.last.x !== state.start.x || state.last.y !== state.start.y) {
                this.addSegment(state, state.start);
            }
            return this.finish(state);
        }
        return null;
    }

    cancel(): void {
        if (this.state.kind === 'next') {
            this.finish(this.state);
        }
    }

    private addSegment(state: Extract<State, { kind: 'next' }>, to: Point): void {
        const segment = new AddLineCommand(state.last, to);
        this.history.execute(segment);
        this.memory.lastDrawn = segment.lineId;
        state.segments.push(segment);
        state.last = to;
    }

    private undoSegment(state: Extract<State, { kind: 'next' }>): ToolStep {
        const segment = state.segments.pop();
        if (!segment) {
            return { message: () => t('message.allSegmentsUndone') };
        }
        this.history.revertLast();
        state.last = segment.start;
        this.memory.lastDrawn = state.segments.at(-1)?.lineId ?? this.lineBefore;
        this.askNext(state);
        return {};
    }

    /**
     * Enter at the first point: on from the end point of the line, polyline or arc drawn last,
     * where it is now; from an arc in the direction it ends in, with only the length to give.
     */
    private continueLast(): ToolStep {
        const last = continueFrom(this.history.document, this.memory.lastDrawn);
        if (!last) {
            return { message: () => t('message.noLineToContinue') };
        }
        const { point, direction } = last;
        if (!last.curved) {
            this.askNext({ kind: 'next', start: point, last: point, segments: [] });
            return {};
        }
        const unit = { x: Math.cos(direction), y: Math.sin(direction) };
        this.state = { kind: 'length', start: point, direction: unit };
        this.preview = { kind: 'polyline', points: [point], direction: unit };
        this.prompt = { kind: 'point', input: 'distance', from: point, text: () => t('prompt.lineLength') };
        return {};
    }

    /** Ends the command: the segments of this run become one undo step. */
    private finish(state: Extract<State, { kind: 'next' }>): ToolStep {
        this.history.combineLast(state.segments.length, 'LINE');
        state.segments = [];
        return { done: true };
    }

    private askNext(state: Extract<State, { kind: 'next' }>): void {
        this.state = state;
        this.preview = 'line';
        const close = state.segments.length >= 2;
        this.prompt = {
            kind: 'point',
            input: 'next',
            from: state.last,
            text: () => t(close ? 'prompt.lineNextClose' : 'prompt.lineNext'),
        };
    }
}
