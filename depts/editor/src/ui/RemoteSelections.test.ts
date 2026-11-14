import { describe, expect, it } from 'vitest';
import type { Collaborator } from 'app/collaboration/types';
import type { Rect } from 'app/cad/renderer/Viewport';
import { selectionLabels } from './RemoteSelections';

const MAX: Collaborator = { id: 'm1', name: 'Max', image: null, color: 1 };
const BOUNDS: Record<string, Rect> = {
    a: { x: 10, y: 20, width: 30, height: 40 },
    b: { x: -5, y: 0, width: 1, height: 100 },
};
const boundsOf = (id: string) => BOUNDS[id] ?? null;

describe('selectionLabels', () => {
    it('puts a name at the upper left corner of each element (Y up)', () => {
        expect(selectionLabels([{ user: MAX, ids: ['a', 'b'] }], boundsOf)).toEqual([
            { key: 'm1/a', user: MAX, anchor: { x: 10, y: 60 } },
            { key: 'm1/b', user: MAX, anchor: { x: -5, y: 100 } },
        ]);
    });

    it('leaves out elements that are not shown', () => {
        expect(selectionLabels([{ user: MAX, ids: ['hidden', 'a'] }], boundsOf).map(({ key }) => key)).toEqual(['m1/a']);
        expect(selectionLabels([{ user: MAX, ids: ['hidden'] }], boundsOf)).toEqual([]);
    });

    it('shows one name over all elements beyond the limit', () => {
        expect(selectionLabels([{ user: MAX, ids: ['a', 'b'] }], boundsOf, 1)).toEqual([
            { key: 'm1', user: MAX, anchor: { x: -5, y: 100 } },
        ]);
    });
});
