import type { GridSettings } from '../../settings/editorSettings';
import type { Size, Viewport } from './Viewport';

/** One grid line: its position in view px (x of a vertical line, y of a horizontal one). */
export interface GridLine {
    at: number;
    major: boolean;
}

/** Largest number of lines per major line, like AutoCAD's GRIDMAJOR. */
export const MAX_MAJOR_EVERY = 100;

type GridGeometry = Pick<GridSettings, 'spacing' | 'majorEvery'>;

const SPACING = /^\+?(?:\d+\.?\d*|\.\d+)$/;

/**
 * Distance in mm between the grid lines shown at `scale` (px per mm): the grid spacing, made
 * coarser by `majorEvery` (by 2 if that is 1) as long as the lines would be closer than
 * `minSpacingPx` on screen, like AutoCAD's adaptive grid. Never finer than the spacing.
 */
export function gridStep(scale: number, grid: GridGeometry, minSpacingPx: number): number {
    const factor = grid.majorEvery > 1 ? grid.majorEvery : 2;
    let step = grid.spacing;
    while (step * scale < minSpacingPx) {
        step *= factor;
    }
    return step;
}

/**
 * The grid lines visible in a view of `size`, aligned to the model origin; every
 * `majorEvery`-th line of the shown step is a major line. Empty for an unusable spacing.
 */
export function gridLines(
    viewport: Viewport,
    size: Size,
    grid: GridGeometry,
    minSpacingPx: number,
): { vertical: GridLine[]; horizontal: GridLine[] } {
    if (!(grid.spacing > 0) || !Number.isFinite(grid.spacing) || size.width <= 0 || size.height <= 0) {
        return { vertical: [], horizontal: [] };
    }
    const step = gridStep(viewport.scale, grid, minSpacingPx);
    const topLeft = viewport.viewToModel({ x: 0, y: 0 });
    const bottomRight = viewport.viewToModel({ x: size.width, y: size.height });
    const major = (i: number) => i % grid.majorEvery === 0;
    // Positions from the line index, so no rounding errors add up along the view
    const vertical: GridLine[] = [];
    for (let i = Math.ceil(topLeft.x / step); i * step <= bottomRight.x; i++) {
        vertical.push({ at: viewport.modelToView({ x: i * step, y: 0 }).x, major: major(i) });
    }
    const horizontal: GridLine[] = [];
    for (let i = Math.ceil(bottomRight.y / step); i * step <= topLeft.y; i++) {
        horizontal.push({ at: viewport.modelToView({ x: 0, y: i * step }).y, major: major(i) });
    }
    return { vertical, horizontal };
}

/** Parses a typed grid spacing in mm (the point is the decimal separator); null unless > 0. */
export function parseGridSpacing(text: string): number | null {
    const trimmed = text.trim();
    if (!SPACING.test(trimmed)) {
        return null;
    }
    const value = Number(trimmed);
    return value > 0 && Number.isFinite(value) ? value : null;
}

/** Parses a typed number of lines per major line, a whole number from 1 to MAX_MAJOR_EVERY. */
export function parseMajorEvery(text: string): number | null {
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed)) {
        return null;
    }
    const value = Number(trimmed);
    return value >= 1 && value <= MAX_MAJOR_EVERY ? value : null;
}
