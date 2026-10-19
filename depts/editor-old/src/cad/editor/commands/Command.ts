import type { CadDocument } from '../../model/CadDocument';
import type { Id } from '../../model/Point';

export interface CommandResult {
    document: CadDocument;
    /** Elements the renderer has to create, update or remove. */
    changedElementIds: Id[];
}

/**
 * A persistent, undoable model change. Commands never mutate the document they get;
 * they return a new one.
 */
export interface Command {
    readonly label: string;
    execute(doc: CadDocument): CommandResult;
    undo(doc: CadDocument): CommandResult;
}
