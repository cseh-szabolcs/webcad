import paper from 'paper';
import type { CadDocument } from '../model/CadDocument';
import { indexDocument, type DocumentIndex } from '../model/DocumentIndex';
import type { Id, Point } from '../model/Point';
import { createItem, updateItem } from './ElementRenderer';
import type { Rect, Size, Viewport } from './Viewport';

const DEFAULT_LAYER = '__default';

/**
 * Builds and updates a Paper.js scene from a CadDocument. Items live in model space;
 * the viewport is applied through the view matrix. Holds no editing state; edit mode
 * draws into the separate overlay layer.
 */
export class PaperRenderer {
    private readonly scope: paper.PaperScope;
    private readonly items = new Map<Id, paper.Path>();
    private readonly layers = new Map<Id, paper.Layer>();
    private overlay: paper.Layer | null = null;
    private index: DocumentIndex | null = null;
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
        this.items.clear();
        this.layers.clear();
        this.index = indexDocument(doc);

        this.layers.set(DEFAULT_LAYER, new this.scope.Layer({ name: DEFAULT_LAYER }));
        for (const layer of doc.layers) {
            const paperLayer = new this.scope.Layer({ name: layer.name, visible: layer.visible });
            paperLayer.data.locked = layer.locked;
            this.layers.set(layer.id, paperLayer);
        }

        for (const element of doc.elements) {
            const item = createItem(this.scope, element, this.index);
            item.data.elementId = element.id;
            this.layerFor(element.layerId).addChild(item);
            this.items.set(element.id, item);
        }
        this.overlay?.bringToFront();
    }

    /**
     * Re-renders the given elements from `doc`: creates new ones, updates existing ones
     * and removes those no longer in the document. Layer changes require setDocument().
     */
    updateElements(doc: CadDocument, ids: Iterable<Id>): void {
        this.scope.activate();
        this.index = indexDocument(doc);
        for (const id of ids) {
            const element = this.index.elements.get(id);
            const item = this.items.get(id);
            if (!element) {
                item?.remove();
                this.items.delete(id);
                continue;
            }
            if (item) {
                updateItem(this.scope, item, element, this.index);
                if (item.layer !== this.layerFor(element.layerId)) {
                    this.place(item, doc, id);
                }
            } else {
                const created = createItem(this.scope, element, this.index);
                created.data.elementId = id;
                this.items.set(id, created);
                this.place(created, doc, id);
            }
        }
    }

    /** Topmost element under a view point on a visible, unlocked layer. */
    hitTest(viewPoint: Point, tolerancePx: number): Id | null {
        const scale = this.scale;
        const point = this.scope.view.viewToProject(new this.scope.Point(viewPoint.x, viewPoint.y));
        const result = this.scope.project.hitTest(point, {
            stroke: true,
            fill: true,
            segments: true,
            tolerance: tolerancePx / scale,
            match: (hit: paper.HitResult) => this.isHittable(hit.item),
        });
        return result ? (result.item.data.elementId as Id) : null;
    }

    getItemPath(id: Id): paper.Path | null {
        return this.items.get(id) ?? null;
    }

    /** Layer above all document layers for editor overlays; kept across setDocument(). */
    get overlayLayer(): paper.Layer {
        if (!this.overlay) {
            this.scope.activate();
            this.overlay = new this.scope.Layer({ name: '__overlay' });
        }
        return this.overlay;
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
        this.items.clear();
        this.layers.clear();
        this.overlay = null;
        this.scope.project.remove();
    }

    private isHittable(item: paper.Item): boolean {
        const layer = item.layer;
        return typeof item.data?.elementId === 'string' && layer !== this.overlay && layer.visible && !layer.data.locked;
    }

    /** Inserts an item below the next rendered element of its layer, preserving document order. */
    private place(item: paper.Path, doc: CadDocument, id: Id): void {
        const element = doc.elements.findIndex((e) => e.id === id);
        const layerId = doc.elements[element].layerId;
        for (const next of doc.elements.slice(element + 1)) {
            const nextItem = next.layerId === layerId ? this.items.get(next.id) : undefined;
            if (nextItem && nextItem.parent) {
                item.insertBelow(nextItem);
                return;
            }
        }
        this.layerFor(layerId).addChild(item);
    }

    private layerFor(layerId: Id | null): paper.Layer {
        return this.layers.get(layerId ?? DEFAULT_LAYER) ?? this.layers.get(DEFAULT_LAYER)!;
    }
}
