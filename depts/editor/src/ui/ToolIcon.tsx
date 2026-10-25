import type { EditorCommand } from 'app/cad/editor/commandNames';

/**
 * Paths in a 24×24 box: a diagonal line with its two end points, and the four-arrow cross of
 * AutoCAD's MOVE.
 */
const ICON_PATHS: Record<EditorCommand, string> = {
    LINE: 'M6.5 17.5L17.5 6.5 M3 18h3v3H3z M18 3h3v3h-3z',
    MOVE: 'M12 3v18 M3 12h18 M9 6l3-3l3 3 M9 18l3 3l3-3 M6 9l-3 3l3 3 M18 9l3 3l-3 3',
};

/** Icon of a command's tool button, drawn in the text colour. */
export function ToolIcon({ command }: { command: EditorCommand }) {
    return (
        <svg className="tool-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICON_PATHS[command]} />
        </svg>
    );
}
