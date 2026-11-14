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

/**
 * Black, which the display turns light on a dark background (see displayColor.ts), like
 * AutoCAD's colour 7.
 */
export const DEFAULT_LAYER_COLOR = '#000000';

/** A layer as AutoCAD makes a new one: shown, unlocked, continuous lines, opaque. */
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
        description: '',
    };
}

/** Whether `layer` is the layer 0 of its floor. */
export function isDefaultLayer(layer: Pick<Layer, 'name'>): boolean {
    return layer.name === DEFAULT_LAYER_NAME;
}
