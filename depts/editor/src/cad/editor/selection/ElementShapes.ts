import { flattenPathSpec, pathSpecBounds } from '../../geometry/flatten';
import type { CadDocument } from '../../model/CadDocument';
import { indexDocument } from '../../model/DocumentIndex';
import { elementsInDrawOrder } from '../../model/drawOrder';
import type { Id, Point } from '../../model/Point';
import { buildPathSpec, type PathSpec } from '../../renderer/PathSpec';
import type { Rect } from '../../renderer/Viewport';

/** Maximum deviation of a flattened outline from the real curve, in mm. */
const SHAPE_TOLERANCE_MM = 0.1;

/** Outline of a selectable element. Derived, never persisted. */
export interface ElementShape {
    readonly id: Id;
    /** The flattened outline; worked out on first use, so only shapes near a pick pay for it. */
    readonly points: Point[];
    /** Exact bounding box of the outline, for cheap rejection; contains `points`. */
    readonly bounds: Rect;
}

class LazyElementShape implements ElementShape {
    readonly id: Id;
    readonly bounds: Rect;
    private readonly spec: PathSpec;
    private flattened: Point[] | null = null;

    constructor(id: Id, spec: PathSpec) {
        this.id = id;
        this.spec = spec;
        this.bounds = pathSpecBounds(spec);
    }

    get points(): Point[] {
        return (this.flattened ??= flattenPathSpec(this.spec, SHAPE_TOLERANCE_MM));
    }
}

/**
 * Outlines of all selectable elements in drawing order (the renderer's order: elements
 * without a known layer first, then layer by layer), so the last one is drawn on top.
 * Elements on hidden or locked layers cannot be selected and are left out.
 */
export function buildElementShapes(doc: CadDocument): ElementShape[] {
    const index = indexDocument(doc);
    return elementsInDrawOrder(doc, (layer) => layer.visible && !layer.locked).map(
        (element) => new LazyElementShape(element.id, buildPathSpec(element, index)),
    );
}
