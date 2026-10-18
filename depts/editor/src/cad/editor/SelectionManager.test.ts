import { describe, expect, it, vi } from 'vitest';
import samplePlan from '../__fixtures__/sample-plan.json';
import { parseDocument } from '../persistence/CadSerializer';
import { SelectionManager } from './SelectionManager';

const doc = parseDocument(samplePlan);

describe('SelectionManager', () => {
    it('selects, toggles and clears', () => {
        const selection = new SelectionManager();
        selection.select(['table']);
        selection.toggle('sofa');
        expect([...selection.selected]).toEqual(['table', 'sofa']);
        selection.toggle('table');
        expect([...selection.selected]).toEqual(['sofa']);
        selection.clear();
        expect(selection.selected.size).toBe(0);
    });

    it('notifies only on actual changes', () => {
        const selection = new SelectionManager();
        const listener = vi.fn();
        selection.subscribe(listener);

        selection.select(['table']);
        selection.select(['table']);
        selection.setHovered('sofa');
        selection.setHovered('sofa');
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('prunes ids that no longer exist', () => {
        const selection = new SelectionManager();
        selection.select(['table', 'gone']);
        selection.setHovered('also-gone');
        const listener = vi.fn();
        selection.subscribe(listener);

        selection.prune(doc);

        expect([...selection.selected]).toEqual(['table']);
        expect(selection.hovered).toBeNull();
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
