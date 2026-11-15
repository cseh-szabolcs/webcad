import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../model/CadDocument';
import { indexDocument } from '../model/DocumentIndex';
import type { ElementStyle } from '../model/ElementStyle';
import type { Layer } from '../model/Layer';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { DEFAULT_STYLE, elementDisplay, layerDisplay, lineweightStroke, LINETYPE_DASHES } from './elementDisplay';

const { element: E, layer: L, style: S } = sampleIds;
const doc = parseDocument(samplePlan);
const index = indexDocument(doc);
const element = (id: string) => index.elements.get(id)!;
/** The sample plan with a layer and a style changed. */
const changed = (layerId: string, layer: Partial<Layer>, styleId?: string, style?: Partial<ElementStyle>) =>
    indexDocument({
        ...doc,
        layers: doc.layers.map((candidate) => (candidate.id === layerId ? { ...candidate, ...layer } : candidate)),
        styles: doc.styles.map((candidate) => (candidate.id === styleId ? { ...candidate, ...style } : candidate)),
    } satisfies CadDocument);

describe('elementDisplay', () => {
    it('draws an element without a style by its layer', () => {
        expect(elementDisplay(element(E.window), index)).toEqual({
            style: { strokeColor: '#374151', strokeWidth: 1, dashPattern: [], fillColor: null },
            opacity: 1,
        });
    });

    it('takes linetype and transparency from the layer', () => {
        const display = elementDisplay(element(E.window), changed(L.openings, { linetype: 'center', transparency: 40 }));
        expect(display.style.dashPattern).toEqual(LINETYPE_DASHES.center);
        expect(display.opacity).toBeCloseTo(0.6);
    });

    it('draws the lineweight in pixels, whatever the zoom', () => {
        expect(elementDisplay(element(E.window), changed(L.openings, { lineweight: 100 })).style.strokeWidth).toBe(4);
        // The default is one pixel, and nothing is thinner
        expect([0, 13, 25, 50, 211].map(lineweightStroke)).toEqual([1, 1, 1, 2, 8.44]);
    });

    it('takes what the style sets before the layer, and the fill from the style alone', () => {
        const layer = { color: '#ff0000', linetype: 'dashed', lineweight: 100, transparency: 90 } as const;
        expect(elementDisplay(element(E.sofa), changed(L.furniture, layer))).toEqual({
            style: { strokeColor: '#2563eb', strokeWidth: 1, dashPattern: [], fillColor: '#dbeafe' },
            // The style sets no transparency
            opacity: 1 - 90 / 100,
        });
    });

    it('takes from the layer what the style leaves open', () => {
        const open = changed(L.furniture, { color: '#ff0000', lineweight: 100 }, S.furniture, { color: null, lineweight: null, transparency: 50 });
        expect(elementDisplay(element(E.sofa), open)).toEqual({
            style: { strokeColor: '#ff0000', strokeWidth: 4, dashPattern: [], fillColor: '#dbeafe' },
            opacity: 0.5,
        });
    });

    it('takes what the element sets itself before its style and its layer', () => {
        const window = { ...element(E.window), color: '#ff0000', lineweight: 100 as const };
        expect(elementDisplay(window, index).style).toEqual({ strokeColor: '#ff0000', strokeWidth: 4, dashPattern: [], fillColor: null });
        const sofa = { ...element(E.sofa), color: '#ff0000', linetype: 'dashed' as const, transparency: 50 };
        expect(elementDisplay(sofa, index)).toEqual({
            style: { strokeColor: '#ff0000', strokeWidth: 1, dashPattern: LINETYPE_DASHES.dashed, fillColor: '#dbeafe' },
            opacity: 0.5,
        });
        // The curtain of the sample plan: its own colour and lineweight
        expect(elementDisplay(element(E.curtain), index).style).toMatchObject({ strokeColor: '#b45309', strokeWidth: 2 });
    });

    it('falls back to the default style for an unknown layer', () => {
        expect(elementDisplay({ ...element(E.window), layerId: 'gone' }, index)).toEqual({ style: DEFAULT_STYLE, opacity: 1 });
        expect(layerDisplay(undefined).style).toEqual(DEFAULT_STYLE);
    });
});
