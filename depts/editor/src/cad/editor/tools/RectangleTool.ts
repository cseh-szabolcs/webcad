import { t } from '../../../i18n/i18n';
import type { Id, Point } from '../../model/Point';
import { matchesKeyword } from '../commandInput';
import { AddPolylineCommand } from '../commands/AddPolylineCommand';
import type { EditorTool, Message, ToolPreview, ToolPrompt, ToolStep } from './EditorTool';

const NOTHING: ReadonlySet<Id> = new Set();

/** Length (along X) and width (along Y) given with the option "Abmessungen". */
interface Size {
    length: number;
    width: number;
}

type State =
    | { kind: 'first' }
    /** The other corner; with `size` only its quadrant from the first corner counts. */
    | { kind: 'other'; first: Point; size: Size | null }
    | { kind: 'length'; first: Point }
    | { kind: 'width'; first: Point; length: number };

/**
 * RECHTECK (AutoCAD RECTANG): one rectangle as a closed polyline, and the command ends. The first
 * corner, then the other corner (a `next` prompt from the first, previewing the rectangle). The
 * option "Abmessungen" asks for the length and the width (`distance` prompts from the first
 * corner), then a point only chooses the quadrant the rectangle lies in. A corner that gives no
 * area is ignored, the prompt stays. Esc ends without a rectangle.
 */
export class RectangleTool implements EditorTool {
    readonly command = 'RECTANG';
    readonly highlighted = NOTHING;
    private state: State = { kind: 'first' };
    prompt: ToolPrompt = { kind: 'point', input: 'point', from: null, text: () => t('prompt.rectangleFirstCorner') };
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
            case 'first':
                this.askOther(point, null);
                return {};
            case 'other': {
                const corners = rectangleAt(state.first, state.size, point);
                return corners ? { done: true, command: new AddPolylineCommand(corners, true, 'RECTANG') } : {};
            }
            default:
                return {};
        }
    }

    /** The length or width: only a positive one, else the prompt stays. */
    distance(distance: number): ToolStep {
        const state = this.state;
        if (state.kind !== 'length' && state.kind !== 'width') {
            return {};
        }
        if (!(distance > 0)) {
            return { message: () => t('message.positiveValue') };
        }
        if (state.kind === 'length') {
            this.state = { kind: 'width', first: state.first, length: distance };
            this.askDistance(state.first, () => t('prompt.rectangleWidth'));
        } else {
            this.askOther(state.first, { length: state.length, width: distance });
        }
        return {};
    }

    text(text: string): ToolStep | null {
        const state = this.state;
        if (state.kind === 'other' && matchesKeyword(text, t('message.dimensionsKeyword'))) {
            this.state = { kind: 'length', first: state.first };
            this.askDistance(state.first, () => t('prompt.rectangleLength'));
            return {};
        }
        return null;
    }

    cancel(): void {}

    private askOther(first: Point, size: Size | null): void {
        this.state = { kind: 'other', first, size };
        this.preview = {
            kind: 'curve',
            curveAt: (point) => {
                const points = rectangleAt(first, size, point);
                return points && { kind: 'polygon', points };
            },
            rubberBand: false,
        };
        this.prompt = { kind: 'point', input: 'next', from: first, text: () => t('prompt.rectangleOtherCorner') };
    }

    /** Length or width from the first corner, with only the rubber band as preview. */
    private askDistance(first: Point, text: Message): void {
        this.preview = { kind: 'curve', curveAt: () => null, rubberBand: true };
        this.prompt = { kind: 'point', input: 'distance', from: first, text };
    }
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
 * The rectangle a point gives: `point` is the other corner, or with `size` it only chooses the
 * quadrant from `first` (on an axis the positive side).
 */
function rectangleAt(first: Point, size: Size | null, point: Point): Point[] | null {
    if (!size) {
        return rectangleCorners(first, point);
    }
    const x = first.x + (point.x < first.x ? -size.length : size.length);
    const y = first.y + (point.y < first.y ? -size.width : size.width);
    return rectangleCorners(first, { x, y });
}
