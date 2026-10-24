import type { CadDocument } from '../../model/CadDocument';
import type { Id } from '../../model/Point';

/** A new document and the elements whose geometry or references changed on the way. */
export interface DocumentChange {
    document: CadDocument;
    changedElementIds: readonly Id[];
}

/**
 * A persistent model change. Documents are immutable: `execute` and `undo` return a new
 * document. `undo` gets the document `execute` returned and restores the one before exactly;
 * `execute` may run again after `undo` (redo) and then gives the same result.
 */
export interface DocumentCommand {
    /** Command name for the command line, e.g. "SCHIEBEN". */
    readonly label: string;
    execute(doc: CadDocument): DocumentChange;
    undo(doc: CadDocument): DocumentChange;
}
