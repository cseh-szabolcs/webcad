import type { Point } from '../model/Point';
import type { Size, Viewport } from './Viewport';

/** Distance in px the whole UCS icon keeps from the edges of the drawing area. */
export const UCS_ICON_MARGIN_PX = 10;
/** Side of the square at the icon's origin in px, which marks the WCS. */
export const UCS_ICON_SQUARE_PX = 8;
/** Gap in px between an axis end and its label. */
export const UCS_ICON_LABEL_GAP_PX = 3;

/** Size of the icon in px: axis length and font size of the labels. */
export interface UcsIconSize {
    axisLength: number;
    labelSize: number;
}

/** How far the icon reaches from its origin in px, each side as a distance ≥ 0. */
export interface UcsIconExtent {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

/**
 * Extent of the icon around its origin: the square on the left and at the bottom, the axis
 * plus its label to the right (X) and to the top (Y). A label is taken as a font size wide
 * and high, which leaves some room for "X" and "Y".
 */
export function ucsIconExtent({ axisLength, labelSize }: UcsIconSize): UcsIconExtent {
    const half = UCS_ICON_SQUARE_PX / 2;
    const reach = axisLength + UCS_ICON_LABEL_GAP_PX + labelSize;
    return { left: half, right: reach, top: reach, bottom: half };
}

/**
 * Where the icon's origin goes in view px, like AutoCAD's UCSICON: at the model origin when
 * `atOrigin` is set and the whole icon fits into the drawing area with UCS_ICON_MARGIN_PX to
 * spare (ORigin), else in the lower left corner with that margin (Noorigin, or the origin is
 * off screen or too close to an edge).
 */
export function ucsIconPosition(
    viewport: Viewport,
    size: Size,
    iconSize: UcsIconSize,
    atOrigin: boolean,
): { at: Point; atOrigin: boolean } {
    const extent = ucsIconExtent(iconSize);
    const margin = UCS_ICON_MARGIN_PX;
    if (atOrigin) {
        const origin = viewport.modelToView({ x: 0, y: 0 });
        const fits =
            origin.x - extent.left >= margin &&
            origin.x + extent.right <= size.width - margin &&
            origin.y - extent.top >= margin &&
            origin.y + extent.bottom <= size.height - margin;
        if (fits) {
            return { at: origin, atOrigin: true };
        }
    }
    return { at: { x: margin + extent.left, y: size.height - margin - extent.bottom }, atOrigin: false };
}
