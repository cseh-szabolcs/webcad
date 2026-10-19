import { useSyncExternalStore } from 'react';
import type { CadEditor, EditorSnapshot } from 'app/cad/editor/CadEditor';

export function useEditorSnapshot(editor: CadEditor): EditorSnapshot {
    return useSyncExternalStore(editor.subscribe, editor.getSnapshot);
}
