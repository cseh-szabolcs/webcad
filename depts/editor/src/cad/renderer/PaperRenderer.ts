import paper from 'paper';
import type { CadDocument } from '../model/CadDocument';
import { indexDocument, type DocumentIndex } from '../model/DocumentIndex';
import type { Id } from '../model/Point';
import type { DisplayTheme } from './displayColor';
import { applyStyle, createItem, styleOf } from './ElementRenderer';
import type { Rect, Size, Viewport } from './Viewport';

const DEFAULT_LAYER = '__default';

/**
 * Builds a Paper.js scene from a CadDocument. Items live in model space; the viewport is
 * applied through the view matrix, which also flips Y. Holds no editing state; editor
 * overlays draw into the separate overlay layer.
 */
export class PaperRenderer {
    private readonly scope: paper.PaperScope;
    private readonly items = new Map<Id, paper.Path>();
    private readonly layers = new Map<Id, paper.Layer>();
    private overlay: paper.Layer | null = null;
    private viewport: Viewport | null = null;
    private index: DocumentIndex | null = null;
    private theme: DisplayTheme = 'light';

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
        const index = indexDocument(doc);
        this.index = index;

        this.layers.set(DEFAULT_LAYER, new this.scope.Layer({ name: DEFAULT_LAYER }));
        for (const layer of doc.layers) {
            this.layers.set(layer.id, new this.scope.Layer({ name: layer.name, visible: layer.visible }));
        }

        for (const element of doc.elements) {
            const item = createItem(this.scope, element, index, this.theme);
            item.data.elementId = element.id;
            this.layerFor(element.layerId).addChild(item);
            this.items.set(element.id, item);
        }
        this.overlay?.bringToFront();
    }

    /** Re-colours all elements for the background; geometry stays as it is. */
    setTheme(theme: DisplayTheme): void {
        if (theme === this.theme) {
            return;
        }
        this.theme = theme;
        const index = this.index;
        if (!index) {
            return;
        }
        this.scope.activate();
        for (const [id, item] of this.items) {
            const element = index.elements.get(id);
            if (element) {
                applyStyle(this.scope, item, styleOf(element, index), theme);
            }
        }
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
        this.index = null;
        this.scope.project.remove();
    }

    private layerFor(layerId: Id | null): paper.Layer {
        return this.layers.get(layerId ?? DEFAULT_LAYER) ?? this.layers.get(DEFAULT_LAYER)!;
    }
}
