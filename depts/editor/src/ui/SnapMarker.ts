import { SNAP_MODE_LABELS, type SnapMode } from 'app/cad/editor/snapping/SnapMode';
import type { Point } from 'app/cad/model/Point';
import type { EditorSettings } from 'app/settings/editorSettings';

type MarkerSettings = Pick<EditorSettings, 'snapMarkerSize' | 'snapMarker' | 'snapTooltip'>;

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Stroke width of the markers in px. */
const MARKER_STROKE_PX = 2;
/** Gap in px between the marker and its tooltip. */
const TOOLTIP_GAP_PX = 6;
/** Half the size of the base point cross in px. */
const BASE_POINT_SIZE_PX = 4;
/** Half the size of the polar tracking marker (an x) in px. */
const POLAR_MARKER_SIZE_PX = 4;
/** Dash pattern of the polar tracking path in px. */
const POLAR_PATH_DASH = '6 4';
/** Dash pattern of the rubber band from the base point while moving, in px. */
const RUBBER_BAND_DASH = '10 6';

/**
 * SVG path of a snap marker in px around its centre (Y down), with half size `s`, in the
 * AutoCAD shapes: endpoint square, midpoint triangle, centre circle, quadrant diamond,
 * intersection cross.
 */
export function markerPath(mode: SnapMode, s: number): string {
    switch (mode) {
        case 'END':
            return `M${-s} ${-s}H${s}V${s}H${-s}Z`;
        case 'MID':
            return `M0 ${-s}L${s} ${s}H${-s}Z`;
        case 'CEN':
            return `M${-s} 0A${s} ${s} 0 1 0 ${s} 0A${s} ${s} 0 1 0 ${-s} 0Z`;
        case 'QUA':
            return `M0 ${-s}L${s} 0L0 ${s}L${-s} 0Z`;
        case 'INT':
            return `M${-s} ${-s}L${s} ${s}M${-s} ${s}L${s} ${-s}`;
    }
}

/** Tooltip text: the mode name, with the Tab position while Tab chose the point ("Schnittpunkt (Tab 2/3)"). */
export function snapTooltipText(mode: SnapMode, cycle: { index: number; count: number } | null = null): string {
    const label = SNAP_MODE_LABELS[mode];
    return cycle ? `${label} (Tab ${cycle.index + 1}/${cycle.count})` : label;
}

/** Polar tooltip like AutoCAD's: distance from the reference point and angle, e.g. "Polar: 125.40 < 45°". */
export function polarTooltipText(distance: number, angle: number): string {
    return `Polar: ${distance.toFixed(2)} < ${Number(angle.toFixed(4))}°`;
}

/** What the polar tracking display shows, in view px. */
export interface PolarDisplay {
    /** Reference point the path starts at (the base point). */
    from: Point;
    /** The cursor projected onto the path. */
    point: Point;
    distance: number;
    angle: number;
}

/**
 * AutoSnap display as a DOM layer over the canvas, like the crosshair, so a changing snap
 * point never redraws the drawing: the marker at the snap point, the tooltip with the mode
 * name below right of it, and a small cross at the base point. Polar tracking shows as a
 * dashed path from the base point through the tracking point to the canvas edge, a small x at
 * the point and a tooltip with distance and angle. The dashed rubber band from the base point
 * to the preview point lies above the polar path. Positions are view px; colours come from
 * the `--snap-marker`, `--polar-track`, `--rubber-band` and `--snap-tooltip-*` tokens.
 */
export class SnapMarker {
    private readonly root: HTMLDivElement;
    private readonly svg: SVGSVGElement;
    private readonly marker: SVGPathElement;
    private readonly basePoint: SVGPathElement;
    private readonly tooltip: HTMLDivElement;
    private readonly polarPath: SVGPathElement;
    private readonly rubberBand: SVGPathElement;
    private readonly polarMarker: SVGPathElement;
    private readonly polarTooltip: HTMLDivElement;
    private settings: MarkerSettings;

    constructor(container: HTMLElement, settings: MarkerSettings) {
        this.settings = settings;
        this.root = document.createElement('div');
        this.root.className = 'snap-layer';
        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('class', 'snap-svg');
        this.marker = this.path('snap-marker');
        this.basePoint = this.path('snap-base-point');
        const b = BASE_POINT_SIZE_PX;
        this.basePoint.setAttribute('d', `M${-b} 0H${b}M0 ${-b}V${b}`);
        this.polarPath = this.path('polar-path');
        this.polarPath.setAttribute('stroke-width', '1');
        this.polarPath.setAttribute('stroke-dasharray', POLAR_PATH_DASH);
        this.polarMarker = this.path('polar-marker');
        const m = POLAR_MARKER_SIZE_PX;
        this.polarMarker.setAttribute('d', `M${-m} ${-m}L${m} ${m}M${-m} ${m}L${m} ${-m}`);
        this.rubberBand = this.path('rubber-band');
        this.rubberBand.setAttribute('stroke-width', '1');
        this.rubberBand.setAttribute('stroke-dasharray', RUBBER_BAND_DASH);
        this.svg.append(this.polarPath, this.rubberBand, this.polarMarker, this.basePoint, this.marker);
        this.tooltip = this.tooltipElement();
        this.polarTooltip = this.tooltipElement();
        this.root.append(this.svg, this.tooltip, this.polarTooltip);
        container.appendChild(this.root);
    }

