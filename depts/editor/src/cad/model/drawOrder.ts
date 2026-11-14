import type { CadDocument } from './CadDocument';
import type { CadElement } from './CadElement';
import type { Layer } from './Layer';

/**
 * Elements in the renderer's drawing order: layer by layer, each in document order, so the last
 * one is drawn on top. `include` decides per layer. Elements of a layer the document does not
 * know come first and are always kept.
 */
export function elementsInDrawOrder(doc: CadDocument, include: (layer: Layer) => boolean): CadElement[] {
    const layers = new Map(doc.layers.map((layer, i) => [layer.id, { layer, order: i }]));
    const entry = (element: CadElement) => layers.get(element.layerId);
    return doc.elements
        .filter((element) => {
            const layer = entry(element)?.layer;
            return !layer || include(layer);
        })
        .map((element, i) => ({ element, i, order: entry(element)?.order ?? -1 }))
        .sort((a, b) => a.order - b.order || a.i - b.i)
        .map(({ element }) => element);
}
