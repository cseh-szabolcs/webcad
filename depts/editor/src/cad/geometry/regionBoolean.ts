import type { Point } from '../model/Point';
import { circleIntersections, segmentCircleIntersections, segmentIntersections } from './intersect';
import { bulgeArc, polylineSegments } from './polyline';

const TAU = 2 * Math.PI;
/** Distance (mm) within which two points are the same point. */
const POINT_TOLERANCE = 1e-6;
/** How far beside an edge its two sides are probed (mm); short edges are probed nearer. */
const PROBE_DISTANCE = 1e-4;
/** Area (mm²) up to which an outline counts as none. */
const MIN_AREA = 1e-9;

/**
 * A closed outline that bounds an area: a polygon of straight and arc segments (`bulges` as in
 * a polyline element, one per point for the segment to the next, the last back to the first; at
 * least three points), or a circle.
 */
export type ClosedShape =
    | { kind: 'polyline'; points: readonly Point[]; bulges: readonly number[] }
    | { kind: 'circle'; center: Point; radius: number };

/** A straight or arc piece of an outline, with ids of its end points (see pointRegistry). */
interface Edge {
    from: Point;
    to: Point;
    fromId: number;
    toId: number;
    /** The circle of an arc; null for a straight edge. */
    center: Point | null;
    radius: number;
    startAngle: number;
    /** Signed angle of an arc, negative for clockwise. */
    sweep: number;
    /** The bulge as given, as long as the edge is a whole segment of the input; null once it is a piece or a join. */
    bulge: number | null;
    /** The segment of the input it is a piece of; the two halves of a circle are one. */
    source: number;
    /** Index of its shape among all given. */
    shape: number;
}

/**
 * What is left of the area of `minuends` (taken together) once the area of `subtrahends` is
 * taken out, like AutoCAD's SUBTRACT on regions: the outlines of the remaining pieces, counter-
 * clockwise, and of the holes in them, clockwise. Segments and circular arcs stay exact. An
 * outline nothing touches keeps its points in their order.
 */
export function subtractShapes(minuends: readonly ClosedShape[], subtrahends: readonly ClosedShape[]): ClosedShape[] {
    const registry = pointRegistry();
    let sources = 0;
    const shapes = [...minuends, ...subtrahends].map((shape, index) => shapeEdges(shape, index, registry, () => sources++));
    const kept = shapes.slice(0, minuends.length);
    const removed = shapes.slice(minuends.length);
    const remains = (p: Point) => kept.some((edges) => contains(edges, p)) && !removed.some((edges) => contains(edges, p));

    const boundary: Edge[] = [];
    for (const piece of uniquePieces(splitEdges(shapes.flat(), registry), registry)) {
        const middle = pointAt(piece, 0.5);
        const direction = directionAt(piece, 0.5);
        const reach = Math.min(PROBE_DISTANCE, Math.hypot(piece.to.x - piece.from.x, piece.to.y - piece.from.y) / 100);
        const dx = -Math.sin(direction) * reach;
        const dy = Math.cos(direction) * reach;
        const left = remains({ x: middle.x + dx, y: middle.y + dy });
        const right = remains({ x: middle.x - dx, y: middle.y - dy });
        if (left !== right) {
            // The area lies to the left of its outline
            boundary.push(left ? piece : reversed(piece));
        }
    }
    return traceLoops(boundary)
        .map(loopShape)
        .filter((shape): shape is ClosedShape => shape !== null && Math.abs(closedShapeArea(shape)) > MIN_AREA);
}

/**
 * The area of all `shapes` taken together, like AutoCAD's UNION on regions: the outlines of its
 * pieces and of the holes they leave between them (see subtractShapes).
 */
export function unionShapes(shapes: readonly ClosedShape[]): ClosedShape[] {
    return subtractShapes(shapes, []);
}

