import paper from 'paper';
import type { CadDocument } from '../model/CadDocument';
import { indexDocument } from '../model/DocumentIndex';
import type { Id } from '../model/Point';
import { createItem } from './ElementRenderer';
import type { Rect, Size, Viewport } from './Viewport';

const DEFAULT_LAYER = '__default';

/**
 * Builds a Paper.js scene from a CadDocument. Items live in model space; the viewport is
 * applied through the view matrix, which also flips Y. Holds no editing state.
 */
export class PaperRenderer {
    private readonly scope: paper.PaperScope;
    private readonly layers = new Map<Id, paper.Layer>();
    private viewport: Viewport | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.scope = new paper.PaperScope();
        this.scope.setup(canvas);
    }

    /** Rebuilds the whole scene. */
    setDocument(doc: CadDocument): void {
        this.scope.activate();
        for (const layer of this.layers.values()) {
            layer.remove();
        }
        this.layers.clear();
        const index = indexDocument(doc);

        this.layers.set(DEFAULT_LAYER, new this.scope.Layer({ name: DEFAULT_LAYER }));
        for (const layer of doc.layers) {
            this.layers.set(layer.id, new this.scope.Layer({ name: layer.name, visible: layer.visible }));
        }

        for (const element of doc.elements) {
            const item = createItem(this.scope, element, index);
            item.data.elementId = element.id;
            this.layerFor(element.layerId).addChild(item);
        }
    }

    /** Current px per mm. */
    get scale(): number {
        return this.viewport?.scale ?? 1;
    }

    setViewport(viewport: Viewport): void {
        this.viewport = viewport;
        this.scope.view.matrix = new this.scope.Matrix(viewport.toMatrix());
    }

    resize(size: Size): void {
        this.scope.view.viewSize = new this.scope.Size(size.width, size.height);
        // Paper.js recentres the view on resize; keep the viewport's origin instead.
        if (this.viewport) {
            this.setViewport(this.viewport);
        }
    }

    /** Model-space bounds of all visible content, or null if there is none. */
    getContentBounds(): Rect | null {
        let bounds: paper.Rectangle | null = null;
        for (const layer of this.layers.values()) {
            if (!layer.visible || layer.isEmpty()) {
                continue;
            }
            bounds = bounds ? bounds.unite(layer.bounds) : layer.bounds;
        }
        return bounds && { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    }

    dispose(): void {
        this.layers.clear();
        this.scope.project.remove();
    }

    private layerFor(layerId: Id | null): paper.Layer {
        return this.layers.get(layerId ?? DEFAULT_LAYER) ?? this.layers.get(DEFAULT_LAYER)!;
    }
}
