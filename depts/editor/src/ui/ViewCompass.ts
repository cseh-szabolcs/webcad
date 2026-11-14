import { t } from 'app/i18n/i18n';
import type { EditorSettings } from 'app/settings/editorSettings';

type CompassSettings = Pick<EditorSettings, 'compassSize' | 'compassOpacity'>;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Font size of the compass labels in px. */
export const COMPASS_LABEL_PX = 11;

/** The directions around the ring, clockwise from north (up = +Y in the WCS). */
const DIRECTIONS = [
    { key: 'north', dx: 0, dy: -1 },
    { key: 'east', dx: 1, dy: 0 },
    { key: 'south', dx: 0, dy: 1 },
    { key: 'west', dx: -1, dy: 0 },
] as const;

/**
 * The compass (like the ring of AutoCAD's ViewCube in the top view) as a static SVG in the top
 * right corner of the drawing: north is +Y. There is only the WCS, so it never turns and never
 * follows the viewport; pan, zoom and switching it never redraw the drawing or the grid.
 * Colour: `--compass`.
 */
export class ViewCompass {
    private readonly svg: SVGSVGElement;
    private readonly labels: SVGTextElement[] = [];

    constructor(container: HTMLElement, settings: CompassSettings) {
        const radius = settings.compassSize / 2;
        // Room for the labels outside the ring
        const half = radius + COMPASS_LABEL_PX + 2;
        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('class', 'view-compass');
        this.svg.setAttribute('aria-hidden', 'true');
        this.svg.setAttribute('width', String(2 * half));
        this.svg.setAttribute('height', String(2 * half));
        this.svg.setAttribute('viewBox', `${-half} ${-half} ${2 * half} ${2 * half}`);
        this.svg.style.opacity = String(settings.compassOpacity);

        const ring = document.createElementNS(SVG_NS, 'circle');
        ring.setAttribute('r', String(radius));
        ring.setAttribute('class', 'view-compass-ring');
        // The top view in the middle, like the ViewCube's face
        const face = radius * 0.4;
        const square = document.createElementNS(SVG_NS, 'rect');
        square.setAttribute('x', String(-face / 2));
        square.setAttribute('y', String(-face / 2));
        square.setAttribute('width', String(face));
        square.setAttribute('height', String(face));
        square.setAttribute('class', 'view-compass-face');
        // Pointer to north inside the ring
        const arrow = document.createElementNS(SVG_NS, 'path');
        arrow.setAttribute('d', `M0 ${-radius + 2}L4 ${-radius + 10}H-4Z`);
        arrow.setAttribute('class', 'view-compass-north');
        this.svg.append(ring, square, arrow);

        for (const { key, dx, dy } of DIRECTIONS) {
            if (key === 'north') {
                // The pointer marks north
                this.labels.push(this.label(dx, dy, radius));
                continue;
            }
            const tick = document.createElementNS(SVG_NS, 'line');
            tick.setAttribute('x1', String(dx * (radius - 4)));
            tick.setAttribute('y1', String(dy * (radius - 4)));
            tick.setAttribute('x2', String(dx * radius));
            tick.setAttribute('y2', String(dy * radius));
            tick.setAttribute('class', 'view-compass-ring');
            this.svg.append(tick);
            this.labels.push(this.label(dx, dy, radius));
        }
        this.refreshTexts();
        container.appendChild(this.svg);
    }

    setVisible(visible: boolean): void {
        this.svg.style.display = visible ? '' : 'none';
    }

    /** Only the four labels change with the language. */
    refreshTexts(): void {
        DIRECTIONS.forEach(({ key }, index) => {
            this.labels[index].textContent = t(`compass.${key}`);
        });
    }

    dispose(): void {
        this.svg.remove();
    }

    /** A label just outside the ring in the direction (dx, dy). */
    private label(dx: number, dy: number, radius: number): SVGTextElement {
        const label = document.createElementNS(SVG_NS, 'text');
        const at = radius + COMPASS_LABEL_PX / 2 + 2;
        label.setAttribute('x', String(dx * at));
        label.setAttribute('y', String(dy * at));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('dominant-baseline', 'central');
        label.setAttribute('font-size', String(COMPASS_LABEL_PX));
        this.svg.append(label);
        return label;
    }
}
