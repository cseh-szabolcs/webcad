import type { Point } from '../model/Point';

export interface Size {
    width: number;
    height: number;
}

/** Axis-aligned rectangle in model space; (x, y) is the minimum corner. */
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const MIN_SCALE = 1e-4;
export const MAX_SCALE = 1e3;

/** Screen pixels per millimetre at a nominal 96 dpi, i.e. a printed scale of 1:1. */
const PX_PER_MM_AT_1_TO_1 = 96 / 25.4;

/**
 * Immutable mapping between model space (mm, Y up) and view space (CSS px, Y down).
 * `offset` is the view position of the model origin, `scale` is px per mm.
 */
export class Viewport {
    readonly scale: number;
    readonly offset: Point;

    constructor(scale = 1, offset: Point = { x: 0, y: 0 }) {
        this.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
        this.offset = offset;
    }

    modelToView(p: Point): Point {
        return { x: this.offset.x + p.x * this.scale, y: this.offset.y - p.y * this.scale };
    }

    viewToModel(p: Point): Point {
        return { x: (p.x - this.offset.x) / this.scale, y: (this.offset.y - p.y) / this.scale };
    }

    /** Zooms by `factor` while keeping the model point under `anchor` (view px) fixed. */
    zoomAt(anchor: Point, factor: number): Viewport {
        const m = this.viewToModel(anchor);
        const scale = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE);
        return new Viewport(scale, { x: anchor.x - m.x * scale, y: anchor.y + m.y * scale });
    }

    panBy(dx: number, dy: number): Viewport {
        return new Viewport(this.scale, { x: this.offset.x + dx, y: this.offset.y + dy });
    }

    /** Centres `bounds` in a view of `viewSize`, keeping `padding` px free on each side. */
    static fitBounds(bounds: Rect, viewSize: Size, padding = 24): Viewport {
        const availableWidth = Math.max(viewSize.width - 2 * padding, 1);
        const availableHeight = Math.max(viewSize.height - 2 * padding, 1);
        const scales = [
            bounds.width > 0 ? availableWidth / bounds.width : Infinity,
            bounds.height > 0 ? availableHeight / bounds.height : Infinity,
        ];
        const fitted = Math.min(...scales);
        const scale = clamp(Number.isFinite(fitted) ? fitted : 1, MIN_SCALE, MAX_SCALE);
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        return new Viewport(scale, {
            x: viewSize.width / 2 - cx * scale,
            y: viewSize.height / 2 + cy * scale,
        });
    }

    /** Affine matrix `[a, b, c, d, tx, ty]` from model to view space. */
    toMatrix(): [number, number, number, number, number, number] {
        return [this.scale, 0, 0, -this.scale, this.offset.x, this.offset.y];
    }

    /** Denominator N of the on-screen drawing scale 1:N, assuming 96 dpi. */
    scaleDenominator(): number {
        return PX_PER_MM_AT_1_TO_1 / this.scale;
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
