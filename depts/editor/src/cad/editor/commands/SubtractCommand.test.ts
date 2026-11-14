import { describe, expect, it } from 'vitest';
import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs } from '../../model/CadElement';
import { parseDocument } from '../../persistence/CadSerializer';
import samplePlan from '../../__fixtures__/sample-plan.json';
import { sampleIds } from '../../__fixtures__/sampleIds';
import { AddCircleCommand } from './AddCircleCommand';
import { AddPolylineCommand } from './AddPolylineCommand';
import { SubtractCommand } from './SubtractCommand';

const { element: E, vertex: V, layer: L, style: S } = sampleIds;

const doc = parseDocument(samplePlan);
/** Deterministic ids, `prefix-1` on. */
const ids = (prefix: string) => {
    let n = 0;
    return () => `${prefix}-${++n}`;
};
/** The sample plan with a circle added, and its id. The sofa spans 600…2600 × 2600…3500. */
function withCircle(x: number, y: number, radius: number, from: CadDocument = doc): { document: CadDocument; circle: string } {
    const command = new AddCircleCommand(sampleIds.layer['0'], { x, y }, radius, ids(`circle-${x}`));
    return { document: command.execute(from).document, circle: command.circleId };
}
const subtract = (minuends: string[], subtrahends: string[]) => new SubtractCommand(minuends, subtrahends, 'DIFFERENZ', 'SUBTRACT', ids('new'));
const positions = (d: CadDocument, id: string) => {
    const element = d.elements.find((candidate) => candidate.id === id)!;
    return vertexRefs(element).map((ref) => {
        const { x, y } = d.vertices.find((vertex) => vertex.id === ref)!;
        return { x: Math.round(x * 1e6) / 1e6, y: Math.round(y * 1e6) / 1e6 };
    });
};