/** The area of a shape: positive for a circle and a counter-clockwise polygon, negative for a clockwise one. */
export function closedShapeArea(shape: ClosedShape): number {
    if (shape.kind === 'circle') {
        return Math.PI * shape.radius ** 2;
    }
    let area = 0;
    for (const segment of polylineSegments(shape.points, shape.bulges, true)) {
        area += (segment.from.x * segment.to.y - segment.to.x * segment.from.y) / 2;
        const arc = bulgeArc(segment);
        if (arc) {
            // Between chord and arc; odd in the sweep, so a clockwise arc takes it away
            area += (arc.radius ** 2 * (arc.sweep - Math.sin(arc.sweep))) / 2;
        }
    }
    return area;
}

/** Gives points within the tolerance of each other one id and one position, the first seen. */
function pointRegistry() {
    const points: Point[] = [];
    const cells = new Map<string, number[]>();
    const cell = (value: number) => Math.round(value / POINT_TOLERANCE);
    return {
        id(p: Point): number {
            const cx = cell(p.x);
            const cy = cell(p.y);
            for (let x = cx - 1; x <= cx + 1; x++) {
                for (let y = cy - 1; y <= cy + 1; y++) {
                    const found = cells.get(`${x},${y}`)?.find((id) => distance(points[id], p) <= POINT_TOLERANCE);
                    if (found !== undefined) {
                        return found;
                    }
                }
            }
            const id = points.push(p) - 1;
            cells.set(`${cx},${cy}`, [...(cells.get(`${cx},${cy}`) ?? []), id]);
            return id;
        },
        point: (id: number): Point => points[id],
    };
}

type PointRegistry = ReturnType<typeof pointRegistry>;

/** The edges of a shape, without those of no length; a circle as its two halves. */
function shapeEdges(shape: ClosedShape, index: number, registry: PointRegistry, newSource: () => number): Edge[] {
    if (shape.kind === 'circle') {
        const { center, radius } = shape;
        const east = registry.id({ x: center.x + radius, y: center.y });
        const west = registry.id({ x: center.x - radius, y: center.y });
        const source = newSource();
        const half = (fromId: number, toId: number, startAngle: number): Edge => ({
            from: registry.point(fromId),
            to: registry.point(toId),
            fromId,
            toId,
            center,
            radius,
            startAngle,
            sweep: Math.PI,
            bulge: 1,
            source,
            shape: index,
        });
        return radius > POINT_TOLERANCE ? [half(east, west, 0), half(west, east, Math.PI)] : [];
    }
    const edges: Edge[] = [];
    for (const segment of polylineSegments(shape.points, shape.bulges, true)) {
        const fromId = registry.id(segment.from);
        const toId = registry.id(segment.to);
        if (fromId === toId) {
            continue;
        }
        const arc = bulgeArc(segment);
        edges.push({
            from: registry.point(fromId),
            to: registry.point(toId),
            fromId,
            toId,
            center: arc?.center ?? null,
            radius: arc?.radius ?? 0,
            startAngle: arc?.startAngle ?? 0,
            sweep: arc?.sweep ?? 0,
            bulge: arc ? segment.bulge : 0,
            source: newSource(),
            shape: index,
        });
    }
    return edges;
}

function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The point of an edge at t ∈ [0, 1]. */
function pointAt(edge: Edge, t: number): Point {
    if (edge.center === null) {
        return { x: edge.from.x + (edge.to.x - edge.from.x) * t, y: edge.from.y + (edge.to.y - edge.from.y) * t };
    }
    const angle = edge.startAngle + edge.sweep * t;
    return { x: edge.center.x + edge.radius * Math.cos(angle), y: edge.center.y + edge.radius * Math.sin(angle) };
}

/** The direction of travel (radians from +X) of an edge at t ∈ [0, 1]. */
function directionAt(edge: Edge, t: number): number {
    return edge.center === null
        ? Math.atan2(edge.to.y - edge.from.y, edge.to.x - edge.from.x)
        : edge.startAngle + edge.sweep * t + Math.sign(edge.sweep) * (Math.PI / 2);
}

