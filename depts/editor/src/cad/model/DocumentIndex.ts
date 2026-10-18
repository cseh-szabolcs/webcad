import type { CadDocument } from './CadDocument';
import type { CadElement } from './CadElement';
import type { ElementStyle } from './ElementStyle';
import type { Group } from './Group';
import type { Layer } from './Layer';
import type { Id } from './Point';
import type { Vertex } from './Vertex';

/** Derived id lookups for a document. Never persisted. */
export interface DocumentIndex {
    vertices: ReadonlyMap<Id, Vertex>;
    elements: ReadonlyMap<Id, CadElement>;
    layers: ReadonlyMap<Id, Layer>;
    groups: ReadonlyMap<Id, Group>;
    styles: ReadonlyMap<Id, ElementStyle>;
}

function byId<T extends { id: Id }>(items: T[]): Map<Id, T> {
    return new Map(items.map((item) => [item.id, item]));
}

export function indexDocument(doc: CadDocument): DocumentIndex {
    return {
        vertices: byId(doc.vertices),
        elements: byId(doc.elements),
        layers: byId(doc.layers),
        groups: byId(doc.groups),
        styles: byId(doc.styles),
    };
}

export function requireVertex(index: DocumentIndex, id: Id): Vertex {
    const vertex = index.vertices.get(id);
    if (!vertex) {
        throw new Error(`Unknown vertex "${id}"`);
    }
    return vertex;
}
