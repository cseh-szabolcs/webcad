import type { CadEditor } from 'app/cad/editor/CadEditor';
import type { Viewport } from 'app/cad/renderer/Viewport';
import { useEditorSnapshot } from './useEditorSnapshot';

interface EditorToolbarProps {
    editor: CadEditor;
    viewport: Viewport | null;
    onFit: () => void;
}

export function EditorToolbar({ editor, viewport, onFit }: EditorToolbarProps) {
    const snapshot = useEditorSnapshot(editor);

    return (
        <header className="toolbar">
            <span className="toolbar-title">{editor.document.name}</span>
            <button type="button" onClick={() => editor.undo()} disabled={!snapshot.canUndo} title={snapshot.undoLabel ? `Undo: ${snapshot.undoLabel}` : 'Undo'}>
                Undo
            </button>
            <button type="button" onClick={() => editor.redo()} disabled={!snapshot.canRedo} title={snapshot.redoLabel ? `Redo: ${snapshot.redoLabel}` : 'Redo'}>
                Redo
            </button>
            <button type="button" onClick={() => editor.deleteSelection()} disabled={snapshot.selectionCount === 0}>
                Delete
            </button>
            <button type="button" onClick={() => editor.groupSelection()} disabled={!snapshot.canGroup} title="Group (Cmd/Ctrl+G)">
                Group
            </button>
            <button type="button" onClick={() => editor.ungroupSelection()} disabled={!snapshot.canUngroup} title="Ungroup (Cmd/Ctrl+Shift+G)">
                Ungroup
            </button>
            <button type="button" onClick={() => editor.toggleSnap()} aria-pressed={snapshot.snapEnabled} title="Snap to vertices (F3)">
                Snap
            </button>
            <button type="button" onClick={onFit}>
                Fit
            </button>
            {snapshot.selectionCount > 0 && <span>{snapshot.selectionCount} selected</span>}
            {viewport && (
                <span className="toolbar-scale" title="On-screen scale at 96 dpi">
                    1:{formatScale(viewport.scaleDenominator())}
                </span>
            )}
        </header>
    );
}

function formatScale(denominator: number): string {
    return denominator >= 10 ? Math.round(denominator).toString() : denominator.toPrecision(2);
}
