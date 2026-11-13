import { t } from '../../../i18n/i18n';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddEllipseCommand } from '../commands/AddEllipseCommand';
import type { EditorTool, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

/** The ways ELLIPSE draws an ellipse, as the tool bar offers them. */
export const ELLIPSE_METHODS = ['axisEnd', 'center'] as const;
export type EllipseMethod = (typeof ELLIPSE_METHODS)[number];

type State =
    /** The first end of the first axis. */
    | { kind: 'axisStart' }
    /** The other end of the first axis, from `start`. */
    | { kind: 'axisOtherEnd'; start: Point }
    /** Option "Mittelpunkt": the centre, then one end of the first axis. */
    | { kind: 'center' }
    | { kind: 'axisEnd'; center: Point }
    /** The first axis is known: the distance to the other one, from the centre. */
    | { kind: 'otherAxis'; center: Point; radiusX: number; rotation: number }
    /** Option "Drehung": the angle a circle on the first axis is turned about it. */
    | { kind: 'turn'; center: Point; radiusX: number; rotation: number };

/**
 * The largest turn about the first axis in degrees, like AutoCAD: beyond it the ellipse is too
 * flat to draw.
 */
export const MAX_TURN_DEGREES = 89.4;

/** The other radius of a circle of `radius` turned by `degrees` about its axis; null beyond MAX_TURN_DEGREES. */
function turnedRadius(radius: number, degrees: number): number | null {
    const ratio = Math.abs(Math.cos((degrees * Math.PI) / 180));
    return ratio >= Math.cos((MAX_TURN_DEGREES * Math.PI) / 180) ? radius * ratio : null;
}

/**
 * ELLIPSE (AutoCAD ELLIPSE): one ellipse, and the command ends. By default both ends of the first
 * axis, with the option "Mittelpunkt" the centre and one end of it. Then the distance to the
 * other axis (half its length; a `distance` prompt from the centre: typed, or the distance to a
 * point given), or with the option "Drehung" there the angle a circle on the first axis is
 * turned about it (an `angle` prompt from the centre; the other radius is the first times its
 * cosine). The first axis becomes the element's `radiusX` at its angle, so it may be the
 * major or the minor one. A first axis of no length is ignored, the prompt stays; Esc ends
 * without an ellipse. Started with the method `center` it asks for the centre straight away.
 */
export class EllipseTool implements EditorTool {
    readonly command = 'ELLIPSE';
    readonly highlighted = NOTHING;
    /** The method the prompts follow now: the one it started with, or the one the option chose. */
    method: EllipseMethod;
    private state: State = { kind: 'axisStart' };
    prompt: ToolPrompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.ellipseAxisStart') };
    preview: ToolPreview | null = null;

    constructor(method: EllipseMethod = 'axisEnd') {
        this.method = method;
        if (method === 'center') {
            this.askCenter();
        }
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
            case 'axisStart':
                this.state = { kind: 'axisOtherEnd', start: point };
                this.askAxisEnd(point, () => t('prompt.ellipseAxisOtherEnd'));
                return {};
            case 'axisOtherEnd': {
                const { start } = state;
                if (point.x !== start.x || point.y !== start.y) {
                    const center = { x: (start.x + point.x) / 2, y: (start.y + point.y) / 2 };
                    this.askOtherAxis(center, point);
                }
                return {};
            }
            case 'center':
                this.state = { kind: 'axisEnd', center: point };
                this.askAxisEnd(point, () => t('prompt.ellipseAxisEnd'));
                return {};
            case 'axisEnd':
                if (point.x !== state.center.x || point.y !== state.center.y) {
                    this.askOtherAxis(state.center, point);
                }
                return {};
            case 'otherAxis':
            case 'turn':
                return {};
        }
    }

    /** The turn about the first axis: typed, or the direction from the centre to a point given. */
    angle(degrees: number): ToolStep {
        const state = this.state;
        if (state.kind !== 'turn') {
            return {};
        }
        const { center, radiusX, rotation } = state;
        const radiusY = turnedRadius(radiusX, degrees);
        if (radiusY === null) {
            return { message: () => t('message.ellipseTurnInvalid', { max: MAX_TURN_DEGREES }) };
        }
        return { done: true, command: new AddEllipseCommand({ center, radiusX, radiusY, rotation }) };
    }

    /** The distance to the other axis: only a positive one, else the prompt stays. */
    distance(distance: number): ToolStep {
        const state = this.state;
        if (state.kind !== 'otherAxis') {
            return {};
        }
        if (!(distance > 0)) {
            return { message: () => t('message.positiveValue') };
        }
        const { center, radiusX, rotation } = state;
        return { done: true, command: new AddEllipseCommand({ center, radiusX, radiusY: distance, rotation }) };
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        if (state.kind === 'axisStart' && matchesKeyword(text, t('message.centerKeyword'))) {
            this.askCenter();
            return {};
        }
        if (state.kind === 'otherAxis' && matchesKeyword(text, t('message.rotationKeyword'))) {
            const { center, radiusX, rotation } = state;
            this.state = { ...state, kind: 'turn' };
            this.preview = {
                kind: 'curve',
                curveAt: (point) => {
                    const degrees = (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
                    const radiusY = turnedRadius(radiusX, degrees);
                    return radiusY === null ? null : { kind: 'ellipse', center, radiusX, radiusY, rotation };
                },
                rubberBand: true,
            };
            this.prompt = { kind: 'point', input: 'angle', from: center, text: () => t('prompt.ellipseTurn') };
            return {};
        }
        return null;
    }

    private askCenter(): void {
        this.method = 'center';
        this.state = { kind: 'center' };
        this.prompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.ellipseCenter') };
    }

    cancel(): void {}

    /** A point at the other end of the first axis from `from`, with a rubber band to it. */
    private askAxisEnd(from: Point, text: () => string): void {
        this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
        this.prompt = { kind: 'point', input: 'next', from, text };
    }

    /** The first axis runs from `center` to `end`. */
    private askOtherAxis(center: Point, end: Point): void {
        const radiusX = Math.hypot(end.x - center.x, end.y - center.y);
        const rotation = Math.atan2(end.y - center.y, end.x - center.x);
        this.state = { kind: 'otherAxis', center, radiusX, rotation };
        this.preview = {
            kind: 'curve',
            curveAt: (point) => {
                const radiusY = Math.hypot(point.x - center.x, point.y - center.y);
                return radiusY > 0 ? { kind: 'ellipse', center, radiusX, radiusY, rotation } : null;
            },
            rubberBand: true,
        };
        this.prompt = { kind: 'point', input: 'distance', from: center, text: () => t('prompt.ellipseOtherAxis') };
    }
}