/** The parameter of the point of an edge nearest to `p`. */
function nearestParam(edge: Edge, p: Point): number {
    if (edge.center === null) {
        const dx = edge.to.x - edge.from.x;
        const dy = edge.to.y - edge.from.y;
        const t = ((p.x - edge.from.x) * dx + (p.y - edge.from.y) * dy) / (dx * dx + dy * dy);
        return Math.min(Math.max(t, 0), 1);
    }
    const angle = Math.atan2(p.y - edge.center.y, p.x - edge.center.x);
    const offset = edge.sweep >= 0 ? angle - edge.startAngle : edge.startAngle - angle;
    const along = ((offset % TAU) + TAU) % TAU;
    const span = Math.abs(edge.sweep);
    if (along <= span) {
        return along / span;
    }
    // Off the arc: its nearer end
    return along - span < TAU - along ? 1 : 0;
}

/** The parameter of `p` on an edge, or null if it does not lie on it. */
function paramOn(edge: Edge, p: Point): number | null {
    const t = nearestParam(edge, p);
    return distance(pointAt(edge, t), p) <= POINT_TOLERANCE ? t : null;
}

interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/** Bounds of an edge; of an arc those of its whole circle. */
function edgeBounds(edge: Edge): Bounds {
    if (edge.center !== null) {
        const { center, radius } = edge;
        return { minX: center.x - radius, minY: center.y - radius, maxX: center.x + radius, maxY: center.y + radius };
    }
    return {
        minX: Math.min(edge.from.x, edge.to.x),
        minY: Math.min(edge.from.y, edge.to.y),
        maxX: Math.max(edge.from.x, edge.to.x),
        maxY: Math.max(edge.from.y, edge.to.y),
    };
}

function boundsTouch(a: Bounds, b: Bounds): boolean {
    const margin = POINT_TOLERANCE;
    return a.minX <= b.maxX + margin && b.minX <= a.maxX + margin && a.minY <= b.maxY + margin && b.minY <= a.maxY + margin;
}

/** Where two edges cross or touch; edges along each other give none (their ends cut them, see splitEdges). */
function crossings(a: Edge, b: Edge): Point[] {
    if (a.center === null && b.center === null) {
        return segmentIntersections(a.from, a.to, b.from, b.to);
    }
    if (a.center === null) {
        return segmentCircleIntersections(a.from, a.to, b.center!, b.radius).filter((p) => onArc(b, p));
    }
    if (b.center === null) {
        return segmentCircleIntersections(b.from, b.to, a.center, a.radius).filter((p) => onArc(a, p));
    }
    return circleIntersections(a.center, a.radius, b.center, b.radius).filter((p) => onArc(a, p) && onArc(b, p));
}

/** A point of the arc's circle lies on the arc itself. */
function onArc(arc: Edge, p: Point): boolean {
    return distance(pointAt(arc, nearestParam(arc, p)), p) <= Math.max(POINT_TOLERANCE, 1e-9 * arc.radius);
}

/**
 * Cuts the edges where they cross or touch each other and where an end of one lies on another,
 * so that afterwards two pieces either coincide or meet only at their ends.
 */
function splitEdges(edges: readonly Edge[], registry: PointRegistry): Edge[] {
    const bounds = edges.map(edgeBounds);
    const cuts: { t: number; id: number }[][] = edges.map(() => []);
    const cutOn = (i: number, p: Point, t: number | null) => {
        if (t !== null) {
            cuts[i].push({ t, id: registry.id(p) });
        }
    };
    for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
            if (!boundsTouch(bounds[i], bounds[j])) {
                continue;
            }
            const a = edges[i];
            const b = edges[j];
            for (const p of crossings(a, b)) {
                cutOn(i, p, nearestParam(a, p));
                cutOn(j, p, nearestParam(b, p));
            }
            for (const p of [b.from, b.to]) {
                cutOn(i, p, paramOn(a, p));
            }
            for (const p of [a.from, a.to]) {
                cutOn(j, p, paramOn(b, p));
            }
        }
    }
    return edges.flatMap((edge, i) => {
        const pieces: Edge[] = [];
        let last = { t: 0, id: edge.fromId };
        for (const stop of [...cuts[i].sort((a, b) => a.t - b.t), { t: 1, id: edge.toId }]) {
            const inside = stop.t < 1 && (stop.id === edge.fromId || stop.id === edge.toId);
            if (stop.id === last.id || inside) {
                continue;
            }
            pieces.push({
                ...edge,
                from: registry.point(last.id),
                to: registry.point(stop.id),
                fromId: last.id,
                toId: stop.id,
                startAngle: edge.startAngle + edge.sweep * last.t,
                sweep: edge.sweep * (stop.t - last.t),
                bulge: last.t === 0 && stop.t === 1 ? edge.bulge : null,
            });
            last = stop;
        }
        return pieces;
    });
}

