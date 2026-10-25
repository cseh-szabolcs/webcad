import { t } from '../../../i18n/i18n';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddLineCommand } from '../commands/AddLineCommand';
import type { DocumentHistory } from '../commands/DocumentHistory';
import { continuePoint, type DrawingMemory } from './DrawingMemory';
import type { EditorTool, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

type State =
    | { kind: 'first' }
    /** A series from `start` (the target of "Schließen"); `segments` were drawn in this run, in order. */
    | { kind: 'next'; start: Point; last: Point; segments: AddLineCommand[] };

/**
 * LINIE (AutoCAD LINE): a series of connected but separate lines. After the first point every
 * point adds a line from the last one at once (see AddLineCommand), so it shows and snaps right
 * away; the option "Zurück" takes the last one back, "Schließen" (from two segments on) adds
 * one back to the first point and ends. Enter ends, Esc too; the lines drawn
 * stay and are one undo step together. Enter on its own at the first point continues from the
 * end of the line or polyline drawn last.
 */
export class LineTool implements EditorTool {
    readonly command = 'LINE';
    readonly preview = 'line';
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
        // A segment of no length draws nothing
        if (point.x !== state.last.x || point.y !== state.last.y) {
            this.addSegment(state, point);
            this.askNext(state);
        }
        return {};
    }

    distance(): ToolStep {
        return {};
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        if (state.kind === 'first') {
            return text === '' ? this.continueLast() : null;
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

    /** Enter at the first point: on from the end point of the line or polyline drawn last, where it is now. */
    private continueLast(): ToolStep {
        const point = continuePoint(this.history.document, this.memory.lastDrawn);
        if (!point) {
            return { message: () => t('message.noLineToContinue') };
        }
        this.askNext({ kind: 'next', start: point, last: point, segments: [] });
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
        const close = state.segments.length >= 2;
        this.prompt = {
            kind: 'point',
            input: 'next',
            from: state.last,
            text: () => t(close ? 'prompt.lineNextClose' : 'prompt.lineNext'),
        };
    }
}
