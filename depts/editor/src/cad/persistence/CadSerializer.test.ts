import { describe, expect, it } from 'vitest';
import samplePlan from '../__fixtures__/sample-plan.json';
import { CadDocumentError, parseDocument, serializeDocument } from './CadSerializer';

function sample(): Record<string, any> {
    return structuredClone(samplePlan) as Record<string, any>;
}

describe('CadSerializer', () => {
    it('round-trips the sample plan', () => {
        const doc = parseDocument(samplePlan);
        expect(parseDocument(serializeDocument(doc))).toEqual(doc);
        expect(doc).toEqual(samplePlan);
    });

    it('strips unknown properties', () => {
        const data = sample();
        data.extra = true;
        data.vertices[0].hovered = true;
        const doc = parseDocument(data);
        expect(doc).not.toHaveProperty('extra');
        expect(doc.vertices[0]).not.toHaveProperty('hovered');
    });

    it.each([
        ['invalid JSON', () => '{', '$'],
        ['a wrong schema version', (d: any) => ({ ...d, schemaVersion: 2 }), '$.schemaVersion'],
        ['an unknown unit', (d: any) => ({ ...d, unit: 'in' }), '$.unit'],
        ['an unknown element type', (d: any) => { d.elements[0].type = 'spline'; return d; }, '$.elements[0].type'],
        ['a dangling vertex reference', (d: any) => { d.elements[2].endVertexId = 'nope'; return d; }, '$.elements[2]'],
        ['a dangling style reference', (d: any) => { d.elements[0].styleId = 'nope'; return d; }, '$.elements[0].styleId'],
        ['a dangling layer reference', (d: any) => { d.elements[0].layerId = 'nope'; return d; }, '$.elements[0].layerId'],
        ['a dangling group reference', (d: any) => { d.elements[0].groupId = 'nope'; return d; }, '$.elements[0].groupId'],
        ['a duplicate vertex id', (d: any) => { d.vertices[1].id = d.vertices[0].id; return d; }, '$.vertices[1].id'],
        ['a duplicate element id', (d: any) => { d.elements[1].id = d.elements[0].id; return d; }, '$.elements[1].id'],
        ['a non-positive radius', (d: any) => { d.elements[5].radius = 0; return d; }, '$.elements[5].radius'],
        ['a non-finite coordinate', (d: any) => { d.vertices[0].x = 'NaN'; return d; }, '$.vertices[0].x'],
        ['a polyline with one vertex', (d: any) => { d.elements[0].vertexIds = ['w-o1']; return d; }, '$.elements[0].vertexIds'],
    ])('rejects %s', (_label, mutate, path) => {
        const input = mutate(sample());
        try {
            parseDocument(input);
            expect.unreachable('parseDocument should throw');
        } catch (error) {
            expect(error).toBeInstanceOf(CadDocumentError);
            expect((error as CadDocumentError).path).toBe(path);
        }
    });
});
