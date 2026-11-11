import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, withVertexRefs, type CadElement } from '../../model/CadElement';
import type { Id, Point } from '../../model/Point';
import type { DocumentChange } from './DocumentCommand';

/**
 * An element after an edit and where its vertices go; vertices left out stay. The positions
 * hold for this element only: another element that shares a vertex keeps its own (see
 * applyElementEdits).
 */
export interface ElementEdit {
    element: CadElement;
    vertices: ReadonlyMap<Id, Point>;
}

/** What applyElementEdits changed, so revertElementEdits restores it exactly. */
export interface AppliedEdits {
    /** Positions of the moved vertices before. */
    vertices: ReadonlyMap<Id, Point>;
    /** The changed elements as they were. */
    elements: ReadonlyMap<Id, CadElement>;
    /** Vertices added for elements that left a shared one. */
    added: ReadonlySet<Id>;
    /** The edited elements and the neighbours that left a vertex. */
    changedElementIds: readonly Id[];
}

/**
 * Applies edits like AutoCAD, where elements share no points: an edited element changes only
 * as its edit says, every other element not at all. Where elements share a vertex and do not
 * agree on its new position (see SAME_POSITION), the first edit that moves it keeps the vertex; each other
 * position gets a copy, and those that stay share one at the old position, so they stay
 * connected to each other. `copies` remembers the ids of the copies (filled on the first run),
 * so a redo repeats them.
 */
export function applyElementEdits(
    doc: CadDocument,
    edits: readonly ElementEdit[],
    copies: Map<string, Id>,
    newId: () => Id,
): { change: DocumentChange; applied: AppliedEdits } {
    const old = new Map<Id, Point>();
    for (const vertex of doc.vertices) {
        old.set(vertex.id, { x: vertex.x, y: vertex.y });
    }
    // Per moved vertex: the positions it goes to, each with the elements that take it there
    const targets = new Map<Id, { point: Point; elementIds: Set<Id> }[]>();
    for (const { element, vertices } of edits) {
        for (const [id, point] of vertices) {
            const before = old.get(id);
            if (!before || samePosition(before, point)) {
                continue;
            }
            const groups = targets.get(id) ?? [];
            targets.set(id, groups);
            const group = groups.find((candidate) => samePosition(candidate.point, point));
            if (group) {
                group.elementIds.add(element.id);
            } else {
                groups.push({ point, elementIds: new Set([element.id]) });
            }
        }
    }
    const copyId = (key: string): Id => {
        const id = copies.get(key) ?? newId();
        copies.set(key, id);
        return id;
    };
    const moved = new Map<Id, Point>();
    const added: { id: Id; x: number; y: number }[] = [];
    /** Per element: the shared vertices it leaves, each for its copy. */
    const replaced = new Map<Id, Map<Id, Id>>();
    const replace = (elementId: Id, from: Id, to: Id) => {
        const refs = replaced.get(elementId) ?? new Map<Id, Id>();
        replaced.set(elementId, refs);
        refs.set(from, to);
    };
    const staying = new Map<Id, Id>();
    for (const element of doc.elements) {
        for (const id of vertexRefs(element)) {
            const groups = targets.get(id);
            if (!groups || groups.some((group) => group.elementIds.has(element.id))) {
                continue;
            }
            let copy = staying.get(id);
            if (copy === undefined) {
                copy = copyId(`${id}#0`);
                staying.set(id, copy);
                added.push({ id: copy, ...old.get(id)! });
            }
            replace(element.id, id, copy);
        }
    }
    for (const [id, groups] of targets) {
        moved.set(id, groups[0].point);
        groups.slice(1).forEach((group, i) => {
            const copy = copyId(`${id}#${i + 1}`);
            added.push({ id: copy, ...group.point });
            group.elementIds.forEach((elementId) => replace(elementId, id, copy));
        });
    }
    const edited = new Map(edits.map((edit) => [edit.element.id, edit.element]));
    const before = new Map<Id, CadElement>();
    const elements = doc.elements.map((element) => {
        const refs = replaced.get(element.id);
        const next = edited.get(element.id) ?? element;
        if (next === element && !refs) {
            return element;
        }
        before.set(element.id, element);
        return refs ? withVertexRefs(next, refs) : next;
    });
    const beforeVertices = new Map<Id, Point>();
    const vertices = doc.vertices.map((vertex) => {
        const point = moved.get(vertex.id);
        if (!point) {
            return vertex;
        }
        beforeVertices.set(vertex.id, old.get(vertex.id)!);
        return { ...vertex, ...point };
    });
    // Edited elements first, then the neighbours that left a vertex
    const changedElementIds = [...new Set([...edited.keys(), ...before.keys()])];
    return {
        change: { document: { ...doc, vertices: [...vertices, ...added], elements }, changedElementIds },
        applied: {
            vertices: beforeVertices,
            elements: before,
            added: new Set(added.map((vertex) => vertex.id)),
            changedElementIds,
        },
    };
}

/** Takes back applyElementEdits on the document it returned. */
export function revertElementEdits(doc: CadDocument, applied: AppliedEdits): DocumentChange {
    return {
        document: {
            ...doc,
            vertices: doc.vertices
                .filter((vertex) => !applied.added.has(vertex.id))
                .map((vertex) => {
                    const point = applied.vertices.get(vertex.id);
                    return point ? { ...vertex, ...point } : vertex;
                }),
            elements: doc.elements.map((element) => applied.elements.get(element.id) ?? element),
        },
        changedElementIds: applied.changedElementIds,
    };
}

/** Relative to the coordinates, below which two positions are one: rounding must not split a shared vertex. */
const SAME_POSITION = 1e-9;

/** The two positions are one (see SAME_POSITION). */
export function samePosition(a: Point, b: Point): boolean {
    const near = (p: number, q: number) => Math.abs(p - q) <= SAME_POSITION * Math.max(1, Math.abs(p), Math.abs(q));
    return near(a.x, b.x) && near(a.y, b.y);
}
