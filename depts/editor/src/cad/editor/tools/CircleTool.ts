import { t } from '../../../i18n/i18n';
import { circleOnDiameter, circleThrough, type CircleShape } from '../../geometry/circle';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddCircleCommand } from '../commands/AddCircleCommand';
import type { EditorTool, Message, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();
/** The options of the centre prompt, the same in every language and only taken whole. */
const THREE_POINTS = '3P';
const TWO_POINTS = '2P';

type State =
    | { kind: 'center' }
    /** The radius, or with `diameter` the diameter, from the centre. */
    | { kind: 'size'; center: Point; diameter: boolean }
    /** 2P: the points given so far (none or the first end of the diameter). */
    | { kind: 'twoPoints'; points: Point[] }
    /** 3P: the points on the circle given so far (none to two). */
    | { kind: 'threePoints'; points: Point[] };

/**
 * KREIS (AutoCAD CIRCLE): one circle, and the command ends. By default the centre, then the
 * radius (a `distance` prompt from the centre: typed, or the distance to a point given), or with
 * the option "Durchmesser" the diameter. The option "2P" takes the two ends of a diameter, "3P"
 * three points on the circle. Each prompt previews the circle a click would give. Points that give
 * no circle (on the last one, or three on a line) are ignored, the prompt stays. Esc ends without
 * a circle.
 */
export class CircleTool implements EditorTool {
    readonly command = 'CIRCLE';
    readonly highlighted = NOTHING;
    private state: State = { kind: 'center' };
    prompt: ToolPrompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.circleCenter') };
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
            case 'center':
                this.askSize(point, false);
                return {};
            case 'size':
                return {};
            case 'twoPoints': {
                if (state.points.length === 0) {
                    this.askTwoPoints([point]);
                    return {};
                }
                const circle = circleOnDiameter(state.points[0], point);
                return circle ? finish(circle) : {};
            }
            case 'threePoints': {
                const [first, second] = state.points;
                if (!first) {
                    this.askThreePoints([point]);
                    return {};
                }
                if (!second) {
                    if (point.x !== first.x || point.y !== first.y) {
                        this.askThreePoints([first, point]);
                    }
                    return {};
                }
                const circle = circleThrough(first, second, point);
                return circle ? finish(circle) : {};
            }
        }
    }

    /** The radius or diameter: only a positive one, else the prompt stays. */
    distance(distance: number): ToolStep {
        const state = this.state;
        if (state.kind !== 'size') {
            return {};
        }
        if (!(distance > 0)) {
            return { message: () => t('message.positiveValue') };
        }
        return finish({ center: state.center, radius: state.diameter ? distance / 2 : distance });
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        const option = text.trim().toUpperCase();
        if (state.kind === 'center' && option === THREE_POINTS) {
            this.askThreePoints([]);
            return {};
        }
        if (state.kind === 'center' && option === TWO_POINTS) {
            this.askTwoPoints([]);
            return {};
        }
        if (state.kind === 'size' && !state.diameter && matchesKeyword(text, t('message.diameterKeyword'))) {
            this.askSize(state.center, true);
            return {};
        }
        return null;
    }

    cancel(): void {}

    private askSize(center: Point, diameter: boolean): void {
        this.state = { kind: 'size', center, diameter };
        const scale = diameter ? 0.5 : 1;
        this.preview = {
            kind: 'curve',
            curveAt: (point) => {
                const radius = Math.hypot(point.x - center.x, point.y - center.y) * scale;
                return radius > 0 ? { kind: 'circle', center, radius } : null;
            },
            rubberBand: true,
        };
        this.prompt = {
            kind: 'point',
            input: 'distance',
            from: center,
            text: () => t(diameter ? 'prompt.circleDiameter' : 'prompt.circleRadius'),
        };
    }

    private askTwoPoints(points: Point[]): void {
        this.state = { kind: 'twoPoints', points };
        const [first] = points;
        if (!first) {
            this.askPoint(null, () => t('prompt.circleDiameterFirst'));
            return;
        }
        this.preview = {
            kind: 'curve',
            curveAt: (point) => previewCircle(circleOnDiameter(first, point)),
            rubberBand: false,
        };
        this.askPoint(first, () => t('prompt.circleDiameterSecond'));
    }

    private askThreePoints(points: Point[]): void {
        this.state = { kind: 'threePoints', points };
        const [first, second] = points;
        if (!first) {
            this.askPoint(null, () => t('prompt.circleFirstPoint'));
        } else if (!second) {
            // Only the rubber band, as two points give no circle yet
            this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
            this.askPoint(first, () => t('prompt.circleSecondPoint'));
        } else {
            this.preview = {
                kind: 'curve',
                curveAt: (point) => previewCircle(circleThrough(first, second, point)),
                rubberBand: false,
            };
            this.askPoint(second, () => t('prompt.circleThirdPoint'));
        }
    }

    /** A point on its own without `from`, else a `next` point from it. */
    private askPoint(from: Point | null, text: Message): void {
        if (from === null) {
            this.preview = null;
        }
        this.prompt = { kind: 'point', input: from === null ? 'point' : 'next', from, text };
    }
}

function previewCircle(circle: CircleShape | null) {
    return circle && { kind: 'circle' as const, ...circle };
}

/** Ends KREIS with the circle as one undo step. */
function finish({ center, radius }: CircleShape): ToolStep {
    return { done: true, command: new AddCircleCommand(center, radius) };
}
