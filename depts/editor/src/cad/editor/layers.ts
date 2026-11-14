import type { CadDocument } from '../model/CadDocument';
import { isDefaultLayer, type Layer } from '../model/Layer';
import type { Id } from '../model/Point';

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
