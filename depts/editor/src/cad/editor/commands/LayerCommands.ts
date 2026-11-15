import type { CadDocument } from '../../model/CadDocument';
import type { Layer } from '../../model/Layer';
import type { Id } from '../../model/Point';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/** What of a layer can change; its id and its floor stay. */
export type LayerChanges = Partial<Omit<Layer, 'id' | 'floorId'>>;

/** No element changes itself with its layer: the renderer follows the layer list. */
const NO_ELEMENTS: readonly Id[] = [];

/** Adds a layer on top of the others. */
export class AddLayerCommand implements DocumentCommand {
    readonly label = 'LAYER';
    readonly layer: Layer;

    constructor(layer: Layer) {
        this.layer = layer;
    }

    execute(doc: CadDocument): DocumentChange {
        return { document: { ...doc, layers: [...doc.layers, this.layer] }, changedElementIds: NO_ELEMENTS };
    }

    undo(doc: CadDocument): DocumentChange {
        return { document: { ...doc, layers: doc.layers.filter((layer) => layer.id !== this.layer.id) }, changedElementIds: NO_ELEMENTS };
    }
}

/**
 * Changes properties of a layer. `undo` puts back only those it changed, so what somebody else
 * changed on the same layer meanwhile stays. A layer that is gone changes nothing.
 */
export class UpdateLayerCommand implements DocumentCommand {
    readonly label = 'LAYER';
    readonly layerId: Id;
    readonly changes: LayerChanges;
    /** The values the changed properties had before the first run. */
    private before: LayerChanges | null = null;

    constructor(layerId: Id, changes: LayerChanges) {
        this.layerId = layerId;
        this.changes = changes;
    }

    execute(doc: CadDocument): DocumentChange {
        const layer = doc.layers.find((candidate) => candidate.id === this.layerId);
        if (layer && this.before === null) {
            const keys = Object.keys(this.changes) as (keyof LayerChanges)[];
            this.before = Object.fromEntries(keys.map((key) => [key, layer[key]]));
        }
        return this.apply(doc, this.changes);
    }

    undo(doc: CadDocument): DocumentChange {
        return this.apply(doc, this.before ?? {});
    }

    private apply(doc: CadDocument, changes: LayerChanges): DocumentChange {
        if (!doc.layers.some((layer) => layer.id === this.layerId)) {
            return { document: doc, changedElementIds: NO_ELEMENTS };
        }
        const layers = doc.layers.map((layer) => (layer.id === this.layerId ? { ...layer, ...changes } : layer));
        return { document: { ...doc, layers }, changedElementIds: NO_ELEMENTS };
    }
}

/**
 * Removes a layer nothing lies on; one with elements stays, as they would be left without a
 * layer. `undo` puts it back at its place in the drawing order.
 */
export class RemoveLayerCommand implements DocumentCommand {
    readonly label = 'LAYER';
    readonly layerId: Id;
    private removed: { layer: Layer; index: number } | null = null;

    constructor(layerId: Id) {
        this.layerId = layerId;
    }

    execute(doc: CadDocument): DocumentChange {
        const index = doc.layers.findIndex((layer) => layer.id === this.layerId);
        if (index < 0 || doc.elements.some((element) => element.layerId === this.layerId)) {
            this.removed = null;
            return { document: doc, changedElementIds: NO_ELEMENTS };
        }
        this.removed = { layer: doc.layers[index], index };
        return { document: { ...doc, layers: doc.layers.filter((layer) => layer.id !== this.layerId) }, changedElementIds: NO_ELEMENTS };
    }

    undo(doc: CadDocument): DocumentChange {
        const removed = this.removed;
        if (removed === null || doc.layers.some((layer) => layer.id === this.layerId)) {
            return { document: doc, changedElementIds: NO_ELEMENTS };
        }
        return { document: { ...doc, layers: doc.layers.toSpliced(removed.index, 0, removed.layer) }, changedElementIds: NO_ELEMENTS };
    }
}
