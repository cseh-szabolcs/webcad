import { t } from '../../../i18n/i18n';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddEllipseCommand } from '../commands/AddEllipseCommand';
import type { EditorTool, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

type State =
    /** The first end of the first axis. */
    | { kind: 'axisStart' }
    /** The other end of the first axis, from `start`. */
    | { kind: 'axisOtherEnd'; start: Point }
    /** Option "Mittelpunkt": the centre, then one end of the first axis. */
    | { kind: 'center' }
    | { kind: 'axisEnd'; center: Point }
    /** The first axis is known: the distance to the other one, from the centre. */
    | { kind: 'otherAxis'; center: Point; radiusX: number; rotation: number };

/**
 * ELLIPSE (AutoCAD ELLIPSE): one ellipse, and the command ends. By default both ends of the first
 * axis, with the option "Mittelpunkt" the centre and one end of it. Then the distance to the
 * other axis (half its length; a `distance` prompt from the centre: typed, or the distance to a
 * point given). The first axis becomes the element's `radiusX` at its angle, so it may be the
 * major or the minor one. A first axis of no length is ignored, the prompt stays; Esc ends
 * without an ellipse.
 */
export class EllipseTool implements EditorTool {
    readonly command = 'ELLIPSE';
    readonly highlighted = NOTHING;
    private state: State = { kind: 'axisStart' };
    prompt: ToolPrompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.ellipseAxisStart') };
    preview: ToolPreview | null = null;

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
                return {};
        }
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
        if (this.state.kind === 'axisStart' && matchesKeyword(text, t('message.centerKeyword'))) {
            this.state = { kind: 'center' };
            this.prompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.ellipseCenter') };
            return {};
        }
        return null;
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
