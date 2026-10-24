import type { Point } from '../../model/Point';

/**
 * The cursor forced onto the horizontal or the vertical through the reference point, whichever
 * is nearer, like AutoCAD's Ortho mode (F8). Unlike polar tracking there is no tolerance: the
 * point always lies on one of the two. On the diagonal the horizontal wins.
 */
export function orthoPoint(reference: Point, cursor: Point): Point {
    const dx = cursor.x - reference.x;
    const dy = cursor.y - reference.y;
    return Math.abs(dx) >= Math.abs(dy) ? { x: cursor.x, y: reference.y } : { x: reference.x, y: cursor.y };
}
