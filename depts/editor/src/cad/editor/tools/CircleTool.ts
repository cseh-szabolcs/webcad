import { t } from '../../../i18n/i18n';
import { circleOnDiameter, circleThrough, type CircleShape } from '../../geometry/circle';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddCircleCommand } from '../commands/AddCircleCommand';
import { formatDefault, type DrawingMemory } from './DrawingMemory';
import type { EditorTool, Message, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();
/** The options of the centre prompt, the same in every language and only taken whole. */
const THREE_POINTS = '3P';
const TWO_POINTS = '2P';

/** The ways KREIS draws a circle, as the tool bar offers them. */
export const CIRCLE_METHODS = ['centerRadius', 'centerDiameter', 'twoPoints', 'threePoints'] as const;
export type CircleMethod = (typeof CIRCLE_METHODS)[number];

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
 * a circle. Started with another method than `centerRadius` it asks that way straight away.
 * The radius of the circle drawn last is the default of the radius (and, doubled, of the
 * diameter), which Enter on its own takes.
 */
export class CircleTool implements EditorTool {
    readonly command = 'CIRCLE';
    readonly highlighted = NOTHING;
    /** The method the prompts follow now: the one it started with, or the one an option chose. */
    method: CircleMethod;
    private state: State = { kind: 'center' };
    prompt: ToolPrompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.circleCenter') };
    preview: ToolPreview | null = null;

    private readonly memory: DrawingMemory;

    constructor(memory: DrawingMemory, method: CircleMethod = 'centerRadius') {
        this.memory = memory;
        this.method = method;
        if (method === 'twoPoints') {
            this.askTwoPoints([]);
        } else if (method === 'threePoints') {
            this.askThreePoints([]);
        }
    }

    start(): ToolStep {
        return {};
    }

    objectsSelected(): ToolStep {
        return {};
    }

    /** A point that leaves the prompt as it was gave no circle: it is reported, and the prompt stays. */
    point(point: Point): ToolStep {
        const prompt = this.prompt;
        const step = this.takePoint(point);
        return !step.done && this.prompt === prompt ? { message: () => t('message.noCircle') } : step;
    }

    private takePoint(point: Point): ToolStep {
        const state = this.state;
        switch (state.kind) {
            case 'center':
                this.askSize(point, this.method === 'centerDiameter');
                return {};
            case 'size':
                return {};
            case 'twoPoints': {
                if (state.points.length === 0) {
                    this.askTwoPoints([point]);
                    return {};
                }
                const circle = circleOnDiameter(state.points[0], point);
                return circle ? this.finish(circle) : {};
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
                return circle ? this.finish(circle) : {};
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
        return this.finish({ center: state.center, radius: state.diameter ? distance / 2 : distance });
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        const radius = this.memory.circleRadius;
        // Enter on its own takes the radius drawn last
        if (state.kind === 'size' && text === '' && radius !== null) {
            return this.finish({ center: state.center, radius });
        }
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
        this.method = diameter ? 'centerDiameter' : 'centerRadius';
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
        const radius = this.memory.circleRadius;
        this.prompt = {
            kind: 'point',
            input: 'distance',
            from: center,
            text: () =>
                radius === null
                    ? t(diameter ? 'prompt.circleDiameter' : 'prompt.circleRadius')
                    : t(diameter ? 'prompt.circleDiameterDefault' : 'prompt.circleRadiusDefault', {
                          value: formatDefault(diameter ? 2 * radius : radius),
                      }),
        };
    }

    private askTwoPoints(points: Point[]): void {
        this.method = 'twoPoints';
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
        this.method = 'threePoints';
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

    /** Ends KREIS with the circle as one undo step, and remembers its radius as the default. */
    private finish({ center, radius }: CircleShape): ToolStep {
        this.memory.circleRadius = radius;
        return { done: true, command: new AddCircleCommand(center, radius) };
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
