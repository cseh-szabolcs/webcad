import { t } from '../../../i18n/i18n';
import { arcCenterOverChord, arcEndToward, arcThrough } from '../../geometry/arc';
import { rotationAbout, transformPoint } from '../../geometry/similarity';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddArcCommand } from '../commands/AddArcCommand';
import type { DocumentHistory } from '../commands/DocumentHistory';
import { continueFrom, type DrawingMemory } from './DrawingMemory';
import type { EditorTool, Message, PreviewCurve, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();
/** Degrees within which an included angle counts as none or as a full turn. */
const FULL_TURN_TOLERANCE = 1e-6;
/** Relative to the diameter, by which a chord may exceed it and still count as the diameter. */
const CHORD_TOLERANCE = 1e-9;

/**
 * The ways BOGEN draws an arc, as the tool bar offers them: through three points; around a
 * centre, named by the order of start and centre and by what comes last; over its start and
 * end, named by what defines it then; or on from what was drawn last.
 */
export type ArcMethod =
    | 'threePoints'
    | `${'startCenter' | 'centerStart'}${Last}`
    | `startEnd${Exclude<Defining, 'Center'>}`
    | 'continue';

/** What an arc around its centre takes last: a point it ends towards, its angle or its chord. */
type Last = 'End' | 'Angle' | 'Length';

/** What defines an arc over its start and end: its centre (only by the option "Endpunkt"), angle, start direction or radius. */
type Defining = 'Center' | 'Angle' | 'Direction' | 'Radius';

/** The method the tool follows: one of the tool bar, or start, end, centre, which only the options give. */
type Method = ArcMethod | 'startEndCenter';

const lastOf = (method: Method): Last =>
    method.startsWith('startEnd') ? 'End' : method.endsWith('Angle') ? 'Angle' : method.endsWith('Length') ? 'Length' : 'End';
const centerFirst = (method: Method) => method.startsWith('centerStart');
const definingOf = (method: Method): Defining | null => (method.startsWith('startEnd') ? (method.slice(8) as Defining) : null);

/** Start and centre of an arc; `reversed` once Ctrl turned it clockwise (or a negative angle back). */
interface Around {
    start: Point;
    center: Point;
    reversed: boolean;
}

/** Start and end of an arc; `reversed` once Ctrl turned it the other way. */
interface Chord {
    start: Point;
    end: Point;
    reversed: boolean;
}

type AroundKind = 'centerEnd' | 'angle' | 'length';
type ChordKind = `chord${Defining}`;

type State =
    /** The start, or the option for the centre first. */
    | { kind: 'start' }
    /** Three points: the point on the arc, or the option for the centre or for the end. */
    | { kind: 'second'; start: Point }
    | { kind: 'end'; start: Point; second: Point }
    /** The centre, after the start or (`start` null) before it. */
    | { kind: 'center'; start: Point | null }
    | { kind: 'startAfterCenter'; center: Point }
    /** Around a centre: the point the arc ends towards, its included angle, or the length of its chord. */
    | ({ kind: AroundKind } & Around)
    /** The end straight after the start. */
    | { kind: 'endAfterStart'; start: Point }
    /** Over start and end: the centre, the included angle, the direction at the start, or the radius. */
    | ({ kind: ChordKind } & Chord)
    /** Continuing: the end of an arc that leaves `start` in `direction` (degrees), the other way once `reversed`. */
    | { kind: 'tangentEnd'; start: Point; direction: number; reversed: boolean };

/**
 * BOGEN (AutoCAD ARC): one arc, and the command ends. By default through three points: the
 * start, a point on the arc and the end, which also give its direction.
 *
 * With the option "Zentrum" at the start or at the second point (or started with another method
 * than `threePoints`, which asks that way straight away) around a centre, given before or after
 * the start: the radius is the distance between them. The arc runs counter-clockwise from the
 * start, clockwise after Ctrl, and ends by one of:
 * - a point it ends towards (on the ray from the centre through it);
 * - with the option "Winkel" the included angle: typed (a negative one runs clockwise), or the
 *   direction from the centre to a point given, measured from +X like every angle, not from the
 *   start;
 * - with the option "sehnenLänge" the length of its chord: typed, or the distance from the start
 *   to a point given; a negative one gives the major arc.
 *
 * With the option "Endpunkt" at the second point (or started with a method `startEnd…`) over its
 * start and end, which stay where they were given, defined by one of:
 * - the centre (the arc then only ends towards the end given, as around a centre);
 * - with the option "Winkel" the included angle, typed or pointed from the start;
 * - with the option "RIchtung" the direction it leaves the start in: typed degrees, or the
 *   direction from the start to a point given;
 * - with the option "RAdius" the radius: typed, or the distance from the end to a point given;
 *   a negative one gives the major arc.
 * Ctrl turns each of them the other way.
 *
 * Enter on its own at the start (or the method `continue`) goes on from the line, polyline or arc
 * drawn last (see DrawingMemory): from its end, leaving in the direction it arrives there, to
 * the end given; Ctrl leaves the other way. BOGEN remembers its arc for that in turn.
 *
 * Points and values that give no arc are ignored or reported, the prompt stays. Esc ends
 * without an arc.
 */
export class ArcTool implements EditorTool {
    readonly command = 'ARC';
    readonly highlighted = NOTHING;
    /** The method the prompts follow now: the one it started with, or the one the options chose. */
    method: Method;
    private state: State = { kind: 'start' };
    prompt: ToolPrompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.arcStart') };
    preview: ToolPreview | null = null;

    private readonly history: DocumentHistory;
    private readonly memory: DrawingMemory;

    constructor(history: DocumentHistory, memory: DrawingMemory, method: ArcMethod = 'threePoints') {
        this.history = history;
        this.memory = memory;
        this.method = method;
        if (centerFirst(method)) {
            this.askCenter(null);
        }
    }

    start(): ToolStep {
        return this.method === 'continue' ? this.continueLast() : {};
    }

    objectsSelected(): ToolStep {
        return {};
    }

    point(point: Point): ToolStep {
        const state = this.state;
        switch (state.kind) {
            case 'start':
                if (definingOf(this.method) !== null) {
                    this.askEnd(point);
                } else if (this.method !== 'threePoints') {
                    this.askCenter(point);
                } else {
                    this.state = { kind: 'second', start: point };
                    // Only the rubber band, as two points give no arc yet
                    this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
                    this.ask(point, () => t('prompt.arcSecond'));
                }
                return {};
            case 'second': {
                const { start } = state;
                if (same(point, start)) {
                    return {};
                }
                this.state = { kind: 'end', start, second: point };
                this.preview = {
                    kind: 'curve',
                    curveAt: (end) => {
                        const arc = arcThrough(start, point, end);
                        return arc && { kind: 'arc', center: arc.center, start, end, clockwise: arc.clockwise };
                    },
                    rubberBand: false,
                };
                this.ask(point, () => t('prompt.arcEnd'));
                return {};
            }
            case 'end': {
                const arc = arcThrough(state.start, state.second, point);
                return arc ? this.finish(arc.center, state.start, point, arc.clockwise) : {};
            }
            case 'tangentEnd': {
                const arc = arcOverChord('chordDirection', { start: state.start, end: point, reversed: state.reversed }, state.direction);
                return arc ? this.finish(arc.center, state.start, arc.end, arc.clockwise) : {};
            }
            case 'center':
                if (state.start === null) {
                    this.state = { kind: 'startAfterCenter', center: point };
                    // Only the rubber band from the centre
                    this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
                    this.ask(point, () => t('prompt.arcStartAfterCenter'));
                } else if (!same(point, state.start)) {
                    this.askLast({ start: state.start, center: point, reversed: false }, lastOf(this.method));
                }
                return {};
            case 'startAfterCenter':
                if (!same(point, state.center)) {
                    this.askLast({ start: point, center: state.center, reversed: false }, lastOf(this.method));
                }
                return {};
            case 'centerEnd': {
                const arc = arcAround(state, point);
                return arc ? this.finish(state.center, state.start, arc.end, arc.clockwise) : {};
            }
            case 'endAfterStart':
                if (!same(point, state.start)) {
                    this.askDefining({ start: state.start, end: point, reversed: false }, definingOf(this.method) ?? 'Center');
                }
                return {};
            case 'chordCenter': {
                const arc = arcOverChord(state.kind, state, point);
                return arc ? this.finish(arc.center, state.start, arc.end, arc.clockwise) : {};
            }
            case 'angle':
            case 'length':
            case 'chordAngle':
            case 'chordDirection':
            case 'chordRadius':
                // The editor gives a point as the angle or the distance it stands for
                return {};
        }
    }

    /** The length of the chord or the radius: typed, or the distance from the prompt's point to a point given. */
    distance(distance: number): ToolStep {
        const state = this.state;
        if (state.kind === 'length') {
            const arc = arcByChord(state, distance);
            return arc ? this.finish(state.center, state.start, arc.end, arc.clockwise) : { message: () => t('message.arcChordInvalid') };
        }
        if (state.kind === 'chordRadius') {
            const arc = arcOverChord(state.kind, state, distance);
            return arc ? this.finish(arc.center, state.start, arc.end, arc.clockwise) : { message: () => t('message.arcRadiusInvalid') };
        }
        return {};
    }

    /** The included angle or the direction at the start: typed, or the direction from the prompt's point to a point given. */
    angle(degrees: number): ToolStep {
        const state = this.state;
        if (state.kind === 'angle') {
            const arc = arcByAngle(state, degrees);
            return arc ? this.finish(state.center, state.start, arc.end, arc.clockwise) : { message: () => t('message.arcAngleInvalid') };
        }
        if (state.kind === 'chordAngle' || state.kind === 'chordDirection') {
            const arc = arcOverChord(state.kind, state, degrees);
            const invalid = state.kind === 'chordAngle' ? 'message.arcAngleInvalid' : 'message.arcDirectionInvalid';
            return arc ? this.finish(arc.center, state.start, arc.end, arc.clockwise) : { message: () => t(invalid) };
        }
        return {};
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        const center = matchesKeyword(text, t('message.arcCenterKeyword'));
        if (state.kind === 'start' && text === '') {
            return this.continueLast();
        }
        if (state.kind === 'start' && center) {
            this.method = `centerStart${lastOf(this.method)}`;
            this.askCenter(null);
            return {};
        }
        if (state.kind === 'second' && center) {
            this.askCenter(state.start);
            return {};
        }
        if (state.kind === 'second' && matchesKeyword(text, t('message.arcEndKeyword'))) {
            this.method = 'startEndCenter';
            this.askEnd(state.start);
            return {};
        }
        if (state.kind === 'chordCenter') {
            const defining = (['Angle', 'Direction', 'Radius'] as const).find((option) =>
                matchesKeyword(text, t(`message.${DEFINING_KEYWORDS[option]}`)),
            );
            if (defining) {
                this.askDefining(state, defining);
                return {};
            }
        }
        if (state.kind === 'centerEnd' && matchesKeyword(text, t('message.angleKeyword'))) {
            this.askLast(state, 'Angle');
            return {};
        }
        if (state.kind === 'centerEnd' && matchesKeyword(text, t('message.lengthKeyword'))) {
            this.askLast(state, 'Length');
            return {};
        }
        return null;
    }

    /** Ctrl: the other direction, while an arc with two points given asks for what comes last. */
    cycle(): ToolStep | null {
        const state = this.state;
        // The prompt stays, so what was typed or tracked so far does too
        switch (state.kind) {
            case 'centerEnd':
            case 'angle':
            case 'length':
                this.previewLast(state.kind, { ...state, reversed: !state.reversed });
                return {};
            case 'chordCenter':
            case 'chordAngle':
            case 'chordDirection':
            case 'chordRadius':
                this.previewDefining(state.kind, { ...state, reversed: !state.reversed });
                return {};
            case 'tangentEnd':
                this.previewTangent(state.start, state.direction, !state.reversed);
                return {};
            default:
                return null;
        }
    }

    cancel(): void {}

    /** The centre: after `start` with a rubber band from it, or first. */
    private askCenter(start: Point | null): void {
        if (this.method === 'threePoints') {
            this.method = 'startCenterEnd';
        }
        this.state = { kind: 'center', start };
        if (start === null) {
            this.preview = null;
            this.prompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.arcCenter') };
        } else {
            this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
            this.ask(start, () => t('prompt.arcCenter'));
        }
    }

    /** What ends the arc around its centre, which makes it the method the tool follows. */
    private askLast(around: Around, last: Last): void {
        const { start, center } = around;
        this.method = `${centerFirst(this.method) ? 'centerStart' : 'startCenter'}${last}`;
        switch (last) {
            case 'End':
                this.previewLast('centerEnd', around);
                this.ask(center, () => t('prompt.arcEndDirection'));
                break;
            case 'Angle':
                this.previewLast('angle', around);
                this.prompt = { kind: 'point', input: 'angle', from: center, text: () => t('prompt.arcAngle') };
                break;
            case 'Length':
                this.previewLast('length', around);
                this.prompt = { kind: 'point', input: 'distance', from: start, text: () => t('prompt.arcChord') };
                break;
        }
    }

    /** The preview of the arc a point would give at that prompt, with a rubber band from the prompt's point. */
    private previewLast(kind: 'centerEnd' | 'angle' | 'length', around: Around): void {
        const { start, center, reversed } = around;
        // Not spread: `around` may be a state with a kind of its own
        this.state = { kind, start, center, reversed };
        const shown = (arc: ArcEnd | null): PreviewCurve | null => arc && { kind: 'arc', center, start, ...arc };
        this.preview = {
            kind: 'curve',
            curveAt: (point) =>
                shown(
                    kind === 'centerEnd'
                        ? arcAround(around, point)
                        : kind === 'angle'
                          ? arcByAngle(around, directionDegrees(center, point))
                          : arcByChord(around, Math.hypot(point.x - start.x, point.y - start.y)),
                ),
            // A typed angle or length keeps its sign
            curveFor: kind === 'centerEnd' ? undefined : (value) => shown(kind === 'angle' ? arcByAngle(around, value) : arcByChord(around, value)),
            rubberBand: true,
        };
    }

    /** The end straight after `start`, with a rubber band from it. */
    private askEnd(start: Point): void {
        this.state = { kind: 'endAfterStart', start };
        this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
        this.ask(start, () => t('prompt.arcEnd'));
    }

    /** What defines the arc over its start and end, which makes it the method the tool follows. */
    private askDefining(chord: Chord, defining: Defining): void {
        const { start, end } = chord;
        this.method = `startEnd${defining}`;
        this.previewDefining(`chord${defining}`, chord);
        switch (defining) {
            case 'Center':
                this.ask(end, () => t('prompt.arcCenterOptions'));
                break;
            case 'Angle':
                this.prompt = { kind: 'point', input: 'angle', from: start, text: () => t('prompt.arcAngle') };
                break;
            case 'Direction':
                this.prompt = { kind: 'point', input: 'angle', from: start, text: () => t('prompt.arcDirection') };
                break;
            case 'Radius':
                this.prompt = { kind: 'point', input: 'distance', from: end, text: () => t('prompt.arcRadius') };
                break;
        }
    }

    /** The preview of the arc a point would give at that prompt, with a rubber band from the prompt's point. */
    private previewDefining(kind: ChordKind, chord: Chord): void {
        const { start, end, reversed } = chord;
        this.state = { kind, start, end, reversed };
        const from = kind === 'chordRadius' || kind === 'chordCenter' ? end : start;
        const shown = (value: Point | number): PreviewCurve | null => {
            const arc = arcOverChord(kind, chord, value);
            return arc && { kind: 'arc', start, ...arc };
        };
        this.preview = {
            kind: 'curve',
            curveAt: (point) =>
                shown(
                    kind === 'chordCenter'
                        ? point
                        : kind === 'chordRadius'
                          ? Math.hypot(point.x - from.x, point.y - from.y)
                          : directionDegrees(from, point),
                ),
            // A typed angle, direction or radius keeps its sign
            curveFor: kind === 'chordCenter' ? undefined : shown,
            rubberBand: true,
        };
    }

    /**
     * Enter at the start: on from the end of what was drawn last, in the direction it arrives
     * there. Without it the start stays to be given, as for three points.
     */
    private continueLast(): ToolStep {
        const last = continueFrom(this.history.document, this.memory.lastDrawn);
        if (last === null) {
            if (this.method === 'continue') {
                this.method = 'threePoints';
            }
            return { message: () => t('message.noLineToContinue') };
        }
        this.method = 'continue';
        this.previewTangent(last.point, (last.direction * 180) / Math.PI, false);
        this.ask(last.point, () => t('prompt.arcEndTangent'));
        return {};
    }

    /** The preview of the arc from `start` to a point that leaves it in `direction`. */
    private previewTangent(start: Point, direction: number, reversed: boolean): void {
        this.state = { kind: 'tangentEnd', start, direction, reversed };
        this.preview = {
            kind: 'curve',
            curveAt: (end) => {
                const arc = arcOverChord('chordDirection', { start, end, reversed }, direction);
                return arc && { kind: 'arc', start, ...arc };
            },
            rubberBand: true,
        };
    }

    /** Ends BOGEN with the arc as one undo step, and remembers it to continue from. */
    private finish(center: Point, start: Point, end: Point, clockwise: boolean): ToolStep {
        const command = new AddArcCommand(center, start, end, clockwise);
        this.memory.lastDrawn = command.arcId;
        return { done: true, command };
    }

    /** The next point, measured from the one before. */
    private ask(from: Point, text: Message): void {
        this.prompt = { kind: 'point', input: 'next', from, text };
    }
}

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** Direction from `from` to `to` in degrees, from 0 up to 360, as the editor gives a pointed angle. */
function directionDegrees(from: Point, to: Point): number {
    const degrees = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    return degrees < 0 ? degrees + 360 : degrees;
}

interface ArcEnd {
    end: Point;
    clockwise: boolean;
}

/** The arc that ends on the ray from the centre through `toward`; null where that gives none. */
function arcAround({ start, center, reversed }: Around, toward: Point): ArcEnd | null {
    const end = arcEndToward(center, start, toward);
    return end && { end, clockwise: reversed };
}

/**
 * The arc over `degrees`: counter-clockwise for a positive angle, the other way round if
 * `reversed`. Null for no angle or full turns.
 */
function arcByAngle({ start, center, reversed }: Around, degrees: number): ArcEnd | null {
    const sweep = sweepOf(degrees, reversed);
    return sweep === null ? null : { end: transformPoint(rotationAbout(center, sweep), start), clockwise: sweep < 0 };
}

/** The signed sweep of an included angle without its full turns; null for none or a full turn. */
function sweepOf(degrees: number, reversed: boolean): number | null {
    const sweep = (reversed ? -degrees : degrees) % 360;
    // An arc that closes would be a full circle (see `arcSweep`)
    return Math.abs(sweep) > FULL_TURN_TOLERANCE && 360 - Math.abs(sweep) > FULL_TURN_TOLERANCE ? sweep : null;
}

/**
 * The arc whose chord from the start is `length` long: the minor arc, for a negative length the
 * major one. Null for no length or one beyond the diameter.
 */
function arcByChord(around: Around, length: number): ArcEnd | null {
    const { start, center } = around;
    const ratio = Math.abs(length) / (2 * Math.hypot(start.x - center.x, start.y - center.y));
    if (!(ratio > 0 && ratio <= 1 + CHORD_TOLERANCE)) {
        return null;
    }
    const minor = (2 * Math.asin(Math.min(ratio, 1)) * 180) / Math.PI;
    return arcByAngle(around, length < 0 ? 360 - minor : minor);
}

/** The options of the centre prompt of an arc over its start and end, as keys of their keywords. */
const DEFINING_KEYWORDS = { Angle: 'angleKeyword', Direction: 'arcDirectionKeyword', Radius: 'arcRadiusKeyword' } as const;

interface ArcOverChord extends ArcEnd {
    center: Point;
}

/**
 * The arc from the start of `chord` to its end that `value` defines at that prompt: its centre
 * (it then only ends towards the end, on the circle through the start), its included angle or
 * the direction it leaves the start in (degrees), or its radius (negative: the major arc). Null
 * where that gives none.
 */
function arcOverChord(kind: ChordKind, chord: Chord, value: Point | number): ArcOverChord | null {
    const { start, end, reversed } = chord;
    if (typeof value !== 'number') {
        const arc = arcAround({ start, center: value, reversed }, end);
        return arc && { center: value, ...arc };
    }
    let degrees: number;
    if (kind === 'chordRadius') {
        const ratio = Math.hypot(end.x - start.x, end.y - start.y) / (2 * Math.abs(value));
        if (!(ratio > 0 && ratio <= 1 + CHORD_TOLERANCE)) {
            return null;
        }
        const minor = (2 * Math.asin(Math.min(ratio, 1)) * 180) / Math.PI;
        degrees = value < 0 ? 360 - minor : minor;
    } else if (kind === 'chordDirection') {
        // Twice the angle from the direction at the start to the chord, counter-clockwise if positive
        const turn = directionDegrees(start, end) - value;
        degrees = 2 * (turn - 360 * Math.round(turn / 360));
    } else {
        degrees = value;
    }
    // Ctrl leaves the start the other way: the rest of the same circle for a direction
    const sweep = sweepOf(kind === 'chordDirection' && reversed ? degrees - Math.sign(degrees) * 360 : degrees, kind !== 'chordDirection' && reversed);
    const center = sweep === null ? null : arcCenterOverChord(start, end, (sweep * Math.PI) / 180);
    return center && { center, end, clockwise: sweep! < 0 };
}
