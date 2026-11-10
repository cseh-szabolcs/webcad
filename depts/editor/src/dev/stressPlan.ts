import { CURRENT_SCHEMA_VERSION, type CadDocument } from 'app/cad/model/CadDocument';
import type { CadElement } from 'app/cad/model/CadElement';

/** Mean distance between the elements in mm, so the density stays the same for every count. */
const SPACING_MM = 500;
/** Largest extent of one element in mm. */
const ELEMENT_SIZE_MM = 1500;

/**
 * Dev only (`?stress=<count>`): a generated plan of `count` elements (lines, circles and closed
 * polylines without layer or style), to measure the editor on large drawings. The same count
 * always gives the same plan.
 */
export function stressPlan(count: number): CadDocument {
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const side = Math.sqrt(count) * SPACING_MM;
    const vertices: CadDocument['vertices'] = [];
    const elements: CadElement[] = [];
    const vertex = (x: number, y: number) => {
        const id = `v-${vertices.length}`;
        vertices.push({ id, x, y });
        return id;
    };
    for (let i = 0; i < count; i++) {
        const base = { id: `e-${i}`, name: null, layerId: null, groupId: null, styleId: null };
        const x = random() * side;
        const y = random() * side;
        const width = (random() - 0.5) * 2 * ELEMENT_SIZE_MM;
        const height = (random() - 0.5) * 2 * ELEMENT_SIZE_MM;
        const kind = i % 10;
        if (kind < 7) {
            elements.push({ ...base, type: 'line', startVertexId: vertex(x, y), endVertexId: vertex(x + width, y + height) });
        } else if (kind < 9) {
            elements.push({ ...base, type: 'circle', centerVertexId: vertex(x, y), radius: 50 + Math.abs(width) / 2 });
        } else {
            const vertexIds = [vertex(x, y), vertex(x + width, y), vertex(x + width, y + height), vertex(x, y + height)];
            elements.push({ ...base, type: 'polyline', vertexIds, closed: true });
        }
    }
    return {
        id: '00000000-0000-4000-8000-000000000000',
        name: `Stress ${count}`,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        unit: 'mm',
        vertices,
        elements,
        layers: [],
        groups: [],
        styles: [],
    };
}
