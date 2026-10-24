import type { Id, Vector2 } from './Point';

export interface BaseElement {
    id: Id;
    /** Optional display name, e.g. "Door swing"; the id stays the identity. */
    name?: string;
    layerId: Id | null;
    groupId: Id | null;
    styleId: Id | null;
}

export interface LineElement extends BaseElement {
    type: 'line';
    startVertexId: Id;
    endVertexId: Id;
}

/** Axis-aligned ellipse. */
export interface EllipseElement extends BaseElement {
    type: 'ellipse';
    centerVertexId: Id;
    radiusX: number;
    radiusY: number;
}

export interface CircleElement extends BaseElement {
    type: 'circle';
    centerVertexId: Id;
    radius: number;
}

/**
 * Circular arc around a centre. The radius is the distance from centre to start; the end
 * vertex only sets the end angle, so it may lie off the arc. Y up: `clockwise: false` is
 * counter-clockwise on screen.
 */
export interface ArcElement extends BaseElement {
    type: 'arc';
    centerVertexId: Id;
    startVertexId: Id;
    endVertexId: Id;
    clockwise: boolean;
}

/** Control vectors are relative to their end vertex, so they move with it. */
export interface CubicBezierElement extends BaseElement {
    type: 'bezier';
    startVertexId: Id;
    endVertexId: Id;
    startControl: Vector2;
    endControl: Vector2;
}

export interface PolylineElement extends BaseElement {
    type: 'polyline';
    vertexIds: Id[];
    closed: boolean;
}

export type CadElement =
    | LineElement
    | EllipseElement
    | CircleElement
    | ArcElement
    | CubicBezierElement
    | PolylineElement;

export type CadElementType = CadElement['type'];

/** Ids of all vertices an element references. */
export function vertexRefs(element: CadElement): Id[] {
    switch (element.type) {
        case 'line':
        case 'bezier':
            return [element.startVertexId, element.endVertexId];
        case 'ellipse':
        case 'circle':
            return [element.centerVertexId];
        case 'arc':
            return [element.centerVertexId, element.startVertexId, element.endVertexId];
        case 'polyline':
            return element.vertexIds;
    }
}

/** The element with its vertex references replaced where `replace` maps them; others kept. */
export function withVertexRefs(element: CadElement, replace: ReadonlyMap<Id, Id>): CadElement {
    const r = (id: Id) => replace.get(id) ?? id;
    switch (element.type) {
        case 'line':
        case 'bezier':
            return { ...element, startVertexId: r(element.startVertexId), endVertexId: r(element.endVertexId) };
        case 'ellipse':
        case 'circle':
            return { ...element, centerVertexId: r(element.centerVertexId) };
        case 'arc':
            return {
                ...element,
                centerVertexId: r(element.centerVertexId),
                startVertexId: r(element.startVertexId),
                endVertexId: r(element.endVertexId),
            };
        case 'polyline':
            return { ...element, vertexIds: element.vertexIds.map(r) };
    }
}
