import RBush from 'rbush';
import type { Rect } from '../../renderer/Viewport';
import type { ElementShape } from './ElementShapes';

interface Entry<T> {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    /** Position in drawing order. */
    order: number;
    shape: T;
}

/**
 * R-tree over the bounding boxes of shapes, so picking (selectable outlines) and snapping
 * (snap primitives) only test the shapes near the cursor or the selection area. Derived,
 * never persisted; rebuilt with the shapes.
 */
export class ShapeIndex<T extends { bounds: Rect } = ElementShape> {
    private readonly tree = new RBush<Entry<T>>();

    /** `shapes` in drawing order (see buildElementShapes). */
    constructor(shapes: readonly T[]) {
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
    search(rect: Rect): T[] {
        return this.tree
            .search({ minX: rect.x, minY: rect.y, maxX: rect.x + rect.width, maxY: rect.y + rect.height })
            .sort((a, b) => a.order - b.order)
            .map((entry) => entry.shape);
    }
}
