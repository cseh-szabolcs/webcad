import type { CadDocument } from '../../model/CadDocument';
import type { Id } from '../../model/Point';
import type { EditorCommand } from '../commandNames';

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
    /** The command, e.g. "MOVE"; the command line shows its name in the current language (commandName). */
    readonly label: EditorCommand;
    execute(doc: CadDocument): DocumentChange;
    undo(doc: CadDocument): DocumentChange;
}
