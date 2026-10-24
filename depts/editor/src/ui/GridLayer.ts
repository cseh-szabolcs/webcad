import type { DisplayTheme } from 'app/cad/renderer/displayColor';
import { gridLines } from 'app/cad/renderer/grid';
import type { Size, Viewport } from 'app/cad/renderer/Viewport';
import type { EditorSettings, GridSettings } from 'app/settings/editorSettings';

type GridLayerSettings = Pick<EditorSettings, 'gridMinSpacing' | 'gridColor'>;

/**
 * The grid (like AutoCAD's GRIDMODE) on its own canvas under the drawing, in view px, so it is
 * never part of the document, its bounds or the renderer. Lines are 1 CSS px wide on whole
 * device pixels, so they stay sharp on HiDPI screens; major lines are drawn over minor ones.
 */
export class GridLayer {
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
    private readonly settings: GridLayerSettings;
    private theme: DisplayTheme;
    private grid: GridSettings;
    private viewport: Viewport | null = null;
    private size: Size | null = null;

    constructor(container: HTMLElement, settings: GridLayerSettings, theme: DisplayTheme, grid: GridSettings) {
        this.settings = settings;
        this.theme = theme;
        this.grid = grid;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'cad-grid';
        this.context = this.canvas.getContext('2d')!;
        // Under the drawing canvas, which is transparent
        container.prepend(this.canvas);
    }

    setViewport(viewport: Viewport): void {
        this.viewport = viewport;
        this.draw();
    }

    resize(size: Size): void {
        this.size = size;
        this.draw();
    }

    setTheme(theme: DisplayTheme): void {
        this.theme = theme;
        this.draw();
    }

    setGrid(grid: GridSettings): void {
        this.grid = grid;
        this.draw();
    }

    dispose(): void {
        this.canvas.remove();
    }

    private draw(): void {
        const size = this.size;
        if (!size) {
            return;
        }
        const ratio = window.devicePixelRatio || 1;
        const width = Math.round(size.width * ratio);
        const height = Math.round(size.height * ratio);
        // Checked on every draw, as the ratio changes when the window moves to another screen
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        const context = this.context;
        context.clearRect(0, 0, width, height);
        if (!this.grid.enabled || !this.viewport) {
            return;
        }
        const { vertical, horizontal } = gridLines(this.viewport, size, this.grid, this.settings.gridMinSpacing);
        const colors = this.settings.gridColor[this.theme];
        const lineWidth = Math.max(1, Math.round(ratio));
        for (const major of [false, true]) {
            context.fillStyle = major ? colors.major : colors.minor;
            for (const line of vertical) {
                if (line.major === major) {
                    context.fillRect(Math.floor(line.at * ratio), 0, lineWidth, height);
                }
            }
            for (const line of horizontal) {
                if (line.major === major) {
                    context.fillRect(0, Math.floor(line.at * ratio), width, lineWidth);
                }
            }
        }
    }
}
