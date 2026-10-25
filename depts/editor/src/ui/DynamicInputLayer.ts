import type { DynamicField } from 'app/cad/editor/dynamicInput';
import type { Point } from 'app/cad/model/Point';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Gap in px between the crosshair and the panel, which sits above right of it. */
const DYN_OFFSET_PX = 16;
/** Distance in px of the dimension line from the measured line. */
const DIMENSION_OFFSET_PX = 24;
/** How far in px the extension lines run past the dimension line, and their gap at the points. */
const EXTENSION_OVERSHOOT_PX = 4;
const EXTENSION_GAP_PX = 3;
/** Half the length in px of the architectural ticks at the ends of the dimension line. */
const TICK_SIZE_PX = 4;
/** Largest radius in px of the angle arc; nearer the base point it runs through the point. */
const ANGLE_ARC_MAX_RADIUS_PX = 60;
/** Gap in px between the angle arc and the edge of its field. */
const ANGLE_LABEL_GAP_PX = 6;
/**
 * Below this angle (degrees) the wedge between the reference line and the line has no room for
 * the angle field, so it goes below the reference line instead.
 */
const ANGLE_LABEL_MIN_DEGREES = 20;
/** Half the size in px of the x at a point bound by typed values. */
const BOUND_MARKER_SIZE_PX = 4;

/** What the Dynamic Input display shows, in view px. */
export interface DynamicInputDisplay {
    /** Crosshair position; nothing shows without it. */
    cursor: Point | null;
    /** Prompt (or typed command) at the crosshair, or null. */
    prompt: string | null;
    /** Input fields, or null. */
    fields: readonly [DynamicField, DynamicField] | null;
    /** Fields on a dimension from the base point to the point, else at the crosshair. */
    dimension: { from: Point; to: Point } | null;
    /** The point bound by typed values, marked with an x, or null. */
    bound: Point | null;
}

/** Rounded for short SVG paths. */
const n = (value: number) => Number(value.toFixed(2)) + 0;

/**
 * Aligned dimension of the line `from`–`to` in view px: the dimension line offset to its upper
 * (or left) side with architectural ticks at both ends, the extension lines, and the centre of
 * the dimension line for the distance field. Null for a line shorter than a pixel.
 */
export function dimensionGeometry(from: Point, to: Point): { path: string; label: Point } | null {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length < 1) {
        return null;
    }
    const ux = (to.x - from.x) / length;
    const uy = (to.y - from.y) / length;
    // Normal towards the top of the screen (Y down), or to the left for a vertical line
    let nx = uy;
    let ny = -ux;
    if (ny > 0 || (ny === 0 && nx > 0)) {
        nx = -nx;
        ny = -ny;
    }
    const along = (p: Point, distance: number) => ({ x: p.x + nx * distance, y: p.y + ny * distance });
    const a = along(from, DIMENSION_OFFSET_PX);
    const b = along(to, DIMENSION_OFFSET_PX);
    const extension = (p: Point) => {
        const start = along(p, EXTENSION_GAP_PX);
        const end = along(p, DIMENSION_OFFSET_PX + EXTENSION_OVERSHOOT_PX);
        return `M${n(start.x)} ${n(start.y)}L${n(end.x)} ${n(end.y)}`;
    };
    // Slanted 45° between the line direction and the normal
    const tx = ((ux + nx) / Math.SQRT2) * TICK_SIZE_PX;
    const ty = ((uy + ny) / Math.SQRT2) * TICK_SIZE_PX;
    const tick = (p: Point) => `M${n(p.x - tx)} ${n(p.y - ty)}L${n(p.x + tx)} ${n(p.y + ty)}`;
    return {
        path: `M${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}` + extension(from) + extension(to) + tick(a) + tick(b),
        label: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
}

/** Where a field goes: centred on `label`, or with `outward` pushed off it by half its size that way. */
export interface LabelPlace {
    label: Point;
    /** Unit vector (view px) the field lies in from `label`, clear of the lines. */
    outward?: Point;
}

