import type { Id, Point } from '../../model/Point';
import type { EditorCommand } from '../commandNames';
import type { DocumentCommand } from '../commands/DocumentCommand';

/**
 * Command line text, translated only when the editor builds a snapshot, so a language change
 * shows at once (see SelectionEditor.refreshTexts).
 */
export type Message = () => string;

/**
 * What a point prompt asks for, which decides how the editor helps and reads typed input:
 * - `point`: a point on its own (`@` goes from the last point given, AutoCAD's LASTPOINT;
 *   Dynamic Input shows X/Y at the crosshair);
 * - `next`: a point measured from the prompt's `from` point: polar tracking, Ortho, direct
 *   distance entry, `@` and the Dynamic Input dimension (distance and angle) start there;
 * - `vector`: a displacement, so typed input is a vector either way.
 */
export type PointPromptKind = 'point' | 'next' | 'vector';

export interface PointPrompt {
    kind: 'point';
    text: Message;
    input: PointPromptKind;
    /** The point a `next` prompt measures from; null for the other kinds. */
    from: Point | null;
}

/**
 * What a running command asks for. The editor starts a new prompt whenever the tool's prompt
 * object changes, so a tool replaces it to ask again (e.g. for the next point).
 */
export type ToolPrompt =
    /** Object selection (verb-noun): the editor collects it and hands it over with objectsSelected. */
    | { kind: 'select'; text: Message }
    | PointPrompt;

/** How the editor shows the point a click would take at a `next` prompt. */
export type ToolPreview =
    /** Copies of the highlighted elements offset from `from`, the originals dimmed, a dashed rubber band. */
    | 'move'
    /** A new line from `from`. */
    | 'line';

/** What a tool reports after handling an input. */
export interface ToolStep {
    /** The command ends. */
    done?: boolean;
    /** Command line message; none clears it. */
    message?: Message | null;
    /** Runs as one undo step once the command ended (with `done`). */
    command?: DocumentCommand;
}

/**
 * The state machine of one command (SCHIEBEN, LINIE …), driven by the editor (SelectionEditor),
 * which owns the object selection, snapping, tracking, Dynamic Input and typed input, and hands
 * the tool only what was given: the selected objects, a point, an option or Enter.
 */
export interface EditorTool {
    readonly command: EditorCommand;
    /** The current prompt; read by the editor after every call. */
    readonly prompt: ToolPrompt;
    /** Elements drawn as selected while the command asks for points. */
    readonly highlighted: ReadonlySet<Id>;
    readonly preview: ToolPreview | null;
    /** Starts the command with the pickfirst selection (noun-verb), which it may take over. */
    start(pickfirst: ReadonlySet<Id>): ToolStep;
    /** The object selection ended with at least one object. */
    objectsSelected(selection: ReadonlySet<Id>): ToolStep;
    /** A point was given at a point prompt: clicked, typed, or bound by Dynamic Input. */
    point(point: Point): ToolStep;
    /**
     * Typed text at a point prompt that is no point: an option keyword, or `''` for Enter on its
     * own. Null if the text means nothing here (the editor reports an invalid entry).
     */
    text(text: string): ToolStep | null;
    /** Right click at a point prompt; null does nothing. */
    rightClick(): ToolStep | null;
    /** Esc ends the command; the editor reports the cancel. */
    cancel(): void;
}
