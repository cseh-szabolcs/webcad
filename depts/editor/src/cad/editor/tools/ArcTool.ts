import { t } from '../../../i18n/i18n';
import { arcEndToward, arcThrough } from '../../geometry/arc';
import { rotationAbout, transformPoint } from '../../geometry/similarity';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddArcCommand } from '../commands/AddArcCommand';
import type { EditorTool, Message, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();
/** Degrees within which an included angle counts as none or as a full turn. */
const FULL_TURN_TOLERANCE = 1e-6;

/** The ways BOGEN draws an arc, as the tool bar offers them. */
export type ArcMethod = 'threePoints' | 'startCenterEnd' | 'startCenterAngle';

type State =
    | { kind: 'start' }
    /** Three points: the point on the arc, or the option for the centre. */
    | { kind: 'second'; start: Point }
    | { kind: 'end'; start: Point; second: Point }
    | { kind: 'center'; start: Point }
    /** Start, centre, end: the point the arc ends towards, in the direction Ctrl switches. */
    | { kind: 'centerEnd'; start: Point; center: Point; clockwise: boolean }
    /** Start, centre, angle: the included angle, which Ctrl turns the other way (`reversed`). */
    | { kind: 'angle'; start: Point; center: Point; reversed: boolean };

/**
 * BOGEN (AutoCAD ARC): one arc, and the command ends. By default through three points: the
 * start, a point on the arc and the end, which also give its direction. With the option
 * "Zentrum" at the second point (or started with the method `startCenterEnd`, which asks for it
 * straight away) the start, the centre and a point the arc ends towards: the radius is the
 * distance from the centre to the start, the arc runs counter-clockwise, or clockwise after
 * Ctrl. With the option "Winkel" there (or the method `startCenterAngle`) the included angle
 * instead of that point: typed (a negative one runs clockwise), or the direction from the centre
 * to a point given, measured from +X like every angle, not from the start; Ctrl turns it the
 * other way. Points that give no arc are ignored, the prompt stays. Esc ends without an arc.
 */
export class ArcTool implements EditorTool {
    readonly command = 'ARC';
    readonly highlighted = NOTHING;
    /** The method the prompts follow now: the one it started with, or the one an option chose. */
    method: ArcMethod;
    private state: State = { kind: 'start' };
    prompt: ToolPrompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.arcStart') };
    preview: ToolPreview | null = null;

    constructor(method: ArcMethod = 'threePoints') {
        this.method = method;
    }

    start(): ToolStep {
        return {};
    }

    objectsSelected(): ToolStep {
        return {};
    }

    point(point: Point): ToolStep {
        const state = this.state;
        switch (state.kind) {
            case 'start':
                if (this.method !== 'threePoints') {
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
                return arc ? finish(arc.center, state.start, point, arc.clockwise) : {};
            }
            case 'center':
                if (same(point, state.start)) {
                    return {};
                }
                if (this.method === 'startCenterAngle') {
                    this.askAngle(state.start, point, false);
                } else {
                    this.previewCenterEnd(state.start, point, false);
                    this.ask(point, () => t('prompt.arcEndDirection'));
                }
                return {};
            case 'centerEnd': {
                const end = arcEndToward(state.center, state.start, point);
                return end ? finish(state.center, state.start, end, state.clockwise) : {};
            }
            case 'angle':
                // The editor gives the direction to a point as an angle
                return {};
        }
    }

    distance(): ToolStep {
        return {};
    }

    /** The included angle: typed, or the direction from the centre to a point given. */
    angle(degrees: number): ToolStep {
        const state = this.state;
        if (state.kind !== 'angle') {
            return {};
        }
        const arc = arcByAngle(state.start, state.center, degrees, state.reversed);
        return arc ? finish(state.center, state.start, arc.end, arc.clockwise) : { message: () => t('message.arcAngleInvalid') };
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        if (state.kind === 'second' && matchesKeyword(text, t('message.arcCenterKeyword'))) {
            this.askCenter(state.start);
            return {};
        }
        if (state.kind === 'centerEnd' && matchesKeyword(text, t('message.angleKeyword'))) {
            this.askAngle(state.start, state.center, state.clockwise);
            return {};
        }
        return null;
    }

    /** Ctrl: the other direction, while the end or the angle of an arc around its centre is asked for. */
    cycle(): ToolStep | null {
        const state = this.state;
        // The prompt stays, so what was typed or tracked so far does too
        if (state.kind === 'centerEnd') {
            this.previewCenterEnd(state.start, state.center, !state.clockwise);
            return {};
        }
        if (state.kind === 'angle') {
            this.previewAngle(state.start, state.center, !state.reversed);
            return {};
        }
        return null;
    }

    cancel(): void {}

    private askCenter(start: Point): void {
        if (this.method === 'threePoints') {
            this.method = 'startCenterEnd';
        }
        this.state = { kind: 'center', start };
        // Only the rubber band from the start
        this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
        this.ask(start, () => t('prompt.arcCenter'));
    }

    /** The preview of the arc around `center` in that direction, with a rubber band from the centre. */
    private previewCenterEnd(start: Point, center: Point, clockwise: boolean): void {
        this.state = { kind: 'centerEnd', start, center, clockwise };
        this.preview = {
            kind: 'curve',
            curveAt: (point) => {
                const end = arcEndToward(center, start, point);
                return end && { kind: 'arc', center, start, end, clockwise };
            },
            rubberBand: true,
        };
    }

    private askAngle(start: Point, center: Point, reversed: boolean): void {
        this.method = 'startCenterAngle';
        this.previewAngle(start, center, reversed);
        this.prompt = { kind: 'point', input: 'angle', from: center, text: () => t('prompt.arcAngle') };
    }

    /** The preview of the arc over the angle of the direction from `center` to the point. */
    private previewAngle(start: Point, center: Point, reversed: boolean): void {
        this.state = { kind: 'angle', start, center, reversed };
        this.preview = {
            kind: 'curve',
            curveAt: (point) => {
                const degrees = (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
                const arc = arcByAngle(start, center, degrees < 0 ? degrees + 360 : degrees, reversed);
                return arc && { kind: 'arc', center, start, ...arc };
            },
            rubberBand: true,
        };
    }

    /** The next point, measured from the one before. */
    private ask(from: Point, text: Message): void {
        this.prompt = { kind: 'point', input: 'next', from, text };
    }
}

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/**
 * Where the arc from `start` around `center` over `degrees` ends, and its direction: counter-
 * clockwise for a positive angle, the other way round if `reversed`. Null for no angle or full turns.
 */
function arcByAngle(start: Point, center: Point, degrees: number, reversed: boolean): { end: Point; clockwise: boolean } | null {
    const sweep = (reversed ? -degrees : degrees) % 360;
    // An arc that closes would be a full circle (see `arcSweep`)
    if (!(Math.abs(sweep) > FULL_TURN_TOLERANCE && 360 - Math.abs(sweep) > FULL_TURN_TOLERANCE)) {
        return null;
    }
    return { end: transformPoint(rotationAbout(center, sweep), start), clockwise: sweep < 0 };
}

/** Ends BOGEN with the arc as one undo step. */
function finish(center: Point, start: Point, end: Point, clockwise: boolean): ToolStep {
    return { done: true, command: new AddArcCommand(center, start, end, clockwise) };
}
