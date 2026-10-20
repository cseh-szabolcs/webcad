import { describe, expect, it } from 'vitest';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { buildElementShapes } from './ElementShapes';
import { buildSelectionUnits, expandToUnits } from './grouping';

const { element: E, layer: L } = sampleIds;

const doc = parseDocument(samplePlan);
const units = buildSelectionUnits(
    doc,
    buildElementShapes(doc).map((shape) => shape.id),
);

describe('buildSelectionUnits', () => {
    it('selects all members of a group together', () => {
        expect(units.get(E['door-leaf'])).toEqual([E['door-leaf'], E['door-swing']]);
        expect(units.get(E['door-swing'])).toEqual([E['door-leaf'], E['door-swing']]);
    });

    it('selects an ungrouped element alone', () => {
        expect(units.get(E.table)).toEqual([E.table]);
    });

    it('leaves out group members on locked layers', () => {
        // Door swing moved to the furniture layer, which is then locked
        const split = {
            ...doc,
            elements: doc.elements.map((element) =>
                element.id === E['door-swing'] ? { ...element, layerId: L.furniture } : element,
            ),
            layers: doc.layers.map((layer) => (layer.id === L.furniture ? { ...layer, locked: true } : layer)),
        };
        const splitUnits = buildSelectionUnits(
            split,
            buildElementShapes(split).map((shape) => shape.id),
        );
        expect(splitUnits.get(E['door-leaf'])).toEqual([E['door-leaf']]);
        expect(splitUnits.has(E['door-swing'])).toBe(false);
    });
});

describe('expandToUnits', () => {
    it('adds group members once, keeping the order', () => {
        expect(expandToUnits([E.table, E['door-swing'], E['door-leaf']], units)).toEqual([
            E.table,
            E['door-leaf'],
            E['door-swing'],
        ]);
    });
});
