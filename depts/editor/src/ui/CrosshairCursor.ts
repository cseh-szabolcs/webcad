import type { Point } from 'app/cad/model/Point';
import type { Rect, Size } from 'app/cad/renderer/Viewport';
import type { EditorSettings } from 'app/settings/editorSettings';

type CrosshairSettings = Pick<EditorSettings, 'crosshairSize' | 'pickboxSize' | 'showPickbox'>;

/**
 * Pixel rectangles of the crosshair, relative to the cursor pixel (its top left corner at
 * 0, 0): 1 px lines, and the pick box as an outlined square of 2 × pickboxSize + 1 px with
 * the lines stopping at its edge, like AutoCAD.
 */
export function crosshairParts(settings: CrosshairSettings, area: Size): { lines: Rect[]; pickbox: Rect | null } {
    const larger = Math.max(area.width, area.height);
    // At 100 % the lines must reach every edge wherever the cursor is
    const half = settings.crosshairSize >= 100 ? larger : Math.round((settings.crosshairSize / 100) * larger / 2);
    if (!settings.showPickbox) {
        return {
            lines: [
                { x: -half, y: 0, width: 2 * half + 1, height: 1 },
                { x: 0, y: -half, width: 1, height: 2 * half + 1 },
            ],
            pickbox: null,
        };
    }
    const s = settings.pickboxSize;
    const arm = half - s;
    const lines =
        arm > 0
            ? [
                  { x: -s - arm, y: 0, width: arm, height: 1 },
                  { x: s + 1, y: 0, width: arm, height: 1 },
                  { x: 0, y: -s - arm, width: 1, height: arm },
                  { x: 0, y: s + 1, width: 1, height: arm },
              ]
            : [];
    return { lines, pickbox: { x: -s, y: -s, width: 2 * s + 1, height: 2 * s + 1 } };
}

/**
 * AutoCAD-like crosshair drawn as a DOM layer over the canvas, so moving it only changes a
 * CSS transform and never redraws the drawing. Colours come from the `--crosshair` token.
 */
export class CrosshairCursor {
    private readonly root: HTMLDivElement;
    private settings: CrosshairSettings;

    constructor(container: HTMLElement, settings: CrosshairSettings) {
        this.settings = settings;
        this.root = document.createElement('div');
        this.root.className = 'crosshair';
        this.root.hidden = true;
        container.appendChild(this.root);
    }

    /** Rebuilds the lines for a new drawing area size or new settings. */
    update(area: Size, settings: CrosshairSettings = this.settings): void {
        this.settings = settings;
        const { lines, pickbox } = crosshairParts(settings, area);
        this.root.replaceChildren(
            ...lines.map((rect) => this.part('crosshair-line', rect)),
            ...(pickbox ? [this.part('crosshair-pickbox', pickbox)] : []),
        );
    }

    /** Shows the crosshair at a view point (CSS px relative to the canvas). */
    moveTo(viewPoint: Point): void {
        this.root.style.transform = `translate(${Math.floor(viewPoint.x)}px, ${Math.floor(viewPoint.y)}px)`;
        this.root.hidden = false;
    }

    hide(): void {
        this.root.hidden = true;
    }

    dispose(): void {
        this.root.remove();
    }

    private part(className: string, rect: Rect): HTMLDivElement {
        const element = document.createElement('div');
        element.className = className;
        Object.assign(element.style, {
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
        });
        return element;
    }
}
