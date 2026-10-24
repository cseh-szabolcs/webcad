import type { Point } from '../model/Point';
import { boundsOf } from './selectionGeometry';

/** Area below which (relative to the squared size of the bounds) a polygon counts as flat. */
const DEGENERATE_AREA = 1e-12;

/**
 * Area centroid of a polygon (closed implicitly), by the shoelace formula, not the average of
 * its vertices. For a polygon without area (all points on one line) the centre of its bounds.
 */
export function polygonCentroid(polygon: readonly Point[]): Point {
    // Relative to the first point, so far-off coordinates keep their precision
    const o = polygon[0];
    let twiceArea = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < polygon.length; i++) {
        const next = polygon[(i + 1) % polygon.length];
        const a = { x: polygon[i].x - o.x, y: polygon[i].y - o.y };
        const b = { x: next.x - o.x, y: next.y - o.y };
        const cross = a.x * b.y - b.x * a.y;
        twiceArea += cross;
        sx += (a.x + b.x) * cross;
        sy += (a.y + b.y) * cross;
    }
    const bounds = boundsOf(polygon);
    if (Math.abs(twiceArea) <= DEGENERATE_AREA * (bounds.width ** 2 + bounds.height ** 2)) {
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    }
    return { x: o.x + sx / (3 * twiceArea), y: o.y + sy / (3 * twiceArea) };
}
