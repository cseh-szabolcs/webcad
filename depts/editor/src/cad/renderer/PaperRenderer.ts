import paper from 'paper';
import type { CadDocument } from '../model/CadDocument';
import { indexDocument, type DocumentIndex } from '../model/DocumentIndex';
import type { Id } from '../model/Point';
import type { DisplayTheme } from './displayColor';
import { applyStyle, createItem, DEFAULT_STYLE, styleOf } from './ElementRenderer';
import { planSceneUpdate } from './sceneUpdate';
import type { Rect, Size, Viewport } from './Viewport';

const DEFAULT_LAYER = '__default';
/** Neutral greys for dimmed elements (see setDimmed), per background. */
const DIMMED = {
    light: { stroke: '#c3c8cf', fill: 'rgba(195, 200, 207, 0.25)' },
    dark: { stroke: '#5a616d', fill: 'rgba(90, 97, 109, 0.3)' },
} satisfies Record<DisplayTheme, unknown>;

/**
 * Builds a Paper.js scene from a CadDocument. Items live in model space; the viewport is
 * applied through the view matrix, which also flips Y. Holds no editing state; editor
 * overlays draw into the overlay layer, which is a Paper.js project of its own on a second
 * canvas above the drawing with the same viewport: an overlay change (hover, preview) then
 * repaints only that canvas, not the whole drawing.
 */
export class PaperRenderer {
    private readonly scope: paper.PaperScope;
    private readonly overlayScope: paper.PaperScope;
    private readonly overlay: paper.Layer;
    private readonly items = new Map<Id, paper.Path>();
    private readonly layers = new Map<Id, paper.Layer>();
    private viewport: Viewport | null = null;
    private index: DocumentIndex | null = null;
    /** The layer list the scene was built from; commands that leave the layers alone keep it. */
    private documentLayers: CadDocument['layers'] | null = null;
    private theme: DisplayTheme = 'light';
    private dimmed: ReadonlySet<Id> = new Set();
    private changes = 0;

    constructor(canvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement) {
        this.overlayScope = new paper.PaperScope();
        this.overlayScope.setup(overlayCanvas);
        this.overlay = this.overlayScope.project.activeLayer;
        this.overlay.name = '__overlay';
        // Set up last, so it is the active scope
        this.scope = new paper.PaperScope();
        this.scope.setup(canvas);
    }

    /** Counts the changes to the items or their display style, so an overlay knows when its copies are stale. */
    get revision(): number {
        return this.changes;
    }

    /** Rebuilds the whole scene. */
    setDocument(doc: CadDocument): void {
        this.scope.activate();
        this.changes++;
        for (const layer of this.layers.values()) {
            layer.remove();
        }
        this.items.clear();
        this.layers.clear();
        const index = indexDocument(doc);
        this.index = index;
        this.documentLayers = doc.layers;

        this.layers.set(DEFAULT_LAYER, new this.scope.Layer({ name: DEFAULT_LAYER }));
        for (const layer of doc.layers) {
            this.layers.set(layer.id, new this.scope.Layer({ name: layer.name, visible: layer.visible }));
        }

        for (const element of doc.elements) {
            const item = createItem(this.scope, element, index, this.theme);
            item.data.elementId = element.id;
            this.layerFor(element.layerId).addChild(item);
            this.items.set(element.id, item);
            if (this.dimmed.has(element.id)) {
                this.restyle(element.id);
            }
        }
    }

