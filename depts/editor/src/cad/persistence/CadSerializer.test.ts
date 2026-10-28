import { describe, expect, it } from 'vitest';
import samplePlan from '../__fixtures__/sample-plan.json';
import { sampleIds } from '../__fixtures__/sampleIds';
import { CadDocumentError, parseDocument, serializeDocument } from './CadSerializer';

const { vertex: V } = sampleIds;

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

    it('keeps optional element names', () => {
        const data = sample();
        delete data.elements[1].name;
        const doc = parseDocument(data);
        expect(doc.elements[0].name).toBe('Wall outer');
        expect(doc.elements[1]).not.toHaveProperty('name');
    });

    it('treats a null element name as no name', () => {
        const data = sample();
        data.elements[1].name = null;
        expect(parseDocument(data).elements[1]).not.toHaveProperty('name');
    });

    it('parses circle, ellipse and bezier', () => {
        const doc = parseDocument(samplePlan);
        expect(doc.elements[5]).toMatchObject({ type: 'circle', radius: 600 });
        expect(doc.elements[8]).toMatchObject({ type: 'ellipse', radiusX: 1000, radiusY: 700 });
        expect(doc.elements[9]).toMatchObject({ type: 'bezier', startControl: { x: 500, y: -200 } });
        expect(doc.elements[8]).not.toHaveProperty('rotation');
    });

    it('reads the optional rotation of an ellipse', () => {
        const data = structuredClone(samplePlan) as any;
        data.elements[8].rotation = 0.5;
        expect(parseDocument(data).elements[8]).toMatchObject({ type: 'ellipse', rotation: 0.5 });
        data.elements[8].rotation = 'x';
        expect(() => parseDocument(data)).toThrow('$.elements[8].rotation: expected a finite number');
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
        ['a non-positive radius', (d: any) => { d.elements[8].radiusY = 0; return d; }, '$.elements[8].radiusY'],
        ['a circle without radius', (d: any) => { delete d.elements[5].radius; return d; }, '$.elements[5].radius'],
        ['an arc without direction', (d: any) => { delete d.elements[3].clockwise; return d; }, '$.elements[3].clockwise'],
        ['a readable id', (d: any) => { d.vertices[0].id = 'w-o1'; return d; }, '$.vertices[0].id'],
        ['an uppercase uuid', (d: any) => { d.elements[0].id = '0000000A-0000-7000-8000-000000000101'; return d; }, '$.elements[0].id'],
        ['a non-string element name', (d: any) => { d.elements[0].name = 42; return d; }, '$.elements[0].name'],
        ['a non-finite coordinate', (d: any) => { d.vertices[0].x = 'NaN'; return d; }, '$.vertices[0].x'],
        ['a polyline with one vertex', (d: any) => { d.elements[0].vertexIds = [V['w-o1']]; return d; }, '$.elements[0].vertexIds'],
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
