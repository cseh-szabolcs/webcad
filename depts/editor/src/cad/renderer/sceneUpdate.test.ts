import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../model/CadDocument';
import type { CadElement } from '../model/CadElement';
import { indexDocument } from '../model/DocumentIndex';
import { BY_LAYER } from '../model/ElementAppearance';
import { newLayer } from '../model/Layer';
import { planLayerUpdate, planSceneUpdate } from './sceneUpdate';

const LAYERS = [newLayer('0', 'floor', '0'), newLayer('walls', 'floor', 'Walls'), newLayer('furniture', 'floor', 'Furniture')];

/** A document of lines `id@layer` (`id` alone for layer 0), all on the same two vertices. */
function drawing(...lines: string[]): CadDocument {
    const elements = lines.map((line): CadElement => {
        const [id, layerId = '0'] = line.split('@');
        return { id, type: 'line', name: null, layerId, groupId: null, styleId: null, ...BY_LAYER, startVertexId: 'a', endVertexId: 'b' };
    });
    return {
        id: 'plan',
        name: 'Plan',
        schemaVersion: 1,
        unit: 'mm',
        vertices: [
            { id: 'a', x: 0, y: 0 },
            { id: 'b', x: 10, y: 0 },
        ],
        elements,
        floors: [{ id: 'floor', name: 'Floor' }],
        layers: LAYERS,
        groups: [],
        styles: [],
    };
}

const plan = (doc: CadDocument, drawn: string[], changed: string[]) =>
    planSceneUpdate(doc, indexDocument(doc), new Set(drawn), changed);

describe('planSceneUpdate', () => {
    it('replaces an element that is drawn and still exists', () => {
        expect(plan(drawing('1', '2'), ['1', '2'], ['2'])).toEqual([{ kind: 'replace', id: '2' }]);
    });

    it('adds a new last element on top of its layer', () => {
        expect(plan(drawing('1', '2', '3'), ['1', '2'], ['3'])).toEqual([{ kind: 'add', id: '3', beforeId: null }]);
    });

    it('removes an element that is gone', () => {
        expect(plan(drawing('1', '3'), ['1', '2', '3'], ['2'])).toEqual([{ kind: 'remove', id: '2' }]);
    });

    it('puts an element back below the next drawn one of its layer', () => {
        const doc = drawing('1@walls', '2@walls', 'x@furniture', '3@walls');
        expect(plan(doc, ['1', 'x', '3'], ['2'])).toEqual([{ kind: 'add', id: '2', beforeId: '3' }]);
        // The last of its layer, though not of the document
        const last = drawing('1@walls', '2@walls', 'x@furniture');
        expect(plan(last, ['1', 'x'], ['2'])).toEqual([{ kind: 'add', id: '2', beforeId: null }]);
    });

    it('adds several elements in document order, each below the next element drawn before', () => {
        expect(plan(drawing('1', '2', '3', '4'), ['1', '4'], ['3', '2'])).toEqual([
            { kind: 'add', id: '2', beforeId: '4' },
            { kind: 'add', id: '3', beforeId: '4' },
        ]);
    });

    it('draws the elements of unknown layers together', () => {
        const doc = drawing('1@gone', '2@lost', '3@gone');
        expect(plan(doc, ['1', '3'], ['2'])).toEqual([{ kind: 'add', id: '2', beforeId: '3' }]);
    });

    it('removes first, then replaces, then adds, each id once', () => {
        expect(plan(drawing('1', '3'), ['1', '2'], ['3', '1', '2', '3'])).toEqual([
            { kind: 'remove', id: '2' },
            { kind: 'replace', id: '1' },
            { kind: 'add', id: '3', beforeId: null },
        ]);
    });

    it('ignores a changed id that neither exists nor is drawn', () => {
        expect(plan(drawing('1'), ['1'], ['gone'])).toEqual([]);
    });

    it('asks for a rebuild where the changed ids do not cover the difference', () => {
        expect(plan(drawing('1', '2', '3'), ['1'], ['2'])).toBe('rebuild');
        expect(plan(drawing('1'), ['1', '2'], [])).toBe('rebuild');
    });
});

describe('planLayerUpdate', () => {
    const [zero, walls, furniture] = LAYERS;
    const empty = () => false;

    it('has nothing to do for layers that only changed what is not drawn', () => {
        expect(planLayerUpdate(LAYERS, [zero, { ...walls, name: 'Wände', locked: true, description: 'x' }, furniture], empty)).toEqual([]);
    });

    it('shows or hides a layer and draws the elements of a changed one anew', () => {
        const after = [{ ...zero, visible: false }, { ...walls, lineweight: 50 as const }, { ...furniture, visible: false, transparency: 50 }];
        expect(planLayerUpdate(LAYERS, after, () => true)).toEqual([
            { kind: 'show', id: '0', visible: false },
            { kind: 'restyle', id: 'walls' },
            { kind: 'show', id: 'furniture', visible: false },
            { kind: 'restyle', id: 'furniture' },
        ]);
    });

    it('adds a new layer on top, or below the layer that follows it', () => {
        const added = newLayer('new', 'floor', 'Layer1');
        expect(planLayerUpdate(LAYERS, [...LAYERS, added], empty)).toEqual([{ kind: 'add', id: 'new', belowId: null }]);
        expect(planLayerUpdate(LAYERS, [zero, added, walls, furniture], empty)).toEqual([{ kind: 'add', id: 'new', belowId: 'walls' }]);
    });

    it('adds several layers from the top down', () => {
        const [a, b] = [newLayer('a', 'floor', 'A'), newLayer('b', 'floor', 'B')];
        expect(planLayerUpdate([zero], [zero, a, b], empty)).toEqual([
            { kind: 'add', id: 'b', belowId: null },
            { kind: 'add', id: 'a', belowId: 'b' },
        ]);
    });

    it('removes a layer without elements', () => {
        expect(planLayerUpdate(LAYERS, [zero, furniture], empty)).toEqual([{ kind: 'remove', id: 'walls' }]);
    });

    it('rebuilds when a layer with elements goes or the order changes', () => {
        expect(planLayerUpdate(LAYERS, [zero, furniture], (id) => id === 'walls')).toBe('rebuild');
        expect(planLayerUpdate(LAYERS, [zero, furniture, walls], empty)).toBe('rebuild');
    });
});