    /**
     * Follows a document change that touched the given elements: replaces their items in place,
     * removes those of elements that are gone and adds new ones at their place in the drawing
     * order; the other items stay. Falls back to setDocument() if the layers changed, an element
     * changed its layer or the ids do not cover the change.
     */
    updateElements(doc: CadDocument, ids: Iterable<Id>): void {
        this.scope.activate();
        const index = indexDocument(doc);
        const steps = doc.layers === this.documentLayers ? planSceneUpdate(doc, index, this.items, ids) : 'rebuild';
        if (steps === 'rebuild') {
            this.setDocument(doc);
            return;
        }
        this.index = index;
        this.changes++;
        for (const step of steps) {
            const old = this.items.get(step.id);
            if (step.kind === 'remove') {
                old?.remove();
                this.items.delete(step.id);
                continue;
            }
            const element = index.elements.get(step.id)!;
            const layer = this.layerFor(element.layerId);
            if (step.kind === 'replace' && old?.parent !== layer) {
                this.setDocument(doc);
                return;
            }
            const item = createItem(this.scope, element, index, this.theme);
            item.data.elementId = step.id;
            const before = step.kind === 'add' && step.beforeId !== null ? this.items.get(step.beforeId) : undefined;
            if (step.kind === 'replace') {
                old!.replaceWith(item);
            } else if (before) {
                item.insertBelow(before);
            } else {
                layer.addChild(item);
            }
            this.items.set(step.id, item);
            if (this.dimmed.has(step.id)) {
                this.restyle(step.id);
            }
        }
    }

    /**
     * Display only: draws these elements in a neutral grey instead of their colours, e.g.
     * the originals while a move is previewed; elements left out get their style back. The
     * document is never changed.
     */
    setDimmed(ids: ReadonlySet<Id>): void {
        const previous = this.dimmed;
        if (previous.size === ids.size && [...ids].every((id) => previous.has(id))) {
            return;
        }
        this.dimmed = new Set(ids);
        this.scope.activate();
        for (const id of new Set([...previous, ...ids])) {
            this.restyle(id);
        }
    }

    /** Gives `item` the display style of element `id`, e.g. a copy of a dimmed item. */
    applyElementStyle(item: paper.Path, id: Id): void {
        const element = this.index?.elements.get(id);
        if (element && this.index) {
            applyStyle(this.scope, item, styleOf(element, this.index), this.theme);
        }
    }

    /** Gives `item` the display style `styleId` (the default style for null), e.g. a preview of a new element. */
    applyStyleById(item: paper.Path, styleId: Id | null): void {
        const style = (styleId !== null && this.index?.styles.get(styleId)) || DEFAULT_STYLE;
        applyStyle(this.scope, item, style, this.theme);
    }

    /** Re-colours all elements for the background; geometry stays as it is. */
    setTheme(theme: DisplayTheme): void {
        if (theme === this.theme) {
            return;
        }
        this.theme = theme;
        this.changes++;
        const index = this.index;
        if (!index) {
            return;
        }
        this.scope.activate();
        for (const id of this.items.keys()) {
            this.restyle(id);
        }
    }

    getItemPath(id: Id): paper.Path | null {
        return this.items.get(id) ?? null;
    }

    /**
     * The layer for editor overlays, on the canvas above the drawing. Makes its Paper.js scope
     * the active one, so items created next belong to it; call it before drawing an overlay.
     */
    activateOverlay(): paper.Layer {
        this.overlayScope.activate();
        return this.overlay;
    }

    /** Current px per mm. */
    get scale(): number {
        return this.viewport?.scale ?? 1;
    }

    setViewport(viewport: Viewport): void {
        this.viewport = viewport;
        this.scope.view.matrix = new this.scope.Matrix(viewport.toMatrix());
        this.overlayScope.view.matrix = new this.overlayScope.Matrix(viewport.toMatrix());
    }

    resize(size: Size): void {
        this.scope.view.viewSize = new this.scope.Size(size.width, size.height);
        this.overlayScope.view.viewSize = new this.overlayScope.Size(size.width, size.height);
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
        this.index = null;
        this.scope.project.remove();
        this.overlayScope.project.remove();
    }

    /** Own style, then the grey of a dimmed element on top. */
    private restyle(id: Id): void {
        const item = this.items.get(id);
        if (!item) {
            return;
        }
        this.applyElementStyle(item, id);
        if (this.dimmed.has(id)) {
            const grey = DIMMED[this.theme];
            item.strokeColor = new this.scope.Color(grey.stroke);
            if (item.fillColor) {
                item.fillColor = new this.scope.Color(grey.fill);
            }
        }
    }

    private layerFor(layerId: Id | null): paper.Layer {
        return this.layers.get(layerId ?? DEFAULT_LAYER) ?? this.layers.get(DEFAULT_LAYER)!;
    }
}