/** The pieces without those that coincide with an earlier one, in either direction. */
function uniquePieces(pieces: readonly Edge[], registry: PointRegistry): Edge[] {
    const seen = new Set<string>();
    return pieces.filter((piece) => {
        const ends = [piece.fromId, piece.toId].sort((a, b) => a - b);
        const key = `${ends[0]}:${ends[1]}:${registry.id(pointAt(piece, 0.5))}`;
        const fresh = !seen.has(key);
        seen.add(key);
        return fresh;
    });
}

function reversed(edge: Edge): Edge {
    return {
        ...edge,
        from: edge.to,
        to: edge.from,
        fromId: edge.toId,
        toId: edge.fromId,
        startAngle: edge.startAngle + edge.sweep,
        sweep: -edge.sweep,
        bulge: edge.bulge === null ? null : -edge.bulge,
    };
}

/** Whether the outline of these edges goes around `p`, by its winding number; `p` is not on the outline. */
function contains(edges: readonly Edge[], p: Point): boolean {
    let angle = 0;
    for (const edge of edges) {
        const ax = edge.from.x - p.x;
        const ay = edge.from.y - p.y;
        const bx = edge.to.x - p.x;
        const by = edge.to.y - p.y;
        // Positive where `p` is to the left of the chord
        const side = ax * by - ay * bx;
        const along = ax * bx + ay * by;
        if (edge.center === null) {
            angle += Math.atan2(side, along);
        } else if (side === 0 && along < 0) {
            // On the chord, between its ends: half a turn, as seen from the side away from the arc
            angle += Math.sign(edge.sweep) * Math.PI;
        } else {
            // The chord, and a full turn between it and its arc, which lies to the right of a counter-clockwise chord
            const within = distance(edge.center, p) < edge.radius && side * edge.sweep < 0;
            angle += Math.atan2(side, along) + (within ? Math.sign(edge.sweep) * TAU : 0);
        }
    }
    return Math.abs(angle) > Math.PI;
}

/**
 * Joins directed edges to closed loops, starting with the first edge not used yet. Where
 * several go on from a point (outlines touching there), the one next to the arriving edge
 * clockwise is taken, which bounds the same area. A chain that does not close is dropped.
 */
function traceLoops(edges: readonly Edge[]): Edge[][] {
    const outgoing = new Map<number, number[]>();
    edges.forEach((edge, i) => outgoing.set(edge.fromId, [...(outgoing.get(edge.fromId) ?? []), i]));
    const used = new Set<number>();
    const loops: Edge[][] = [];
    for (let start = 0; start < edges.length; start++) {
        if (used.has(start)) {
            continue;
        }
        const loop: Edge[] = [];
        let current: number | undefined = start;
        while (current !== undefined && !used.has(current)) {
            used.add(current);
            loop.push(edges[current]);
            current = nextEdge(edges, outgoing, used, start, current);
        }
        // Back at its first edge
        if (current === start) {
            loops.push(loop);
        }
    }
    return loops;
}

