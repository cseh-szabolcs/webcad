import type { CadDocument } from '../../model/CadDocument';
import type { EllipseElement } from '../../model/CadElement';
import type { Vector2 } from '../../model/Point';
import type { Command, CommandResult } from './Command';

/** Sets both radii of an ellipse around its unchanged centre. */
export class ResizeEllipseCommand implements Command {
    readonly label: string;
    private readonly before: EllipseElement;
    private readonly after: EllipseElement;

    /** `element` is the current state from the document the command will be executed on. */
    constructor(element: EllipseElement, radii: Vector2, label = 'Resize') {
        this.before = element;
        this.after = { ...element, radiusX: radii.x, radiusY: radii.y };
        this.label = label;
    }

    execute(doc: CadDocument): CommandResult {
        return replace(doc, this.after);
    }

    undo(doc: CadDocument): CommandResult {
        return replace(doc, this.before);
    }
}

function replace(doc: CadDocument, element: EllipseElement): CommandResult {
    const elements = doc.elements.map((existing) => (existing.id === element.id ? element : existing));
    return { document: { ...doc, elements }, changedElementIds: [element.id] };
}
