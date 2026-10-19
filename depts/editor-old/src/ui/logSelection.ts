import type { CadEditor } from 'app/cad/editor/CadEditor';
import type { CadDocument } from 'app/cad/model/CadDocument';
import { vertexRefs, type CadElement } from 'app/cad/model/CadElement';

/**
 * Dev aid: logs the whole selection with type, name and group whenever the selection or the
 * document changes (e.g. after a command). Hover changes are ignored. Returns the
 * unsubscribe function.
 */
export function logSelection(editor: CadEditor): () => void {
    let previousSelection = editor.selection.selected;
    let previousDocument = editor.document;
    return editor.subscribe(() => {
        const selected = editor.selection.selected;
        const doc = editor.document;
        if (selected === previousSelection && doc === previousDocument) {
            return;
        }
        previousSelection = selected;
        previousDocument = doc;

        const elements = doc.elements.filter((element) => selected.has(element.id));
        if (elements.length === 0) {
            console.log('[cad] selection (0)');
            return;
        }
        console.groupCollapsed(`[cad] selection (${elements.length})`);
        for (const element of elements) {
            const vertices = vertexRefs(element).map((id) => doc.vertices.find((v) => v.id === id));
            console.log(describe(doc, element), { element, vertices });
        }
        console.groupEnd();
    });
}

function describe(doc: CadDocument, element: CadElement): string {
    const name = element.name === undefined ? element.id : `"${element.name}"`;
    const group = doc.groups.find((g) => g.id === element.groupId);
    return `${element.type.padEnd(8)} ${name}${group ? `  group "${group.name}"` : ''}`;
}
