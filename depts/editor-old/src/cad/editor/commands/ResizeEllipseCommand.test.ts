import { describe, expect, it } from 'vitest';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import type { EllipseElement } from '../../model/CadElement';
import { parseDocument } from '../../persistence/CadSerializer';
import { ResizeEllipseCommand } from './ResizeEllipseCommand';

const { element: E } = sampleIds;

const doc = parseDocument(samplePlan);
const table = doc.elements.find((e) => e.id === E.table) as EllipseElement;
const tableAfter = (d: typeof doc) => d.elements.find((e) => e.id === E.table);

describe('ResizeEllipseCommand', () => {
    it('sets both radii', () => {
        const { document, changedElementIds } = new ResizeEllipseCommand(table, { x: 800, y: 400 }).execute(doc);
        expect(tableAfter(document)).toEqual({ ...table, radiusX: 800, radiusY: 400 });
        expect(changedElementIds).toEqual([E.table]);
    });

    it('restores the exact document on undo without mutating its input', () => {
        const before = structuredClone(doc);
        const command = new ResizeEllipseCommand(table, { x: 900, y: 400 });
        const resized = command.execute(doc).document;

        expect(doc).toEqual(before);
        expect(command.undo(resized).document).toEqual(doc);
    });

    it('keeps the drawing order', () => {
        const { document } = new ResizeEllipseCommand(table, { x: 900, y: 400 }).execute(doc);
        expect(document.elements.map((e) => e.id)).toEqual(doc.elements.map((e) => e.id));
    });
});
