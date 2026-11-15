import type { CadElement } from '../model/CadElement';
import type { DocumentIndex } from '../model/DocumentIndex';
import type { Layer, Linetype } from '../model/Layer';

/** Lengths of dashes and gaps in turn, in screen px whatever the zoom. */
export const LINETYPE_DASHES: Readonly<Record<Linetype, readonly number[]>> = {
    continuous: [],
    dashed: [12, 6],
    hidden: [6, 4],
    center: [20, 4, 4, 4],
    dot: [1, 4],
    dashDot: [12, 4, 1, 4],
};

/**
 * Screen px per mm of lineweight: like AutoCAD's model space, a lineweight shows in pixels in
 * proportion to its value, whatever the zoom. The default 0.25 mm is one pixel.
 */
export const LINEWEIGHT_PX_PER_MM = 4;

/** The thinnest a line is drawn, in screen px: lineweights below 0.25 mm show like it. */
const MIN_STROKE_WIDTH = 1;

/** Stroke width in screen px of a lineweight (in 1/100 mm, see LINEWEIGHTS). */
export function lineweightStroke(lineweight: number): number {
    return Math.max(MIN_STROKE_WIDTH, (lineweight / 100) * LINEWEIGHT_PX_PER_MM);
}

/** What a path is drawn with: stroke colour, width and dashes in screen px, and a fill or none. */
export interface DisplayStyle {
    strokeColor: string;
    strokeWidth: number;
    dashPattern: number[];
    fillColor: string | null;
}

/** For elements of a layer the document does not know. */
export const DEFAULT_STYLE: DisplayStyle = { strokeColor: '#000000', strokeWidth: MIN_STROKE_WIDTH, dashPattern: [], fillColor: null };

/** How an element is drawn: its strokes and fill, and how opaque it is as a whole (0–1). */
export interface ElementDisplay {
    style: DisplayStyle;
    opacity: number;
}

/** What draws an element where it sets nothing itself: the values of a layer, or those a style sets. */
type Source = { color: string | null; linetype: Linetype | null; lineweight: number | null; transparency: number | null };

/** The first value that is set. */
function first<T>(...values: (T | null | undefined)[]): T | undefined {
    return values.find((value): value is T => value !== null && value !== undefined);
}

function display(sources: readonly (Source | undefined)[], fillColor: string | null): ElementDisplay {
    const color = first(...sources.map((source) => source?.color));
    const linetype = first(...sources.map((source) => source?.linetype));
    const lineweight = first(...sources.map((source) => source?.lineweight));
    const transparency = first(...sources.map((source) => source?.transparency)) ?? 0;
    return {
        style: {
            strokeColor: color ?? DEFAULT_STYLE.strokeColor,
            strokeWidth: lineweight === undefined ? DEFAULT_STYLE.strokeWidth : lineweightStroke(lineweight),
            dashPattern: linetype === undefined ? [] : [...LINETYPE_DASHES[linetype]],
            fillColor,
        },
        opacity: 1 - transparency / 100,
    };
}

/**
 * How `layer` draws what sets nothing itself and has no style (AutoCAD's ByLayer): in its colour,
 * linetype and lineweight, without a fill, see-through by its transparency.
 */
export function layerDisplay(layer: Layer | undefined): ElementDisplay {
    return display([layer], null);
}

/**
 * How an element is drawn. For each of colour, linetype, lineweight and transparency the first
 * that is set counts: the element's own value, else its style's, else its layer's (AutoCAD's
 * ByLayer). Only a style fills.
 */
export function elementDisplay(element: CadElement, index: DocumentIndex): ElementDisplay {
    const style = element.styleId !== null ? index.styles.get(element.styleId) : undefined;
    return display([element, style, index.layers.get(element.layerId)], style?.fillColor ?? null);
}
