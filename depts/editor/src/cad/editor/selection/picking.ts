import {
    distanceToPolyline,
    polylineInsidePolygon,
    polylineTouchesPolygon,
    polylineTouchesRect,
} from '../../geometry/selectionGeometry';
import type { Id, Point } from '../../model/Point';
import type { Rect } from '../../renderer/Viewport';
import type { ElementShape } from './ElementShapes';

/**
 * Element whose outline passes within `tolerance` (mm) of `point`; if several do, the one
 * drawn on top. `shapes` must be in drawing order (see buildElementShapes).
 */
export function pickAt(shapes: readonly ElementShape[], point: Point, tolerance: number): Id | null {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const { id, points, bounds } = shapes[i];
        if (
            point.x < bounds.x - tolerance ||
            point.x > bounds.x + bounds.width + tolerance ||
            point.y < bounds.y - tolerance ||
            point.y > bounds.y + bounds.height + tolerance
        ) {
            continue;
        }
        if (distanceToPolyline(point, points) <= tolerance) {
            return id;
        }
    }
    return null;
}

/** Window selection: elements lying completely inside `rect`, in drawing order. */
export function pickWindow(shapes: readonly ElementShape[], rect: Rect): Id[] {
    // The bounds are those of the outline points, so they lie inside exactly when all points do
    return shapes.filter(({ bounds }) => rectContains(rect, bounds)).map(({ id }) => id);
}

/** Crossing selection: elements inside `rect` or crossing its edges, in drawing order. */
export function pickCrossing(shapes: readonly ElementShape[], rect: Rect): Id[] {
    return shapes
        .filter(({ points, bounds }) => rectsOverlap(rect, bounds) && polylineTouchesRect(points, rect))
        .map(({ id }) => id);
}

/**
 * Lasso selection with a closed (possibly concave) polygon: by window only elements lying
 * completely inside, by crossing also those it cuts. In drawing order.
 */
export function pickLasso(shapes: readonly ElementShape[], polygon: readonly Point[], mode: 'window' | 'crossing'): Id[] {
    if (polygon.length < 3) {
        return [];
    }
    const xs = polygon.map((p) => p.x);
    const ys = polygon.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const bounds = { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    return shapes
        .filter(({ points, bounds: shapeBounds }) =>
            mode === 'window'
                ? rectContains(bounds, shapeBounds) && polylineInsidePolygon(points, polygon)
                : rectsOverlap(bounds, shapeBounds) && polylineTouchesPolygon(points, polygon),
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

function rectsOverlap(a: Rect, b: Rect): boolean {
    return a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}
