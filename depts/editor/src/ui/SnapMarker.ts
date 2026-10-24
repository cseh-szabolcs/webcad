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

/**
 * AutoSnap display as a DOM layer over the canvas, like the crosshair, so a changing snap
 * point never redraws the drawing: the marker at the snap point, the tooltip with the mode
 * name below right of it, and a small cross at the base point. Positions are view px;
 * colours come from the `--snap-marker` and `--snap-tooltip-*` tokens.
 */
export class SnapMarker {
    private readonly root: HTMLDivElement;
    private readonly svg: SVGSVGElement;
    private readonly marker: SVGPathElement;
    private readonly basePoint: SVGPathElement;
    private readonly tooltip: HTMLDivElement;
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
        this.svg.append(this.basePoint, this.marker);
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'snap-tooltip';
        this.tooltip.hidden = true;
        this.root.append(this.svg, this.tooltip);
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
            const offset = s + TOOLTIP_GAP_PX;
            const { offsetWidth: width, offsetHeight: height } = this.tooltip;
            // Below right of the marker; flipped to the other side where it would leave the canvas
            const left = x + offset + width > this.root.clientWidth ? x - offset - width : x + offset;
            const top = y + offset + height > this.root.clientHeight ? y - offset - height : y + offset;
            this.tooltip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
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

    private path(className: string): SVGPathElement {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', className);
        path.setAttribute('stroke-width', String(MARKER_STROKE_PX));
        path.style.display = 'none';
        return path;
    }
}
