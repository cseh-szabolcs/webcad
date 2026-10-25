import { UCS_ICON_LABEL_GAP_PX, UCS_ICON_SQUARE_PX, ucsIconPosition } from 'app/cad/renderer/ucsIcon';
import type { Size, Viewport } from 'app/cad/renderer/Viewport';
import type { EditorSettings } from 'app/settings/editorSettings';

type UcsIconSettings = Pick<EditorSettings, 'ucsIcon' | 'ucsIconAtOrigin' | 'ucsIconSize' | 'ucsIconLabelSize'>;

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * SVG path of the 2D UCS icon around its origin (px, Y down): the square that marks the WCS
 * with side `squareSize`, the X axis to the right and the Y axis up, both `axisLength` long
 * from the origin and starting at the square's edge.
 */
export function ucsIconPath(axisLength: number, squareSize: number): string {
    const h = squareSize / 2;
    return `M${-h} ${-h}H${h}V${h}H${-h}ZM${h} 0H${axisLength}M0 ${-h}V${-axisLength}`;
}

/**
 * The UCS icon (like AutoCAD's UCSICON, 2D style) as an SVG layer over the drawing, in view
 * px, so it never redraws the drawing and never takes pointer input. It sits on the model
 * origin while it fits there, else in the lower left corner (see ucsIconPosition). There is
 * only the WCS so far, so it always shows the square at the origin. Colour: `--ucs-icon`.
 */
export class UcsIcon {
    private readonly svg: SVGSVGElement;
    private readonly icon: SVGGElement;
    private readonly settings: UcsIconSettings;
    private viewport: Viewport | null = null;
    private size: Size | null = null;

    constructor(container: HTMLElement, settings: UcsIconSettings) {
        this.settings = settings;
        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('class', 'ucs-icon');
        this.svg.setAttribute('aria-hidden', 'true');
        this.icon = document.createElementNS(SVG_NS, 'g');
        this.icon.style.display = 'none';
        const axis = settings.ucsIconSize;
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', ucsIconPath(axis, UCS_ICON_SQUARE_PX));
        const xLabel = this.label('X', axis + UCS_ICON_LABEL_GAP_PX, 0);
        xLabel.setAttribute('dominant-baseline', 'central');
        const yLabel = this.label('Y', 0, -(axis + UCS_ICON_LABEL_GAP_PX));
        yLabel.setAttribute('text-anchor', 'middle');
        this.icon.append(path, xLabel, yLabel);
        this.svg.append(this.icon);
        container.appendChild(this.svg);
    }

    setViewport(viewport: Viewport): void {
        this.viewport = viewport;
        this.place();
    }

    resize(size: Size): void {
        this.size = size;
        this.place();
    }

    dispose(): void {
        this.svg.remove();
    }

    private place(): void {
        const { viewport, size } = this;
        const shown = this.settings.ucsIcon && viewport !== null && size !== null;
        this.icon.style.display = shown ? '' : 'none';
        if (!shown) {
            return;
        }
        const { ucsIconSize: axisLength, ucsIconLabelSize: labelSize, ucsIconAtOrigin } = this.settings;
        const { at } = ucsIconPosition(viewport, size, { axisLength, labelSize }, ucsIconAtOrigin);
        // Whole px plus a half, so the 1 px lines stay sharp
        this.icon.setAttribute('transform', `translate(${Math.round(at.x) + 0.5} ${Math.round(at.y) + 0.5})`);
    }

    private label(text: string, x: number, y: number): SVGTextElement {
        const label = document.createElementNS(SVG_NS, 'text');
        label.textContent = text;
        label.setAttribute('x', String(x));
        label.setAttribute('y', String(y));
        label.setAttribute('font-size', String(this.settings.ucsIconLabelSize));
        return label;
    }
}
