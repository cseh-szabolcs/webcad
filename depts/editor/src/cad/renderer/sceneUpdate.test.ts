import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../model/CadDocument';
import type { CadElement } from '../model/CadElement';
import { indexDocument } from '../model/DocumentIndex';
import { planSceneUpdate } from './sceneUpdate';

const LAYERS = [
    { id: 'walls', name: 'Walls', visible: true, locked: false },
    { id: 'furniture', name: 'Furniture', visible: true, locked: false },
];

/** A document of lines `id@layer` (`id` alone for no layer), all on the same two vertices. */
function drawing(...lines: string[]): CadDocument {
    const elements = lines.map((line): CadElement => {
        const [id, layerId = null] = line.split('@');
        return { id, type: 'line', name: null, layerId, groupId: null, styleId: null, startVertexId: 'a', endVertexId: 'b' };
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

    it('draws an element of an unknown layer with those that have none', () => {
        const doc = drawing('1', '2@gone', '3');
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
