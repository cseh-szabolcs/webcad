import type { CadDocument } from '../model/CadDocument';
import { isDefaultLayer, type Layer } from '../model/Layer';
import type { Id } from '../model/Point';

/** Longest layer name, like AutoCAD's. */
export const MAX_LAYER_NAME_LENGTH = 255;

/** Not allowed in a layer name, like AutoCAD: `< > / \ " : ; ? * | , = \``. */
const INVALID_NAME_CHARACTERS = /[<>/\\":;?*|,=`]/;

/** The layers of a floor, in drawing order. */
export function floorLayers(doc: CadDocument, floorId: Id): Layer[] {
    return doc.layers.filter((layer) => layer.floorId === floorId);
}

/**
 * The current layer of a floor, which new elements go on: `wanted` while it is a shown layer of
 * the floor, else the floor's layer 0, else its first shown layer; a hidden one only if the floor
 * shows none. Null for a floor without layers, which no valid document has.
 */
export function resolveCurrentLayer(doc: CadDocument, floorId: Id, wanted: Id | null): Id | null {
    const layers = floorLayers(doc, floorId);
    const shown = layers.filter((layer) => layer.visible);
    const layer =
        shown.find((candidate) => candidate.id === wanted) ??
        shown.find(isDefaultLayer) ??
        shown[0] ??
        layers.find(isDefaultLayer) ??
        layers[0];
    return layer?.id ?? null;
}

/** Why a layer cannot have a name. */
export type LayerNameError = 'empty' | 'tooLong' | 'invalidCharacters' | 'duplicate';

/**
 * What is wrong with `name` (as given, untrimmed) for a layer of the floor, null if nothing:
 * names are unique within a floor whatever the case. `exceptId` is the layer that gets the name.
 */
export function layerNameError(doc: CadDocument, floorId: Id, name: string, exceptId: Id | null = null): LayerNameError | null {
    const trimmed = name.trim();
    if (trimmed === '') {
        return 'empty';
    }
    if (trimmed.length > MAX_LAYER_NAME_LENGTH) {
        return 'tooLong';
    }
    if (INVALID_NAME_CHARACTERS.test(trimmed)) {
        return 'invalidCharacters';
    }
    const lower = trimmed.toLowerCase();
    const taken = floorLayers(doc, floorId).some((layer) => layer.id !== exceptId && layer.name.toLowerCase() === lower);
    return taken ? 'duplicate' : null;
}

/** The first of `prefix1`, `prefix2`, … no layer of the floor has, like AutoCAD's "Layer1". */
export function nextLayerName(doc: CadDocument, floorId: Id, prefix: string): string {
    const taken = new Set(floorLayers(doc, floorId).map((layer) => layer.name.toLowerCase()));
    let number = 1;
    while (taken.has(`${prefix}${number}`.toLowerCase())) {
        number++;
    }
    return `${prefix}${number}`;
}

/** How many elements lie on each layer; a layer without any is not in it. */
export function layerElementCounts(doc: CadDocument): Map<Id, number> {
    const counts = new Map<Id, number>();
    for (const { layerId } of doc.elements) {
        counts.set(layerId, (counts.get(layerId) ?? 0) + 1);
    }
    return counts;
}

/** Why a layer cannot be removed. */
export type RemoveLayerBlocker = 'default' | 'current' | 'notEmpty';

/**
 * What keeps layer `layerId` from being removed, like AutoCAD: layer 0, the current layer and
 * layers with objects stay. `counts` (see layerElementCounts) saves counting for many layers.
 */
export function removeLayerBlocker(
    doc: CadDocument,
    layerId: Id,
    currentLayerId: Id | null,
    counts?: ReadonlyMap<Id, number>,
): RemoveLayerBlocker | null {
    const layer = doc.layers.find((candidate) => candidate.id === layerId);
    if (!layer || isDefaultLayer(layer)) {
        return 'default';
    }
    if (layerId === currentLayerId) {
        return 'current';
    }
    const used = counts ? counts.has(layerId) : doc.elements.some((element) => element.layerId === layerId);
    return used ? 'notEmpty' : null;
}
