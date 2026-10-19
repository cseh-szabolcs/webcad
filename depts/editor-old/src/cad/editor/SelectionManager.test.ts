import { describe, expect, it, vi } from 'vitest';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { parseDocument } from '../persistence/CadSerializer';
import { SelectionManager } from './SelectionManager';

const { element: E } = sampleIds;

const doc = parseDocument(samplePlan);

describe('SelectionManager', () => {
    it('selects, toggles and clears', () => {
        const selection = new SelectionManager();
        selection.select([E.table]);
        selection.toggle(E.sofa);
        expect([...selection.selected]).toEqual([E.table, E.sofa]);
        selection.toggle(E.table);
        expect([...selection.selected]).toEqual([E.sofa]);
        selection.clear();
        expect(selection.selected.size).toBe(0);
    });

    it('notifies only on actual changes', () => {
        const selection = new SelectionManager();
        const listener = vi.fn();
        selection.subscribe(listener);

        selection.select([E.table]);
        selection.select([E.table]);
        selection.setHovered([E.sofa]);
        selection.setHovered([E.sofa]);
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('prunes ids that no longer exist', () => {
        const selection = new SelectionManager();
        selection.select([E.table, 'gone']);
        selection.setHovered([E.sofa, 'also-gone']);
        const listener = vi.fn();
        selection.subscribe(listener);

        selection.prune(doc);

        expect([...selection.selected]).toEqual([E.table]);
        expect([...selection.hovered]).toEqual([E.sofa]);
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
