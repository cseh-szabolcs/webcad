import type { CadDocument } from '../../model/CadDocument';
import { vertexRefs } from '../../model/CadElement';
import type { Id, Vector2 } from '../../model/Point';
import type { Command, CommandResult } from './Command';

/**
 * Translates vertices by a delta. Every element referencing one of them changes,
 * including unselected elements that share a vertex.
 */
export class MoveVerticesCommand implements Command {
    readonly label: string;
    private readonly vertexIds: ReadonlySet<Id>;
    private readonly delta: Vector2;

    constructor(vertexIds: Iterable<Id>, delta: Vector2, label = 'Move') {
        this.vertexIds = new Set(vertexIds);
        this.delta = delta;
        this.label = label;
    }

    execute(doc: CadDocument): CommandResult {
        return this.translate(doc, this.delta.x, this.delta.y);
    }

    undo(doc: CadDocument): CommandResult {
        return this.translate(doc, -this.delta.x, -this.delta.y);
    }

    private translate(doc: CadDocument, dx: number, dy: number): CommandResult {
        const vertices = doc.vertices.map((vertex) =>
            this.vertexIds.has(vertex.id) ? { ...vertex, x: vertex.x + dx, y: vertex.y + dy } : vertex,
        );
        const changedElementIds = doc.elements
            .filter((element) => vertexRefs(element).some((id) => this.vertexIds.has(id)))
            .map((element) => element.id);
        return { document: { ...doc, vertices }, changedElementIds };
    }
}
