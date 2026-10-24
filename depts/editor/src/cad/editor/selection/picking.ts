import {
    polylineInsidePolygon,
    polylineTouchesPolygon,
    polylineTouchesRect,
} from '../../geometry/selectionGeometry';
import type { Id, Point } from '../../model/Point';
import type { Rect } from '../../renderer/Viewport';
import type { ShapeIndex } from './ShapeIndex';

/**
 * Element whose outline passes through the pick box, the square reaching `halfSize` (mm)
 * from `point` on each side, like AutoCAD's PICKBOX; if several do, the one drawn on top.
 */
export function pickAt(index: ShapeIndex, point: Point, halfSize: number): Id | null {
    const box = { x: point.x - halfSize, y: point.y - halfSize, width: 2 * halfSize, height: 2 * halfSize };
    const candidates = index.search(box);
    for (let i = candidates.length - 1; i >= 0; i--) {
        if (polylineTouchesRect(candidates[i].points, box)) {
            return candidates[i].id;
        }
    }
    return null;
}

/** Window selection: elements lying completely inside `rect`, in drawing order. */
export function pickWindow(index: ShapeIndex, rect: Rect): Id[] {
    // The bounds are those of the outline points, so they lie inside exactly when all points do
    return index
        .search(rect)
        .filter(({ bounds }) => rectContains(rect, bounds))
        .map(({ id }) => id);
}

/** Crossing selection: elements inside `rect` or crossing its edges, in drawing order. */
export function pickCrossing(index: ShapeIndex, rect: Rect): Id[] {
    return index
        .search(rect)
        .filter(({ points }) => polylineTouchesRect(points, rect))
        .map(({ id }) => id);
}

/**
 * Lasso selection with a closed (possibly concave) polygon: by window only elements lying
 * completely inside, by crossing also those it cuts. In drawing order.
 */
export function pickLasso(index: ShapeIndex, polygon: readonly Point[], mode: 'window' | 'crossing'): Id[] {
    if (polygon.length < 3) {
        return [];
    }
    const xs = polygon.map((p) => p.x);
    const ys = polygon.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const bounds = { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    return index
        .search(bounds)
        .filter(({ points, bounds: shapeBounds }) =>
            mode === 'window'
                ? rectContains(bounds, shapeBounds) && polylineInsidePolygon(points, polygon)
                : polylineTouchesPolygon(points, polygon),
        )
        .map(({ id }) => id);
}

function rectContains(outer: Rect, inner: Rect): boolean {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
    );
}
