import { subtractShapes, type ClosedShape } from '../../geometry/regionBoolean';
import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs, type CadElement } from '../../model/CadElement';
import { indexDocument, requireVertex, type DocumentIndex } from '../../model/DocumentIndex';
import type { Group } from '../../model/Group';
import type { Id } from '../../model/Point';
import type { Vertex } from '../../model/Vertex';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/**
 * The area an element bounds, for DIFFERENZ and VEREINIG: of a closed polyline with at least three vertices
 * or a circle; null for every other element, which the command passes over.
 */
export function subtractableShape(element: CadElement, index: DocumentIndex): ClosedShape | null {
    const point = (id: Id) => {
        const { x, y } = requireVertex(index, id);
        return { x, y };
    };
    if (element.type === 'circle') {
        return element.radius > 0 ? { kind: 'circle', center: point(element.centerVertexId), radius: element.radius } : null;
    }
    if (element.type === 'polyline' && element.closed && element.vertexIds.length >= 3) {
        return { kind: 'polyline', points: element.vertexIds.map(point), bulges: element.bulges };
    }
    return null;
}

/** What the command puts into the document; kept from its first run, so redo repeats the ids. */
interface Result {
    vertices: Vertex[];
    elements: CadElement[];
    /** The group of several outlines, where the first object had none. */
    group: Group | null;
}

/**
 * DIFFERENZ (AutoCAD SUBTRACT): takes the area of the `subtrahends` out of the area of the
 * `minuends` taken together (see subtractShapes). All of them go, and the outlines of what is
 * left come in at the place of the first minuend, with its layer and style; the first outline
 * also has its name. One outline stays in the group of that element; several (pieces, holes)
 * are picked together, in its group or in a new one called `groupName`, as the document has no
 * element of several outlines. Elements that bound no area (see subtractableShape) are left
 * alone, and an element in both sets counts as a minuend. Vertices no element uses any more go
 * with their elements, as do groups left empty.
 *
 * Without subtrahends the minuends are only taken together, which is VEREINIG (AutoCAD UNION);
 * `label` then names it.
 */
export class SubtractCommand implements DocumentCommand {
    readonly label: 'SUBTRACT' | 'UNION';
    private readonly minuendIds: readonly Id[];
    private readonly subtrahendIds: readonly Id[];
    private readonly groupName: string;
    private readonly newId: () => Id;
    private result: Result | null = null;
    /** The parts of the document before `execute`, which `undo` puts back. */
    private before: Pick<CadDocument, 'vertices' | 'elements' | 'groups'> | null = null;

    constructor(
        minuendIds: Iterable<Id>,
        subtrahendIds: Iterable<Id>,
        groupName: string,
        label: 'SUBTRACT' | 'UNION' = 'SUBTRACT',
        newId: () => Id = () => crypto.randomUUID(),
    ) {
        this.label = label;
        this.minuendIds = [...minuendIds];
        this.subtrahendIds = [...subtrahendIds];
        this.groupName = groupName;
        this.newId = newId;
    }

    execute(doc: CadDocument): DocumentChange {
        const index = indexDocument(doc);
        const shaped = (ids: readonly Id[], except: ReadonlySet<Id>) =>
            [...new Set(ids)].flatMap((id) => {
                const element = except.has(id) ? undefined : index.elements.get(id);
                const shape = element && subtractableShape(element, index);
                return element && shape ? [{ element, shape }] : [];
            });
        const minuends = shaped(this.minuendIds, new Set());
        const subtrahends = shaped(this.subtrahendIds, new Set(minuends.map(({ element }) => element.id)));
        if (minuends.length === 0) {
            return { document: doc, changedElementIds: [] };
        }
        const first = minuends[0].element;
        const consumed = [...minuends, ...subtrahends].map(({ element }) => element);
        const consumedIds = new Set(consumed.map((element) => element.id));
        this.result ??= this.build(
            subtractShapes(
                minuends.map(({ shape }) => shape),
                subtrahends.map(({ shape }) => shape),
            ),
            first,
        );
        const { vertices, elements, group } = this.result;

        const remaining = doc.elements.filter((element) => !consumedIds.has(element.id));
        const usedVertices = new Set(remaining.flatMap(vertexRefs));
        const orphaned = new Set(consumed.flatMap(vertexRefs).filter((id) => !usedVertices.has(id)));
        const usedGroups = new Set([...remaining, ...elements].map((element) => element.groupId));
        const emptied = new Set(consumed.map((element) => element.groupId).filter((id) => id !== null && !usedGroups.has(id)));
        const groups = emptied.size > 0 || group ? [...doc.groups.filter(({ id }) => !emptied.has(id)), ...(group ? [group] : [])] : doc.groups;

        this.before = { vertices: doc.vertices, elements: doc.elements, groups: doc.groups };
        return {
            document: {
                ...doc,
                vertices: [...doc.vertices.filter((vertex) => !orphaned.has(vertex.id)), ...vertices],
                elements: doc.elements.flatMap((element) =>
                    element.id === first.id ? elements : consumedIds.has(element.id) ? [] : [element],
                ),
                groups,
            },
            changedElementIds: [...consumedIds, ...elements.map((element) => element.id)],
        };
    }

    undo(doc: CadDocument): DocumentChange {
        if (this.before === null || this.result === null) {
            return { document: doc, changedElementIds: [] };
        }
        const restored = [...new Set([...this.minuendIds, ...this.subtrahendIds])];
        return {
            document: { ...doc, ...this.before },
            changedElementIds: [...restored, ...this.result.elements.map((element) => element.id)],
        };
    }

    /** The outlines as elements with vertices of their own, taking after the first minuend. */
    private build(shapes: readonly ClosedShape[], first: CadElement): Result {
        const group = shapes.length > 1 && first.groupId === null ? { id: this.newId(), name: this.groupName } : null;
        const vertices: Vertex[] = [];
        const elements = shapes.map((shape, i): CadElement => {
            const base = {
                id: this.newId(),
                name: i === 0 ? first.name : null,
                layerId: first.layerId,
                groupId: group?.id ?? first.groupId,
                styleId: first.styleId,
            };
            const vertex = ({ x, y }: { x: number; y: number }): Id => {
                const id = this.newId();
                vertices.push({ id, x, y });
                return id;
            };
            return shape.kind === 'circle'
                ? { ...base, type: 'circle', centerVertexId: vertex(shape.center), radius: shape.radius }
                : { ...base, type: 'polyline', vertexIds: shape.points.map(vertex), closed: true, bulges: [...shape.bulges] };
        });
        return { vertices, elements, group };
    }
}