/**
 * Angle of `from`→`to` in view px: a horizontal reference line to the right of `from` and an arc
 * counter-clockwise (in the model, Y up) from it to the line, at the line's length but at most
 * ANGLE_ARC_MAX_RADIUS_PX, and the place for the angle field just outside the middle of the arc;
 * below ANGLE_LABEL_MIN_DEGREES it goes below the reference line, where there is room. Null for
 * a line shorter than a pixel.
 */
export function angleArcGeometry(from: Point, to: Point): ({ path: string } & Required<LabelPlace>) | null {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) {
        return null;
    }
    const r = Math.min(length, ANGLE_ARC_MAX_RADIUS_PX);
    let angle = Math.atan2(-dy, dx);
    if (angle < 0) {
        angle += 2 * Math.PI;
    }
    const at = (radius: number, a: number) => ({ x: from.x + radius * Math.cos(a), y: from.y - radius * Math.sin(a) });
    const start = at(r, 0);
    const end = at(r, angle);
    const reference = `M${n(from.x)} ${n(from.y)}H${n(from.x + r + EXTENSION_OVERSHOOT_PX)}`;
    // Counter-clockwise on screen is sweep flag 0 with Y down
    const arc = `M${n(start.x)} ${n(start.y)}A${n(r)} ${n(r)} 0 ${angle > Math.PI ? 1 : 0} 0 ${n(end.x)} ${n(end.y)}`;
    const minimum = (ANGLE_LABEL_MIN_DEGREES * Math.PI) / 180;
    // Mirrored below the reference line while the wedge is too narrow
    const middle = angle < minimum ? -minimum / 2 : angle / 2;
    const label = at(r + ANGLE_LABEL_GAP_PX, middle);
    return { path: reference + arc, label, outward: { x: Math.cos(middle), y: -Math.sin(middle) } };
}

/** SVG path of the x at a bound point. */
export function boundMarkerPath({ x, y }: Point): string {
    const s = BOUND_MARKER_SIZE_PX;
    return `M${x - s} ${y - s}L${x + s} ${y + s}M${x - s} ${y + s}L${x + s} ${y - s}`;
}

/**
 * Dynamic Input as a DOM layer over the canvas, like the snap marker, so it never redraws the
 * drawing: a panel above right of the crosshair with the prompt and (with pointer input) the two
 * fields, or the fields on a temporary dimension from the base point (an aligned dimension for
 * the distance, an arc for the angle). The focused field is highlighted and shows a caret, a
 * typed one a lock, live values are muted. Colours from the `--dyn-*` tokens.
 */
export class DynamicInputLayer {
    private readonly root: HTMLDivElement;
    private readonly dimension: SVGPathElement;
    private readonly angle: SVGPathElement;
    private readonly boundMarker: SVGPathElement;
    private readonly panel: HTMLDivElement;
    private readonly prompt: HTMLDivElement;
    private readonly panelFields: HTMLDivElement;
    private readonly dimensionFields: readonly [HTMLSpanElement, HTMLSpanElement];

