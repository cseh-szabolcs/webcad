import type { ApiSchema } from 'app/api/types';
import type { Id } from './Point';

export type Layer = ApiSchema['Layer'];

export type Linetype = ApiSchema['Linetype'];

/** In the order a choice shows them. */
export const LINETYPES = ['continuous', 'dashed', 'hidden', 'center', 'dot', 'dashDot'] as const satisfies readonly Linetype[];

/** The layer every floor has, like AutoCAD's layer 0: it can be neither renamed nor removed. */
export const DEFAULT_LAYER_NAME = '0';

/** A layer's transparency goes from 0 (opaque) up to this, in percent, like AutoCAD's. */
export const MAX_LAYER_TRANSPARENCY = 90;

/** A lineweight in 1/100 mm like DXF: one of AutoCAD's. */
export type Lineweight = Layer['lineweight'];

/** AutoCAD's lineweights, thinnest first. */
export const LINEWEIGHTS = [
    0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211,
] as const satisfies readonly Lineweight[];

/** The lineweight of a new layer: 0.25 mm, AutoCAD's default (LWDEFAULT). */
export const DEFAULT_LINEWEIGHT: Lineweight = 25;

/** Whether `value` (1/100 mm) is one of AutoCAD's lineweights. */
export function isLineweight(value: number): value is Lineweight {
    return (LINEWEIGHTS as readonly number[]).includes(value);
}

/** Longest description of a layer. */
export const MAX_LAYER_DESCRIPTION_LENGTH = 255;

/** A layer's colour, as `#rrggbb`. */
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Black, which the display turns light on a dark background (see displayColor.ts), like
 * AutoCAD's colour 7.
 */
export const DEFAULT_LAYER_COLOR = '#000000';

/** A layer as AutoCAD makes a new one: shown, unlocked, continuous lines of the default weight, opaque. */
export function newLayer(id: Id, floorId: Id, name: string): Layer {
    return {
        id,
        floorId,
        name,
        visible: true,
        locked: false,
        color: DEFAULT_LAYER_COLOR,
        linetype: 'continuous',
        transparency: 0,
        lineweight: DEFAULT_LINEWEIGHT,
        description: '',
    };
}

/** Whether `layer` is the layer 0 of its floor. */
export function isDefaultLayer(layer: Pick<Layer, 'name'>): boolean {
    return layer.name === DEFAULT_LAYER_NAME;
}