describe('SubtractCommand', () => {
    it('puts the outline that is left in the place of the first element, with its properties', () => {
        const { document: before, circle } = withCircle(2600, 3050, 200);
        const { document, changedElementIds } = subtract([E.sofa], [circle]).execute(before);

        expect(document.elements).toHaveLength(before.elements.length - 1);
        // Where the sofa was in the drawing order
        const at = before.elements.findIndex((element) => element.id === E.sofa);
        expect(document.elements[at]).toMatchObject({
            id: 'new-1',
            type: 'polyline',
            name: 'Sofa',
            layerId: L.furniture,
            styleId: S.furniture,
            groupId: null,
            closed: true,
        });
        expect(positions(document, 'new-1')).toEqual([
            { x: 600, y: 2600 },
            { x: 2600, y: 2600 },
            { x: 2600, y: 2850 },
            { x: 2600, y: 3250 },
            { x: 2600, y: 3500 },
            { x: 600, y: 3500 },
        ]);
        const cut = document.elements[at];
        expect(cut.type === 'polyline' && cut.bulges.map((bulge) => Math.round(bulge * 1e9) / 1e9)).toEqual([0, 0, -1, 0, 0, 0]);
        expect(document.elements.some((element) => element.id === circle || element.id === E.sofa)).toBe(false);
        expect(changedElementIds).toEqual([E.sofa, circle, 'new-1']);
        // The vertices of what is gone went along
        expect(document.vertices).toHaveLength(before.vertices.length - 5 + 6);
        expect(document.vertices.some((vertex) => vertex.id === V['s-1'])).toBe(false);
        expect(document.groups).toBe(before.groups);
    });

    it('restores the document exactly on undo and repeats its ids on redo', () => {
        const { document: before, circle } = withCircle(2600, 3050, 200);
        const command = subtract([E.sofa], [circle]);
        const done = command.execute(before);
        const undone = command.undo(done.document);
        expect(undone.document).toEqual(before);
        expect(undone.changedElementIds).toEqual([E.sofa, circle, 'new-1']);
        expect(command.execute(undone.document).document).toEqual(done.document);
    });

    it('groups an outline with its hole, the hole a circle', () => {
        const { document: before, circle } = withCircle(1600, 3050, 100);
        const { document } = subtract([E.sofa], [circle]).execute(before);
        const at = before.elements.findIndex((element) => element.id === E.sofa);
        expect(document.groups.at(-1)).toEqual({ id: 'new-1', name: 'DIFFERENZ' });
        expect(document.elements[at]).toMatchObject({ id: 'new-2', type: 'polyline', name: 'Sofa', groupId: 'new-1' });
        expect(positions(document, 'new-2')).toEqual(positions(before, E.sofa));
        expect(document.elements[at + 1]).toMatchObject({
            id: 'new-7',
            type: 'circle',
            name: null,
            radius: 100,
            groupId: 'new-1',
            layerId: L.furniture,
            styleId: S.furniture,
        });
        expect(positions(document, 'new-7')).toEqual([{ x: 1600, y: 3050 }]);
    });

    it('keeps vertices other elements still use', () => {
        // The axis runs from a corner of the outer wall to one of the inner wall
        const { document } = subtract([E['wall-outer']], [E['wall-inner']]).execute(doc);
        const kept = document.vertices.map((vertex) => vertex.id);
        expect(kept).toContain(V['w-o4']);
        expect(kept).toContain(V['w-i4']);
        expect(kept).not.toContain(V['w-o2']);
        expect(kept).not.toContain(V['w-i3']);
        expect(document.elements.find((element) => element.id === E.axis)).toBe(doc.elements.find((element) => element.id === E.axis));
        // The ring between the walls: the outer outline and the inner one as its hole
        expect(positions(document, 'new-2')).toEqual(positions(doc, E['wall-outer']));
        expect(positions(document, 'new-7')).toEqual([
            { x: 5760, y: 240 },
            { x: 240, y: 240 },
            { x: 240, y: 3760 },
            { x: 5760, y: 3760 },
        ]);
    });

    it('takes away what touches nothing, and leaves a circle a circle', () => {
        const { document: before, circle } = withCircle(500, 500, 50);
        const { document } = subtract([E.table], [circle]).execute(before);
        expect(document.elements.some((element) => element.id === circle)).toBe(false);
        expect(document.elements.find((element) => element.id === 'new-1')).toMatchObject({ type: 'circle', name: 'Table', radius: 600 });
        // The rug is an ellipse around the same centre, which keeps its vertex
        expect(document.vertices.map((vertex) => vertex.id)).toContain(V['t-center']);
    });

    it('leaves nothing where the area is covered', () => {
        const cover = new AddPolylineCommand(
            sampleIds.layer['0'],
            [
                { x: 500, y: 2500 },
                { x: 2700, y: 2500 },
                { x: 2700, y: 3600 },
                { x: 500, y: 3600 },
            ],
            true,
            'RECTANG',
            ids('cover'),
        );
        const before = cover.execute(doc).document;
        const { document } = subtract([E.sofa], [cover.polylineId]).execute(before);
        expect(document.elements.map((element) => element.id)).toEqual(
            doc.elements.map((element) => element.id).filter((id) => id !== E.sofa),
        );
        expect(document.vertices).toHaveLength(doc.vertices.length - 4);
    });

    it('passes over elements that bound no area, and counts one in both sets as kept', () => {
        const { document: before, circle } = withCircle(2600, 3050, 200);
        const command = subtract([E.sofa, E.window], [E.rug, E.sofa, circle, E['door-leaf']]);
        const { document } = command.execute(before);
        for (const id of [E.window, E.rug, E['door-leaf']]) {
            expect(document.elements.find((element) => element.id === id)).toBe(before.elements.find((element) => element.id === id));
        }
        expect(positions(document, 'new-1')).toHaveLength(6);
        expect(command.undo(document).document).toEqual(before);
        // Nothing to cut from: nothing happens
        expect(subtract([E.window], [circle]).execute(before)).toEqual({ document: before, changedElementIds: [] });
    });

    it('takes elements together without subtrahends, named VEREINIG', () => {
        // A circle half over the right edge of the sofa, and one away from it
        const { document: bulged, circle } = withCircle(2600, 3050, 200);
        const { document: before, circle: apart } = withCircle(500, 500, 50, bulged);
        const command = new SubtractCommand([E.sofa, circle, apart], [], 'VEREINIG', 'UNION', ids('new'));
        expect(command.label).toBe('UNION');
        const { document } = command.execute(before);
        expect(document.groups.at(-1)).toEqual({ id: 'new-1', name: 'VEREINIG' });
        const united = document.elements.filter((element) => element.groupId === 'new-1');
        expect(united).toMatchObject([
            { id: 'new-2', type: 'polyline', name: 'Sofa', styleId: S.furniture },
            { id: 'new-9', type: 'circle', name: null, radius: 50, styleId: S.furniture, layerId: L.furniture },
        ]);
        // The sofa with half the circle on its right edge, bulging out
        expect(positions(document, 'new-2')).toEqual([
            { x: 600, y: 2600 },
            { x: 2600, y: 2600 },
            { x: 2600, y: 2850 },
            { x: 2600, y: 3250 },
            { x: 2600, y: 3500 },
            { x: 600, y: 3500 },
        ]);
        const outline = united[0];
        expect(outline.type === 'polyline' && outline.bulges.map((bulge) => Math.round(bulge * 1e9) / 1e9)).toEqual([0, 0, 1, 0, 0, 0]);
        expect(document.elements).toHaveLength(before.elements.length - 1);
        expect(command.undo(document).document).toEqual(before);
    });

    it('keeps a single outline in the group of the first element and drops a group left empty', () => {
        const grouped: CadDocument = {
            ...doc,
            groups: [...doc.groups, { id: 'seats', name: 'Seats' }],
            elements: doc.elements.map((element) => (element.id === E.sofa ? { ...element, groupId: 'seats' } : element)),
        };
        const { document: before, circle } = withCircle(2600, 3050, 200, grouped);
        const cut = subtract([E.sofa], [circle]).execute(before).document;
        expect(cut.elements.find((element) => element.id === 'new-1')).toMatchObject({ groupId: 'seats' });
        expect(cut.groups).toEqual(before.groups);
        // Two pieces go into that group too, no new one
        const { document: halved, circle: wide } = withCircle(1600, 3050, 500, grouped);
        const pieces = subtract([E.sofa], [wide]).execute(halved).document;
        expect(pieces.elements.filter((element) => element.groupId === 'seats')).toHaveLength(2);
        expect(pieces.groups).toEqual(halved.groups);
        // Cut away by the table from the other side: the sofa as subtrahend goes with its group
        const gone = subtract([E.table], [E.sofa]).execute(grouped).document;
        expect(gone.groups).toEqual(doc.groups);
    });
});
