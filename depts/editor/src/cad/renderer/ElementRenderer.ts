import type { CadElement } from '../model/CadElement';
import type { DocumentIndex } from '../model/DocumentIndex';
import type { ElementStyle } from '../model/ElementStyle';
import { displayFillColor, displayStrokeColor, type DisplayTheme } from './displayColor';
import { buildPathSpec } from './PathSpec';

/** Used for elements without a style. */
export const DEFAULT_STYLE: ElementStyle = {
    id: '__default',
    name: 'Default',
    strokeColor: '#000000',
    strokeWidth: 1,
    dashPattern: [],
    fillColor: null,
};

export function createItem(
    scope: paper.PaperScope,
    element: CadElement,
    index: DocumentIndex,
    theme: DisplayTheme,
): paper.Path {
    const path = new scope.Path({ insert: false });
    path.strokeScaling = false;
    updateItem(scope, path, element, index, theme);
    return path;
}

/** Rebuilds geometry and style of an existing item in place. */
export function updateItem(
    scope: paper.PaperScope,
    path: paper.Path,
    element: CadElement,
    index: DocumentIndex,
    theme: DisplayTheme,
): void {
    const spec = buildPathSpec(element, index);
    path.removeSegments();
    path.addSegments(
        spec.segments.map(
            (s) =>
                new scope.Segment(
                    new scope.Point(s.point.x, s.point.y),
                    s.handleIn ? new scope.Point(s.handleIn.x, s.handleIn.y) : undefined,
                    s.handleOut ? new scope.Point(s.handleOut.x, s.handleOut.y) : undefined,
                ),
        ),
    );
    path.closed = spec.closed;

    applyStyle(scope, path, styleOf(element, index), theme);
}

export function styleOf(element: CadElement, index: DocumentIndex): ElementStyle {
    return (element.styleId !== null && index.styles.get(element.styleId)) || DEFAULT_STYLE;
}

/** Colours are adapted to the background (see displayColor.ts); widths and dashes are not. */
export function applyStyle(scope: paper.PaperScope, path: paper.Path, style: ElementStyle, theme: DisplayTheme): void {
    path.strokeColor = new scope.Color(displayStrokeColor(style.strokeColor, theme));
    path.strokeWidth = style.strokeWidth;
    path.dashArray = style.dashPattern;
    path.fillColor = style.fillColor === null ? null : new scope.Color(displayFillColor(style.fillColor, theme));
}
