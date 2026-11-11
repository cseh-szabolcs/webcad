import type { CadDocument } from '../../model/CadDocument';
import { indexDocument } from '../../model/DocumentIndex';
import type { Id, Vector2 } from '../../model/Point';
import { stretchTargets } from '../grips/stretch';
import type { Grip } from '../selection/grips';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';
import { applyElementEdits, revertElementEdits, type AppliedEdits } from './elementEdits';

/**
 * Grip mode STRETCH: the grips go by `delta` and change their elements (see stretchTargets).
 * Like AutoCAD, only those elements change; others that share a vertex keep a copy of it at
 * the old position (see applyElementEdits).
 */
export class StretchCommand implements DocumentCommand {
    readonly label = 'GRIP_STRETCH';
    private readonly grips: readonly Grip[];
    private readonly delta: Vector2;
    private readonly newId: () => Id;
    /** Ids of the vertex copies; fixed on the first run, so redo repeats them. */
    private readonly copies = new Map<string, Id>();
    private applied: AppliedEdits | null = null;

    constructor(grips: readonly Grip[], delta: Vector2, newId: () => Id = () => crypto.randomUUID()) {
        this.grips = grips;
        this.delta = delta;
        this.newId = newId;
    }

    execute(doc: CadDocument): DocumentChange {
        const edits = stretchTargets(indexDocument(doc), this.grips, this.delta) ?? [];
        const { change, applied } = applyElementEdits(doc, edits, this.copies, this.newId);
        this.applied = applied;
        return change;
    }

    undo(doc: CadDocument): DocumentChange {
        return this.applied ? revertElementEdits(doc, this.applied) : { document: doc, changedElementIds: [] };
    }
}
