import type { CadDocument } from '../../model/CadDocument';
import type { Id } from '../../model/Point';
import type { EditorCommand } from '../commandNames';
import type { DocumentChange, DocumentCommand } from './DocumentCommand';

/** Several commands as one undo step, e.g. all segments of one LINIE run. */
export class CompositeCommand implements DocumentCommand {
    readonly label: EditorCommand;
    private readonly commands: readonly DocumentCommand[];

    constructor(label: EditorCommand, commands: readonly DocumentCommand[]) {
        this.label = label;
        this.commands = commands;
    }

    execute(doc: CadDocument): DocumentChange {
        return run(doc, this.commands, (command, current) => command.execute(current));
    }

    undo(doc: CadDocument): DocumentChange {
        return run(doc, [...this.commands].reverse(), (command, current) => command.undo(current));
    }
}

function run(
    doc: CadDocument,
    commands: readonly DocumentCommand[],
    step: (command: DocumentCommand, doc: CadDocument) => DocumentChange,
): DocumentChange {
    let document = doc;
    const changed = new Set<Id>();
    for (const command of commands) {
        const change = step(command, document);
        document = change.document;
        change.changedElementIds.forEach((id) => changed.add(id));
    }
    return { document, changedElementIds: [...changed] };
}
