import { flattenPathSpec } from '../../geometry/flatten';
import { boundsOf } from '../../geometry/selectionGeometry';
import type { CadDocument } from '../../model/CadDocument';
import { indexDocument } from '../../model/DocumentIndex';
import { elementsInDrawOrder } from '../../model/drawOrder';
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
    return elementsInDrawOrder(doc, (layer) => layer.visible && !layer.locked).map((element) => {
        const points = flattenPathSpec(buildPathSpec(element, index), SHAPE_TOLERANCE_MM);
        return { id: element.id, points, bounds: boundsOf(points) };
    });
}
