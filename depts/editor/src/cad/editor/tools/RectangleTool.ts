import { t } from '../../../i18n/i18n';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddPolylineCommand } from '../commands/AddPolylineCommand';
import { formatDefault, type DrawingMemory } from './DrawingMemory';
import type { EditorTool, Message, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

/** Length (along the rectangle's first side) and width given with the option "Abmessungen". */
interface Size {
    length: number;
    width: number;
}

/** What shapes a rectangle beyond its corners: the angle of its sides (degrees) and its chamfer distances. */
export interface RectangleModes {
    rotation: number;
    chamfer: readonly [number, number];
}

type State =
    /** The first corner, or the option for the chamfer. */
    | { kind: 'first' }
    /**
     * A chamfer distance: a number, or two points; `from` is the first of them once given. The
     * second distance comes with the first as `first`.
     */
    | { kind: 'chamfer'; first: number | null; from: Point | null }
    /** The other corner; with `size` only its quadrant from the first corner counts. */
    | { kind: 'other'; first: Point; size: Size | null }
    | { kind: 'length'; first: Point }
    | { kind: 'width'; first: Point; length: number }
    /** The angle of the sides, from the first corner; then the other corner again. */
    | { kind: 'rotation'; first: Point; size: Size | null };

/**
 * RECHTECK (AutoCAD RECTANG): one rectangle as a closed polyline, and the command ends. The first
 * corner, then the other corner (a `next` prompt from the first, previewing the rectangle). The
 * option "Abmessungen" asks for the length and the width (`distance` prompts from the first
 * corner), then a point only chooses the quadrant the rectangle lies in; the length and the width
 * given last are their defaults, which Enter on its own takes. A corner that gives no
 * area is ignored, the prompt stays. Esc ends without a rectangle.
 *
 * Two modes stay for the following rectangles until changed (see DrawingMemory), and RECHTECK
 * names them when it starts: the option "Drehung" at the other corner asks for the angle of the
 * sides (an `angle` prompt from the first corner), the option "Fasen" at the first corner for two
 * distances (`distance` prompts without a base point: a number, or two points) that cut every
 * corner, the first along the side that arrives there going round from the first corner, the
 * second along the one that leaves. A chamfer that does not fit is left out.
 */
export class RectangleTool implements EditorTool {
    readonly command = 'RECTANG';
    readonly highlighted = NOTHING;
    private state: State = { kind: 'first' };
    prompt: ToolPrompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.rectangleFirstCorner') };
    preview: ToolPreview | null = null;
    private readonly memory: DrawingMemory;

    constructor(memory: DrawingMemory) {
        this.memory = memory;
    }

    /** Names the modes that apply, like AutoCAD's "Current rectangle modes". */
    start(): ToolStep {
        const { rectangleRotation: rotation, rectangleChamfer: chamfer } = this.memory;
        const chamfered = chamfer[0] > 0 && chamfer[1] > 0;
        if (rotation === 0 && !chamfered) {
            return {};
        }
        return {
            message: () =>
                t('message.rectangleModes', {
                    modes: [
                        chamfered && t('message.rectangleModeChamfer', { first: formatDefault(chamfer[0]), second: formatDefault(chamfer[1]) }),
                        rotation !== 0 && t('message.rectangleModeRotation', { angle: formatAngle(rotation) }),
                    ]
                        .filter(Boolean)
                        .join('  '),
                }),
        };
    }

    objectsSelected(): ToolStep {
        return {};
    }

    point(point: Point): ToolStep {
        const state = this.state;
        switch (state.kind) {
            case 'first':
                this.askOther(point, null);
                return {};
            case 'chamfer':
                // The first of two points that give the distance
                if (state.from === null) {
                    this.state = { ...state, from: point };
                    this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
                    this.prompt = { kind: 'point', input: 'distance', from: point, text: () => t('prompt.distanceSecondPoint') };
                }
                return {};
            case 'other': {
                const corners = rectangleAt(state.first, state.size, point, this.modes());
                return corners ? { done: true, command: new AddPolylineCommand(corners, true, 'RECTANG') } : {};
            }
            default:
                return {};
        }
    }

    /** The length or width (only a positive one) or a chamfer distance (none below zero), else the prompt stays. */
    distance(distance: number): ToolStep {
        const state = this.state;
        if (state.kind === 'chamfer') {
            if (!(distance >= 0)) {
                return { message: () => t('message.nonNegativeValue') };
            }
            if (state.first === null) {
                this.askChamfer(distance);
            } else {
                this.memory.rectangleChamfer = [state.first, distance];
                this.askFirst();
            }
            return {};
        }
        if (state.kind !== 'length' && state.kind !== 'width') {
            return {};
        }
        if (!(distance > 0)) {
            return { message: () => t('message.positiveValue') };
        }
        if (state.kind === 'length') {
            this.memory.rectangleLength = distance;
            this.state = { kind: 'width', first: state.first, length: distance };
            this.askDistance(state.first, 'Width', this.memory.rectangleWidth);
        } else {
            this.memory.rectangleWidth = distance;
            this.askOther(state.first, { length: state.length, width: distance });
        }
        return {};
    }

    /** The angle of the sides: typed, or the direction from the first corner to a point given. */
    angle(degrees: number): ToolStep {
        const state = this.state;
        if (state.kind === 'rotation') {
            this.memory.rectangleRotation = degrees % 360;
            this.askOther(state.first, state.size);
        }
        return {};
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        switch (state.kind) {
            case 'first':
                if (matchesKeyword(text, t('message.chamferKeyword'))) {
                    this.askChamfer(null);
                    return {};
                }
                return null;
            case 'chamfer':
                // Enter on its own takes the distance shown; not between its two points
                return text === '' && state.from === null ? this.distance(state.first ?? this.memory.rectangleChamfer[0]) : null;
            case 'other':
                if (matchesKeyword(text, t('message.dimensionsKeyword'))) {
                    this.state = { kind: 'length', first: state.first };
                    this.askDistance(state.first, 'Length', this.memory.rectangleLength);
                    return {};
                }
                if (matchesKeyword(text, t('message.rotationKeyword'))) {
                    const { first } = state;
                    this.state = { kind: 'rotation', first, size: state.size };
                    this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
                    const angle = this.memory.rectangleRotation;
                    this.prompt = {
                        kind: 'point',
                        input: 'angle',
                        from: first,
                        text: () => t('prompt.rectangleRotation', { value: formatAngle(angle) }),
                    };
                    return {};
                }
                return null;
            case 'rotation':
                return text === '' ? this.angle(this.memory.rectangleRotation) : null;
            case 'length':
            case 'width': {
                // Enter on its own takes the length or width given last
                const value = state.kind === 'length' ? this.memory.rectangleLength : this.memory.rectangleWidth;
                return text === '' && value !== null ? this.distance(value) : null;
            }
        }
    }

    cancel(): void {}

    private modes(): RectangleModes {
        return { rotation: this.memory.rectangleRotation, chamfer: this.memory.rectangleChamfer };
    }

    private askFirst(): void {
        this.state = { kind: 'first' };
        this.preview = null;
        this.prompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.rectangleFirstCorner') };
    }

    /** The first chamfer distance, or the second once the `first` is given, which is then its default. */
    private askChamfer(first: number | null): void {
        this.state = { kind: 'chamfer', first, from: null };
        this.preview = null;
        const value = formatDefault(first ?? this.memory.rectangleChamfer[0]);
        const text: Message = () => t(first === null ? 'prompt.rectangleChamferFirst' : 'prompt.rectangleChamferSecond', { value });
        this.prompt = { kind: 'point', input: 'distance', from: null, text };
    }

    private askOther(first: Point, size: Size | null): void {
        this.state = { kind: 'other', first, size };
        const modes = this.modes();
        this.preview = {
            kind: 'curve',
            curveAt: (point) => {
                const points = rectangleAt(first, size, point, modes);
                return points && { kind: 'polygon', points };
            },
            rubberBand: false,
        };
        this.prompt = { kind: 'point', input: 'next', from: first, text: () => t('prompt.rectangleOtherCorner') };
    }

    /** Length or width from the first corner, with only the rubber band as preview; `value` is its default. */
    private askDistance(first: Point, side: 'Length' | 'Width', value: number | null): void {
        this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
        this.prompt = {
            kind: 'point',
            input: 'distance',
            from: first,
            text: () =>
                value === null ? t(`prompt.rectangle${side}`) : t(`prompt.rectangle${side}Default`, { value: formatDefault(value) }),
        };
    }
}

/** An angle as its prompt shows it: without trailing zeros, like AutoCAD's `<0>`. */
function formatAngle(degrees: number): string {
    return String(Number(degrees.toFixed(4)) + 0);
}

/**
 * The corners of the rectangle from `first` to `other`: along X first, then to `other`, then
 * along Y. Null where it has no area.
 */
export function rectangleCorners(first: Point, other: Point): Point[] | null {
    if (first.x === other.x || first.y === other.y) {
        return null;
    }
    return [first, { x: other.x, y: first.y }, other, { x: first.x, y: other.y }];
}

/**
 * The outline of the rectangle from `first` with its sides at the angle of `modes`, to the
 * corner at `along` its first side and `across` it: the four corners (the first side first), or
 * with a chamfer that fits two points for each, in the same order. Null where it has no area.
 */
export function rectangleOutline(first: Point, along: number, across: number, modes: RectangleModes): Point[] | null {
    if (along === 0 || across === 0) {
        return null;
    }
    const corners: [number, number][] = [
        [0, 0],
        [along, 0],
        [along, across],
        [0, across],
    ];
    const [before, after] = modes.chamfer;
    const fits = before > 0 && after > 0 && before + after <= Math.abs(along) && before + after <= Math.abs(across);
    // Each corner gives way to a point on the side that arrives there and one on the side that leaves
    const outline = fits
        ? corners.flatMap(([x, y], i): [number, number][] => {
              const [px, py] = corners[(i + 3) % 4];
              const [nx, ny] = corners[(i + 1) % 4];
              const toward = (tx: number, ty: number, distance: number): [number, number] => {
                  const length = Math.hypot(tx - x, ty - y);
                  return [x + ((tx - x) / length) * distance, y + ((ty - y) / length) * distance];
              };
              return [toward(px, py, before), toward(nx, ny, after)];
          })
        : corners;
    const angle = (modes.rotation * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return outline.map(([x, y]) => ({ x: first.x + x * cos - y * sin + 0, y: first.y + x * sin + y * cos + 0 }));
}

/**
 * The rectangle a point gives: `point` is the other corner, or with `size` it only chooses the
 * quadrant from `first` (on an axis the positive side), both seen along the sides of `modes`.
 */
function rectangleAt(first: Point, size: Size | null, point: Point, modes: RectangleModes): Point[] | null {
    const plain = modes.rotation === 0 && !(modes.chamfer[0] > 0 && modes.chamfer[1] > 0);
    // Exactly through the points given, without rounding through the angle
    if (plain && !size) {
        return rectangleCorners(first, point);
    }
    const angle = (modes.rotation * Math.PI) / 180;
    const dx = point.x - first.x;
    const dy = point.y - first.y;
    const along = modes.rotation === 0 ? dx : dx * Math.cos(angle) + dy * Math.sin(angle);
    const across = modes.rotation === 0 ? dy : dy * Math.cos(angle) - dx * Math.sin(angle);
    if (!size) {
        return rectangleOutline(first, along, across, modes);
    }
    return rectangleOutline(first, along < 0 ? -size.length : size.length, across < 0 ? -size.width : size.width, modes);
}
