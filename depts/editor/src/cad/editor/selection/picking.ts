import { distanceToPolyline } from '../../geometry/selectionGeometry';
import type { Id, Point } from '../../model/Point';
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
