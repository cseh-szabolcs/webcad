import type { CadDocument } from '../../model/CadDocument';
import { indexDocument, type DocumentIndex } from '../../model/DocumentIndex';
import type { Id } from '../../model/Point';
import type { CommandLabel } from '../commandNames';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';
import { applyElementEdits, revertElementEdits, type AppliedEdits, type ElementEdit } from './elementEdits';

/**
 * Changes elements as `edits` says for the document it runs on (e.g. a grip's Lengthen),
 * named by `label`. Elements it does not edit never change: where one shares a moved vertex,
 * it keeps a copy at the old position (see applyElementEdits).
 */
export class EditCommand implements DocumentCommand {
    readonly label: CommandLabel;
    private readonly edits: (index: DocumentIndex) => readonly ElementEdit[];
    private readonly newId: () => Id;
    /** Ids of the vertex copies; fixed on the first run, so redo repeats them. */
    private readonly copies = new Map<string, Id>();
    private applied: AppliedEdits | null = null;

    constructor(
        label: CommandLabel,
        edits: (index: DocumentIndex) => readonly ElementEdit[],
        newId: () => Id = () => crypto.randomUUID(),
    ) {
        this.label = label;
        this.edits = edits;
        this.newId = newId;
    }

    execute(doc: CadDocument): DocumentChange {
        const { change, applied } = applyElementEdits(doc, this.edits(indexDocument(doc)), this.copies, this.newId);
        this.applied = applied;
        return change;
    }

    undo(doc: CadDocument): DocumentChange {
        return this.applied ? revertElementEdits(doc, this.applied) : { document: doc, changedElementIds: [] };
    }
}
