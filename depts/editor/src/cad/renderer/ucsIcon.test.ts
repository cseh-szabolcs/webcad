import { describe, expect, it } from 'vitest';
import {
    UCS_ICON_LABEL_GAP_PX,
    UCS_ICON_MARGIN_PX,
    UCS_ICON_SQUARE_PX,
    ucsIconExtent,
    ucsIconPosition,
} from './ucsIcon';
import { Viewport } from './Viewport';

const SIZE = { width: 800, height: 600 };
const ICON = { axisLength: 40, labelSize: 11 };
/** Lower left corner position: margin plus the square's half. */
const CORNER = {
    x: UCS_ICON_MARGIN_PX + UCS_ICON_SQUARE_PX / 2,
    y: SIZE.height - UCS_ICON_MARGIN_PX - UCS_ICON_SQUARE_PX / 2,
};

/** A viewport at scale 1 that shows the model origin at `origin` (view px). */
function originAt(origin: { x: number; y: number }): Viewport {
    return new Viewport(1, origin);
}

describe('ucsIconExtent', () => {
    it('reaches half the square to the left and down, the axis and its label to the right and up', () => {
        const reach = 40 + UCS_ICON_LABEL_GAP_PX + 11;
        const half = UCS_ICON_SQUARE_PX / 2;
        expect(ucsIconExtent(ICON)).toEqual({ left: half, right: reach, top: reach, bottom: half });
    });

    it('grows with the label size', () => {
        expect(ucsIconExtent({ ...ICON, labelSize: 20 }).right - ucsIconExtent(ICON).right).toBe(9);
    });
});

describe('ucsIconPosition', () => {
    it('sits on the model origin while the whole icon fits', () => {
        expect(ucsIconPosition(originAt({ x: 400, y: 300 }), SIZE, ICON, true)).toEqual({
            at: { x: 400, y: 300 },
            atOrigin: true,
        });
    });

    it('follows pan and zoom', () => {
        const viewport = originAt({ x: 400, y: 300 }).zoomAt({ x: 100, y: 100 }, 2).panBy(10, 20);
        expect(ucsIconPosition(viewport, SIZE, ICON, true).at).toEqual(viewport.modelToView({ x: 0, y: 0 }));
    });

    it('still sits on the origin when it just fits with the margin', () => {
        const extent = ucsIconExtent(ICON);
        const lowerLeft = { x: UCS_ICON_MARGIN_PX + extent.left, y: SIZE.height - UCS_ICON_MARGIN_PX - extent.bottom };
        expect(ucsIconPosition(originAt(lowerLeft), SIZE, ICON, true).atOrigin).toBe(true);
        const upperRight = { x: SIZE.width - UCS_ICON_MARGIN_PX - extent.right, y: UCS_ICON_MARGIN_PX + extent.top };
        expect(ucsIconPosition(originAt(upperRight), SIZE, ICON, true).atOrigin).toBe(true);
    });

    it('goes to the lower left corner when the origin is too close to an edge', () => {
        const extent = ucsIconExtent(ICON);
        for (const origin of [
            { x: UCS_ICON_MARGIN_PX + extent.left - 1, y: 300 },
            { x: SIZE.width - UCS_ICON_MARGIN_PX - extent.right + 1, y: 300 },
            { x: 400, y: UCS_ICON_MARGIN_PX + extent.top - 1 },
            { x: 400, y: SIZE.height - UCS_ICON_MARGIN_PX - extent.bottom + 1 },
        ]) {
            expect(ucsIconPosition(originAt(origin), SIZE, ICON, true)).toEqual({ at: CORNER, atOrigin: false });
        }
    });

    it('goes to the lower left corner when the origin is off screen', () => {
        expect(ucsIconPosition(originAt({ x: -500, y: 2000 }), SIZE, ICON, true)).toEqual({
            at: CORNER,
            atOrigin: false,
        });
    });

    it('always stays in the corner without the origin mode', () => {
        expect(ucsIconPosition(originAt({ x: 400, y: 300 }), SIZE, ICON, false)).toEqual({
            at: CORNER,
            atOrigin: false,
        });
    });
});
