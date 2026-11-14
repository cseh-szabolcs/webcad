import type { CadElement } from '../model/CadElement';
import type { DocumentIndex } from '../model/DocumentIndex';
import type { ElementStyle } from '../model/ElementStyle';
import type { Layer, Linetype } from '../model/Layer';

/** Lengths of dashes and gaps in turn, in screen px like a style's dash pattern. */
export const LINETYPE_DASHES: Readonly<Record<Linetype, readonly number[]>> = {
    continuous: [],
    dashed: [12, 6],
    hidden: [6, 4],
    center: [20, 4, 4, 4],
    dot: [1, 4],
    dashDot: [12, 4, 1, 4],
};

/** Stroke width in screen px of what is drawn by its layer, which has no lineweight yet. */
const LAYER_STROKE_WIDTH = 1;

/** For elements of a layer the document does not know. */
export const DEFAULT_STYLE: ElementStyle = {
    id: '__default',
    name: 'Default',
    strokeColor: '#000000',
    strokeWidth: LAYER_STROKE_WIDTH,
    dashPattern: [],
    fillColor: null,
};

/** How an element is drawn: its strokes and fill, and how opaque it is as a whole (0–1). */
export interface ElementDisplay {
    style: ElementStyle;
    opacity: number;
}

/**
 * How `layer` draws what has no style of its own (AutoCAD's ByLayer): in its colour and linetype,
 * without a fill, see-through by its transparency.
 */
export function layerDisplay(layer: Layer | undefined): ElementDisplay {
    if (!layer) {
        return { style: DEFAULT_STYLE, opacity: 1 };
    }
    return {
        style: {
            id: layer.id,
            name: layer.name,
            strokeColor: layer.color,
            strokeWidth: LAYER_STROKE_WIDTH,
            dashPattern: [...LINETYPE_DASHES[layer.linetype]],
            fillColor: null,
        },
        opacity: 1 - layer.transparency / 100,
    };
}

/** An element's own style overrides its layer as a whole; without one the layer draws it. */
export function elementDisplay(element: CadElement, index: DocumentIndex): ElementDisplay {
    const style = element.styleId !== null ? index.styles.get(element.styleId) : undefined;
    return style ? { style, opacity: 1 } : layerDisplay(index.layers.get(element.layerId));
}