    setSettings(settings: MarkerSettings): void {
        this.settings = settings;
    }

    /**
     * Shows the snap point at `viewPoint`, or hides marker and tooltip with null; `cycle` is
     * the Tab position while Tab chose the point.
     */
    show(snap: { viewPoint: Point; mode: SnapMode; cycle?: { index: number; count: number } | null } | null): void {
        const markerShown = snap !== null && this.settings.snapMarker;
        this.marker.style.display = markerShown ? '' : 'none';
        this.tooltip.hidden = snap === null || !this.settings.snapTooltip;
        if (snap === null) {
            return;
        }
        const { x, y } = snap.viewPoint;
        const s = this.settings.snapMarkerSize;
        if (markerShown) {
            this.marker.setAttribute('d', markerPath(snap.mode, s));
            this.marker.setAttribute('transform', `translate(${x} ${y})`);
        }
        if (!this.tooltip.hidden) {
            this.tooltip.textContent = snapTooltipText(snap.mode, snap.cycle);
            this.placeTooltip(this.tooltip, snap.viewPoint, s + TOOLTIP_GAP_PX);
        }
    }

    /** Shows the polar tracking path, or hides it with null. */
    showPolar(polar: PolarDisplay | null): void {
        const shown = polar !== null;
        this.polarPath.style.display = shown ? '' : 'none';
        this.polarMarker.style.display = shown ? '' : 'none';
        this.polarTooltip.hidden = !shown || !this.settings.snapTooltip;
        if (!shown) {
            return;
        }
        const { from, point } = polar;
        const length = Math.hypot(point.x - from.x, point.y - from.y);
        if (length > 0) {
            // On past the point by more than the canvas could be wide, so it reaches the edge
            const reach = (length + this.root.clientWidth + this.root.clientHeight) / length;
            const end = { x: from.x + (point.x - from.x) * reach, y: from.y + (point.y - from.y) * reach };
            this.polarPath.setAttribute('d', `M${from.x} ${from.y}L${end.x} ${end.y}`);
        }
        this.polarMarker.setAttribute('transform', `translate(${point.x} ${point.y})`);
        if (!this.polarTooltip.hidden) {
            this.polarTooltip.textContent = polarTooltipText(polar.distance, polar.angle);
            this.placeTooltip(this.polarTooltip, point, POLAR_MARKER_SIZE_PX + TOOLTIP_GAP_PX);
        }
    }

    /** Shows the rubber band between two view points, or hides it with null. */
    showRubberBand(band: { from: Point; to: Point } | null): void {
        this.rubberBand.style.display = band ? '' : 'none';
        if (band) {
            this.rubberBand.setAttribute('d', `M${band.from.x} ${band.from.y}L${band.to.x} ${band.to.y}`);
        }
    }

    /** Shows the base point cross, or hides it with null. */
    showBasePoint(viewPoint: Point | null): void {
        this.basePoint.style.display = viewPoint ? '' : 'none';
        if (viewPoint) {
            this.basePoint.setAttribute('transform', `translate(${viewPoint.x} ${viewPoint.y})`);
        }
    }

    dispose(): void {
        this.root.remove();
    }

    /** Below right of `at`, `offset` px away; flipped to the other side where it would leave the canvas. */
    private placeTooltip(tooltip: HTMLDivElement, at: Point, offset: number): void {
        const { offsetWidth: width, offsetHeight: height } = tooltip;
        const left = at.x + offset + width > this.root.clientWidth ? at.x - offset - width : at.x + offset;
        const top = at.y + offset + height > this.root.clientHeight ? at.y - offset - height : at.y + offset;
        tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    }

    private tooltipElement(): HTMLDivElement {
        const tooltip = document.createElement('div');
        tooltip.className = 'snap-tooltip';
        tooltip.hidden = true;
        return tooltip;
    }

    private path(className: string): SVGPathElement {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', className);
        path.setAttribute('stroke-width', String(MARKER_STROKE_PX));
        path.style.display = 'none';
        return path;
    }
}
