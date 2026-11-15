import { describe, expect, it } from 'vitest';
import { indexDocument } from '../model/DocumentIndex';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { DEFAULT_STYLE, elementDisplay, layerDisplay, lineweightStroke, LINETYPE_DASHES } from './elementDisplay';

const { element: E, layer: L, style: S } = sampleIds;
const doc = parseDocument(samplePlan);
const index = indexDocument(doc);
const element = (id: string) => index.elements.get(id)!;

describe('elementDisplay', () => {
    it('draws an element without a style by its layer', () => {
        expect(elementDisplay(element(E.window), index)).toEqual({
            style: { id: L.openings, name: 'Doors & windows', strokeColor: '#374151', strokeWidth: 1, dashPattern: [], fillColor: null },
            opacity: 1,
        });
    });

    it('takes linetype and transparency from the layer', () => {
        const changed = indexDocument({
            ...doc,
            layers: doc.layers.map((layer) => (layer.id === L.openings ? { ...layer, linetype: 'center', transparency: 40 } : layer)),
        });
        const display = elementDisplay(element(E.window), changed);
        expect(display.style.dashPattern).toEqual(LINETYPE_DASHES.center);
        expect(display.opacity).toBeCloseTo(0.6);
    });

    it('draws the lineweight of the layer in pixels, whatever the zoom', () => {
        const changed = indexDocument({
            ...doc,
            layers: doc.layers.map((layer) => (layer.id === L.openings ? { ...layer, lineweight: 100 } : layer)),
        });
        expect(elementDisplay(element(E.window), changed).style.strokeWidth).toBe(4);
        // The default is one pixel, and nothing is thinner
        expect([0, 13, 25, 50, 211].map(lineweightStroke)).toEqual([1, 1, 1, 2, 8.44]);
    });

    it('lets the style of an element override its layer as a whole', () => {
        const changed = indexDocument({
            ...doc,
            layers: doc.layers.map((layer) => (layer.id === L.furniture ? { ...layer, color: '#ff0000', transparency: 90 } : layer)),
        });
        expect(elementDisplay(element(E.sofa), changed)).toEqual({ style: index.styles.get(S.furniture), opacity: 1 });
    });

    it('falls back to the default style for an unknown layer', () => {
        expect(elementDisplay({ ...element(E.window), layerId: 'gone' }, index)).toEqual({ style: DEFAULT_STYLE, opacity: 1 });
        expect(layerDisplay(undefined).style).toBe(DEFAULT_STYLE);
    });
});