/** The edge that goes on from the end of edge `current`: the start of the loop again, or one not used yet. */
function nextEdge(
    edges: readonly Edge[],
    outgoing: ReadonlyMap<number, readonly number[]>,
    used: ReadonlySet<number>,
    start: number,
    current: number,
): number | undefined {
    const arriving = edges[current];
    const back = directionAt(arriving, 1) + Math.PI;
    let next: number | undefined;
    let least = Infinity;
    for (const candidate of outgoing.get(arriving.toId) ?? []) {
        if (candidate !== start && used.has(candidate)) {
            continue;
        }
        const turn = (((back - directionAt(edges[candidate], 0)) % TAU) + TAU) % TAU;
        // Straight back along the arriving edge comes last
        const clockwise = turn < 1e-9 ? TAU : turn;
        if (clockwise < least) {
            least = clockwise;
            next = candidate;
        }
    }
    return next;
}

/** Whether `next` goes on along the line or circle of `edge` and the point between them can go. */
function continues(edge: Edge, next: Edge): boolean {
    // A vertex of an outline stays one
    if (edge.shape === next.shape && edge.source !== next.source) {
        return false;
    }
    if (edge.center === null || next.center === null) {
        if (edge.center !== null || next.center !== null) {
            return false;
        }
        const ax = edge.to.x - edge.from.x;
        const ay = edge.to.y - edge.from.y;
        const bx = next.to.x - next.from.x;
        const by = next.to.y - next.from.y;
        return ax * bx + ay * by > 0 && Math.abs(ax * by - ay * bx) <= 1e-9 * Math.hypot(ax, ay) * Math.hypot(bx, by);
    }
    return sameCircle(edge, next) && Math.abs(edge.sweep + next.sweep) < TAU - 1e-9;
}

/** Both are arcs of one circle in one direction. */
function sameCircle(a: Edge, b: Edge): boolean {
    return (
        a.center !== null &&
        b.center !== null &&
        distance(a.center, b.center) <= POINT_TOLERANCE &&
        Math.abs(a.radius - b.radius) <= POINT_TOLERANCE &&
        a.sweep * b.sweep > 0
    );
}

/** The shape of a loop, its edges joined where they continue each other; null if it bounds no area. */
function loopShape(loop: readonly Edge[]): ClosedShape | null {
    const first = loop[0];
    const turned = loop.reduce((sum, edge) => sum + edge.sweep, 0);
    if (first.center !== null && loop.every((edge) => sameCircle(edge, first)) && Math.abs(turned) >= TAU - 1e-9) {
        return { kind: 'circle', center: first.center, radius: first.radius };
    }
    const count = loop.length;
    const startAt = loop.findIndex((edge, i) => !continues(loop[(i + count - 1) % count], edge));
    if (startAt < 0) {
        return null;
    }
    const joined: Edge[] = [];
    for (let k = 0; k < count; k++) {
        const edge = loop[(startAt + k) % count];
        const last = joined.at(-1);
        if (last && continues(last, edge)) {
            joined[joined.length - 1] = {
                ...edge,
                from: last.from,
                fromId: last.fromId,
                startAngle: last.startAngle,
                sweep: last.sweep + edge.sweep,
                bulge: null,
            };
        } else {
            joined.push(edge);
        }
    }
    if (joined.length === 2) {
        // A closed polyline needs three points: one more in the middle of an arc
        const at = joined.findIndex((edge) => edge.center !== null);
        if (at < 0) {
            return null;
        }
        const arc = joined[at];
        const middle = pointAt(arc, 0.5);
        joined.splice(
            at,
            1,
            { ...arc, to: middle, sweep: arc.sweep / 2, bulge: null },
            { ...arc, from: middle, startAngle: arc.startAngle + arc.sweep / 2, sweep: arc.sweep / 2, bulge: null },
        );
    }
    if (joined.length < 3) {
        return null;
    }
    return {
        kind: 'polyline',
        points: joined.map((edge) => edge.from),
        bulges: joined.map((edge) => (edge.center === null ? 0 : (edge.bulge ?? Math.tan(edge.sweep / 4)))),
    };
}