    constructor(container: HTMLElement) {
        this.root = document.createElement('div');
        this.root.className = 'dyn-layer';
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'dyn-svg');
        this.dimension = this.path('dyn-dimension');
        this.angle = this.path('dyn-dimension dyn-angle');
        this.boundMarker = this.path('dyn-bound');
        svg.append(this.dimension, this.angle, this.boundMarker);
        this.panel = document.createElement('div');
        this.panel.className = 'dyn-panel';
        this.prompt = document.createElement('div');
        this.prompt.className = 'dyn-prompt';
        this.panelFields = document.createElement('div');
        this.panelFields.className = 'dyn-fields';
        this.panel.append(this.prompt, this.panelFields);
        const dimensionField = () => {
            const field = document.createElement('span');
            field.className = 'dyn-field dyn-dimension-field';
            field.hidden = true;
            return field;
        };
        this.dimensionFields = [dimensionField(), dimensionField()];
        this.root.append(svg, ...this.dimensionFields, this.panel);
        this.root.hidden = true;
        container.appendChild(this.root);
    }

    show(display: DynamicInputDisplay): void {
        const { cursor, prompt, fields, dimension, bound } = display;
        const dimensionShown = dimension !== null && fields !== null;
        const panelFields = dimensionShown ? null : fields;
        this.root.hidden = cursor === null || (prompt === null && fields === null);
        if (this.root.hidden || cursor === null) {
            return;
        }
        this.prompt.hidden = prompt === null;
        this.prompt.textContent = prompt;
        this.panelFields.hidden = panelFields === null;
        if (panelFields !== null) {
            this.panelFields.replaceChildren(
                fieldElement(panelFields[0]),
                separator(panelFields[0].kind === 'distance' ? '<' : ','),
                fieldElement(panelFields[1]),
            );
        }
        this.panel.hidden = this.prompt.hidden && this.panelFields.hidden;
        if (!this.panel.hidden) {
            this.placePanel(cursor);
        }
        const length = dimensionShown ? dimensionGeometry(dimension.from, dimension.to) : null;
        const angle = dimensionShown ? angleArcGeometry(dimension.from, dimension.to) : null;
        this.showDimension(this.dimension, this.dimensionFields[0], length, fields?.[0]);
        this.showDimension(this.angle, this.dimensionFields[1], angle, fields?.[1]);
        this.boundMarker.style.display = bound ? '' : 'none';
        if (bound) {
            this.boundMarker.setAttribute('d', boundMarkerPath(bound));
        }
    }

    dispose(): void {
        this.root.remove();
    }

    private showDimension(
        path: SVGPathElement,
        box: HTMLSpanElement,
        geometry: ({ path: string } & LabelPlace) | null,
        field: DynamicField | undefined,
    ): void {
        path.style.display = geometry ? '' : 'none';
        box.hidden = geometry === null || field === undefined;
        if (geometry === null || field === undefined) {
            return;
        }
        path.setAttribute('d', geometry.path);
        fillField(box, field);
        box.classList.add('dyn-dimension-field');
        // Centred on its place, or pushed off it by half its size so it clears the arc and the lines
        const { x, y } = geometry.label;
        const shift = geometry.outward ?? { x: 0, y: 0 };
        const left = x + (shift.x - 1) * (box.offsetWidth / 2);
        const top = y + (shift.y - 1) * (box.offsetHeight / 2);
        box.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    }

    /** Above right of the crosshair; flipped to the other side where it would leave the canvas. */
    private placePanel(cursor: Point): void {
        const { offsetWidth: width, offsetHeight: height } = this.panel;
        const right = cursor.x + DYN_OFFSET_PX;
        const left = right + width > this.root.clientWidth ? cursor.x - DYN_OFFSET_PX - width : right;
        const above = cursor.y - DYN_OFFSET_PX - height;
        const top = above < 0 ? cursor.y + DYN_OFFSET_PX : above;
        this.panel.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    }

    private path(className: string): SVGPathElement {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', className);
        path.style.display = 'none';
        return path;
    }
}

function fieldElement(field: DynamicField): HTMLSpanElement {
    const element = document.createElement('span');
    fillField(element, field);
    return element;
}

/** A field: its text (° after an angle), a caret while focused, a lock once typed and left. */
function fillField(element: HTMLSpanElement, field: DynamicField): void {
    element.className = 'dyn-field';
    element.classList.toggle('dyn-field-focused', field.focused);
    element.classList.toggle('dyn-field-live', !field.typed);
    const children: Node[] = [];
    if (field.typed && !field.focused) {
        const lock = document.createElementNS(SVG_NS, 'svg');
        lock.setAttribute('class', 'dyn-lock');
        lock.setAttribute('viewBox', '0 0 10 12');
        lock.setAttribute('aria-hidden', 'true');
        const shape = document.createElementNS(SVG_NS, 'path');
        shape.setAttribute('d', 'M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5M1 5h8v6H1Z');
        lock.append(shape);
        children.push(lock);
    }
    children.push(document.createTextNode(field.text));
    if (field.kind === 'angle' && field.text !== '') {
        children.push(document.createTextNode('°'));
    }
    if (field.focused) {
        const caret = document.createElement('span');
        caret.className = 'dyn-caret';
        children.push(caret);
    }
    element.replaceChildren(...children);
}

function separator(text: string): HTMLSpanElement {
    const element = document.createElement('span');
    element.className = 'dyn-separator';
    element.textContent = text;
    return element;
}
