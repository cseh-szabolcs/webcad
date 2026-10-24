import type { CursorMode } from 'app/cad/editor/SelectionEditor';
import type { Point } from 'app/cad/model/Point';
import type { Rect, Size } from 'app/cad/renderer/Viewport';
import type { EditorSettings } from 'app/settings/editorSettings';

type CrosshairSettings = Pick<
    EditorSettings,
    'crosshairSize' | 'pickboxSize' | 'showPickbox' | 'apertureSize' | 'showApertureBox'
>;

/** Thickness of the minus sign shown while Shift removes from the selection. */
const MINUS_THICKNESS_PX = 3;
/** Free pixels between the pick box and the minus sign. */
const MINUS_GAP_PX = 3;

/**
 * Pixel rectangles of the crosshair, relative to the cursor pixel (its top left corner at
 * 0, 0), for the cursor mode like AutoCAD: with no command 1 px lines and the pick box, an
 * outlined square of 2 × pickboxSize + 1 px, with the lines stopping at its edge; while
 * objects are selected only the pick box; at point prompts only the lines, around the
 * aperture box if that is shown. `minus` is the sign shown while Shift is held: as wide as
 * the pick box, diagonally off its top right corner, so it touches no line.
 */
export function crosshairParts(
    settings: CrosshairSettings,
    area: Size,
    mode: CursorMode = 'command',
): { lines: Rect[]; box: Rect | null; minus: Rect } {
    const s = settings.pickboxSize;
    const minus = {
        x: s + 1 + MINUS_GAP_PX,
        y: -s - MINUS_GAP_PX - MINUS_THICKNESS_PX,
        width: 2 * s + 1,
        height: MINUS_THICKNESS_PX,
    };
    const square = (half: number) => ({ x: -half, y: -half, width: 2 * half + 1, height: 2 * half + 1 });
    if (mode === 'select') {
        return { lines: [], box: square(s), minus };
    }
    // Half the side of the box the lines stop at, if any
    const b =
        mode === 'point'
            ? settings.showApertureBox
                ? settings.apertureSize
                : null
            : settings.showPickbox
              ? s
              : null;
    const larger = Math.max(area.width, area.height);
    // At 100 % the lines must reach every edge wherever the cursor is
    const half = settings.crosshairSize >= 100 ? larger : Math.round((settings.crosshairSize / 100) * larger / 2);
    if (b === null) {
        return {
            lines: [
                { x: -half, y: 0, width: 2 * half + 1, height: 1 },
                { x: 0, y: -half, width: 1, height: 2 * half + 1 },
            ],
            box: null,
            minus,
        };
    }
    const arm = half - b;
    const lines =
        arm > 0
            ? [
                  { x: -b - arm, y: 0, width: arm, height: 1 },
                  { x: b + 1, y: 0, width: arm, height: 1 },
                  { x: 0, y: -b - arm, width: 1, height: arm },
                  { x: 0, y: b + 1, width: 1, height: arm },
              ]
            : [];
    return { lines, box: square(b), minus };
}

/**
 * AutoCAD-like crosshair drawn as a DOM layer over the canvas, so moving it only changes a
 * CSS transform and never redraws the drawing. Colours come from the `--crosshair` token.
 */
export class CrosshairCursor {
    private readonly root: HTMLDivElement;
    private settings: CrosshairSettings;
    private area: Size | null = null;
    private mode: CursorMode = 'command';
    private minus: HTMLDivElement | null = null;
    private removing = false;

    constructor(container: HTMLElement, settings: CrosshairSettings) {
        this.settings = settings;
        this.root = document.createElement('div');
        this.root.className = 'crosshair';
        this.root.hidden = true;
        container.appendChild(this.root);
    }

    /** Rebuilds the lines for a new drawing area size or new settings. */
    update(area: Size, settings: CrosshairSettings = this.settings): void {
        this.area = area;
        this.settings = settings;
        this.rebuild();
    }

    /** Switches between the cursors with no command, while selecting and at point prompts. */
    setMode(mode: CursorMode): void {
        if (mode !== this.mode) {
            this.mode = mode;
            this.rebuild();
        }
    }

    /** Shows the minus sign while picks remove from the selection (Shift held). */
    setRemoving(removing: boolean): void {
        this.removing = removing;
        this.updateMinus();
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

    private rebuild(): void {
        if (!this.area) {
            return;
        }
        const { lines, box, minus } = crosshairParts(this.settings, this.area, this.mode);
        this.minus = this.part('crosshair-minus', minus);
        this.updateMinus();
        this.root.replaceChildren(
            ...lines.map((rect) => this.part('crosshair-line', rect)),
            ...(box ? [this.part('crosshair-box', box)] : []),
            this.minus,
        );
    }

    /** Point prompts pick nothing, so they never show the minus sign. */
    private updateMinus(): void {
        if (this.minus) {
            this.minus.hidden = !this.removing || this.mode === 'point';
        }
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
