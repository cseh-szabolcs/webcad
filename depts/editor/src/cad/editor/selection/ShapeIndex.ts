import RBush from 'rbush';
import type { Rect } from '../../renderer/Viewport';
import type { ElementShape } from './ElementShapes';

interface Entry {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    /** Position in drawing order. */
    order: number;
    shape: ElementShape;
}

/**
 * R-tree over the bounding boxes of the selectable outlines, so picking only tests the
 * outlines near the cursor or the selection area. Derived, never persisted; rebuilt with
 * the shapes.
 */
export class ShapeIndex {
    private readonly tree = new RBush<Entry>();

    /** `shapes` in drawing order (see buildElementShapes). */
    constructor(shapes: readonly ElementShape[]) {
        this.tree.load(
            shapes.map((shape, order) => ({
                minX: shape.bounds.x,
                minY: shape.bounds.y,
                maxX: shape.bounds.x + shape.bounds.width,
                maxY: shape.bounds.y + shape.bounds.height,
                order,
                shape,
            })),
        );
    }

    /** Shapes whose bounding box touches `rect` (edges included), in drawing order. */
    search(rect: Rect): ElementShape[] {
        return this.tree
            .search({ minX: rect.x, minY: rect.y, maxX: rect.x + rect.width, maxY: rect.y + rect.height })
            .sort((a, b) => a.order - b.order)
            .map((entry) => entry.shape);
    }
}
