import { describe, expect, it } from 'vitest';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { parseDocument } from '../persistence/CadSerializer';
import { selectionUnit } from './grouping';

const { element: E } = sampleIds;

const doc = parseDocument(samplePlan);

describe('selectionUnit', () => {
    it('returns all members of the element group in document order', () => {
        expect(selectionUnit(doc, E['door-swing'])).toEqual([E['door-leaf'], E['door-swing']]);
    });

    it('returns just the element when it is not grouped', () => {
        expect(selectionUnit(doc, E.table)).toEqual([E.table]);
    });
});
