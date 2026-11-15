import type { ApiSchema } from 'app/api/types';
import type { Id } from './Point';

/**
 * A named set of values elements are drawn with instead of their layer's: colour, linetype,
 * lineweight and transparency, each null where the style leaves it to the layer, and a fill.
 */
export type ElementStyle = ApiSchema['ElementStyle'];

/** A style that sets nothing yet. */
export function newStyle(id: Id, name: string): ElementStyle {
    return { id, name, color: null, linetype: null, lineweight: null, transparency: null, fillColor: null };
}
