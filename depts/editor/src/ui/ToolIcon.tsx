import type { EditorCommand } from 'app/cad/editor/commandNames';
import type { ArcMethod } from 'app/cad/editor/tools/ArcTool';

/**
 * Paths in a 24×24 box: a diagonal line with its two end points, a zigzag of three segments
 * with its two end points, a circle with its centre, an ellipse turned by 30°, a rectangle, and
 * the four-arrow cross of AutoCAD's MOVE.
 */
const ICON_PATHS: Record<Exclude<EditorCommand, 'ARC'>, string> = {
    LINE: 'M6.5 17.5L17.5 6.5 M3 18h3v3H3z M18 3h3v3h-3z',
    PLINE: 'M4.5 18L9 8l6 8l4.5-10 M3 18h3v3H3z M18 3h3v3h-3z',
    CIRCLE: 'M20 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0z M11 11h2v2h-2z',
    ELLIPSE: 'M19.79 7.5a9 5 -30 1 1-15.58 9a9 5 -30 1 1 15.58-9z',
    RECTANG: 'M3.5 6.5h17v11h-17z',
    MOVE: 'M12 3v18 M3 12h18 M9 6l3-3l3 3 M9 18l3 3l3-3 M6 9l-3 3l3 3 M18 9l3 3l-3 3',
};

/**
 * BOGEN has an icon per method: an arc with its three points, a quarter arc with its start,
 * its end and its centre, and one with its start, its centre and the angle between its radii.
 */
const ARC_ICON_PATHS: Record<ArcMethod, string> = {
    threePoints:
        'M3.84 16.07A8.34 8.34 0 0 1 9.98 6.25 M14.02 6.25A8.34 8.34 0 0 1 20.16 16.07 M3 16.5h3v3H3z M10.5 4.5h3v3h-3z M18 16.5h3v3h-3z',
    startCenterEnd: 'M19.35 16A13.5 13.5 0 0 0 8 4.65 M18 16.5h3v3h-3z M4.5 3h3v3h-3z M4.5 16.5h3v3h-3z',
    startCenterAngle:
        'M19.35 16A13.5 13.5 0 0 0 6 4.5V16.5 M7.5 18H18 M11.5 18A5.5 5.5 0 0 0 6 12.5 M18 16.5h3v3h-3z M4.5 16.5h3v3h-3z',
};

/** Icon of a command's tool button (of BOGEN's method, by default its first), drawn in the text colour. */
export function ToolIcon({ command, method = 'threePoints' }: { command: EditorCommand; method?: ArcMethod }) {
    return (
        <svg className="tool-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d={command === 'ARC' ? ARC_ICON_PATHS[method] : ICON_PATHS[command]} />
        </svg>
    );
}
