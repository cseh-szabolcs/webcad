import { describe, expect, it } from 'vitest';
import { newStyle } from '../model/ElementStyle';
import { parseDocument } from '../persistence/CadSerializer';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { nextStyleName, styleElementCounts, styleNameError } from './styles';

const doc = parseDocument(samplePlan);
const { style: S } = sampleIds;

describe('styleNameError', () => {
    it('takes a name no style has, and lets a style keep its own', () => {
        expect(styleNameError(doc, 'Glass')).toBeNull();
        expect(styleNameError(doc, 'wall', S.wall)).toBeNull();
    });

    it('refuses an empty one, one that is too long and the name of another style, whatever the case', () => {
        expect(styleNameError(doc, '  ')).toBe('empty');
        expect(styleNameError(doc, 'x'.repeat(256))).toBe('tooLong');
        expect(styleNameError(doc, ' WALL ')).toBe('duplicate');
        expect(styleNameError(doc, 'wall', S.thin)).toBe('duplicate');
    });
});

describe('nextStyleName', () => {
    it('counts up to the first free name', () => {
        expect(nextStyleName(doc, 'Stil')).toBe('Stil1');
        expect(nextStyleName({ ...doc, styles: [...doc.styles, newStyle('a', 'stil1')] }, 'Stil')).toBe('Stil2');
    });
});

describe('styleElementCounts', () => {
    it('counts the elements per style, leaving out those without one', () => {
        const counts = styleElementCounts(doc);
        expect(counts.get(S.wall)).toBe(5);
        expect(counts.has(S.thin)).toBe(false);
        expect([...counts.values()].reduce((sum, count) => sum + count, 0)).toBe(doc.elements.filter((element) => element.styleId !== null).length);
    });
});
