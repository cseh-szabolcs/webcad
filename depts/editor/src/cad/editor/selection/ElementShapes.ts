import { flattenPathSpec } from '../../geometry/flatten';
import type { CadDocument } from '../../model/CadDocument';
import { indexDocument } from '../../model/DocumentIndex';
import type { Id, Point } from '../../model/Point';
import { buildPathSpec } from '../../renderer/PathSpec';
import type { Rect } from '../../renderer/Viewport';

/** Maximum deviation of a flattened outline from the real curve, in mm. */
const SHAPE_TOLERANCE_MM = 0.1;

/** Flattened outline of a selectable element. Derived, never persisted. */
export interface ElementShape {
    id: Id;
    points: Point[];
    /** Bounding box of `points`, for cheap rejection. */
    bounds: Rect;
}

/**
 * Outlines of all selectable elements in drawing order (the renderer's order: elements
 * without a known layer first, then layer by layer), so the last one is drawn on top.
 * Elements on hidden or locked layers cannot be selected and are left out.
 */
export function buildElementShapes(doc: CadDocument): ElementShape[] {
    const index = indexDocument(doc);
    const layerOrder = new Map(doc.layers.map((layer, i) => [layer.id, i]));
    const drawOrder = (layerId: Id | null) => (layerId !== null ? (layerOrder.get(layerId) ?? -1) : -1);

    return doc.elements
        .filter((element) => {
            const layer = element.layerId !== null ? index.layers.get(element.layerId) : undefined;
            return !layer || (layer.visible && !layer.locked);
        })
        .map((element, i) => ({ element, i }))
        .sort((a, b) => drawOrder(a.element.layerId) - drawOrder(b.element.layerId) || a.i - b.i)
        .map(({ element }) => {
            const points = flattenPathSpec(buildPathSpec(element, index), SHAPE_TOLERANCE_MM);
            return { id: element.id, points, bounds: boundsOf(points) };
        });
}

function boundsOf(points: readonly Point[]): Rect {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
