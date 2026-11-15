import type { CadElement } from '../model/CadElement';
import type { DocumentIndex } from '../model/DocumentIndex';
import { displayFillColor, displayStrokeColor, type DisplayTheme } from './displayColor';
import { elementDisplay, type DisplayStyle, type ElementDisplay } from './elementDisplay';
import { buildPathSpec } from './PathSpec';

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

    applyDisplay(scope, path, elementDisplay(element, index), theme);
}

/** Style and opacity of an element (see elementDisplay). */
export function applyDisplay(scope: paper.PaperScope, path: paper.Path, display: ElementDisplay, theme: DisplayTheme): void {
    applyStyle(scope, path, display.style, theme);
    path.opacity = display.opacity;
}

/** Colours are adapted to the background (see displayColor.ts); widths and dashes are not. */
export function applyStyle(scope: paper.PaperScope, path: paper.Path, style: DisplayStyle, theme: DisplayTheme): void {
    path.strokeColor = new scope.Color(displayStrokeColor(style.strokeColor, theme));
    path.strokeWidth = style.strokeWidth;
    path.dashArray = style.dashPattern;
    path.fillColor = style.fillColor === null ? null : new scope.Color(displayFillColor(style.fillColor, theme));
}
