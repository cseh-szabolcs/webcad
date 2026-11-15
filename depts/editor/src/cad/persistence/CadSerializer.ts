import { CURRENT_SCHEMA_VERSION, type CadDocument } from '../model/CadDocument';
import { vertexRefs, type BaseElement, type CadElement } from '../model/CadElement';
import type { ElementStyle } from '../model/ElementStyle';
import type { Floor } from '../model/Floor';
import type { Group } from '../model/Group';
import { DEFAULT_LAYER_NAME, HEX_COLOR, isLineweight, LINETYPES, MAX_LAYER_TRANSPARENCY, type Layer, type Linetype } from '../model/Layer';
import type { Id, Unit, Vector2 } from '../model/Point';
import type { Vertex } from '../model/Vertex';

export class CadDocumentError extends Error {
    readonly path: string;

    constructor(path: string, message: string) {
        super(`${path}: ${message}`);
        this.name = 'CadDocumentError';
        this.path = path;
    }
}

const UNITS: readonly Unit[] = ['mm', 'cm', 'm'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function serializeDocument(doc: CadDocument): string {
    return JSON.stringify(doc);
}

/**
 * Parses and validates a document from a JSON string or an already decoded value.
 * Returns a fresh object containing only known properties.
 */
export function parseDocument(input: unknown): CadDocument {
    let data = input;
    if (typeof input === 'string') {
        try {
            data = JSON.parse(input);
        } catch (error) {
            throw new CadDocumentError('$', `invalid JSON (${(error as Error).message})`);
        }
    }

    const root = record(data, '$');
    const schemaVersion = number(root.schemaVersion, '$.schemaVersion');
    if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
        throw new CadDocumentError(
            '$.schemaVersion',
            `unsupported version ${schemaVersion}, expected ${CURRENT_SCHEMA_VERSION}`,
        );
    }

    const unit = string(root.unit, '$.unit');
    if (!UNITS.includes(unit as Unit)) {
        throw new CadDocumentError('$.unit', `unknown unit "${unit}"`);
    }

    const doc: CadDocument = {
        id: uuid(root.id, '$.id'),
        name: string(root.name, '$.name'),
        schemaVersion,
        unit: unit as Unit,
        vertices: list(root.vertices, '$.vertices', parseVertex),
        floors: list(root.floors, '$.floors', parseFloor),
        layers: list(root.layers, '$.layers', parseLayer),
        groups: list(root.groups, '$.groups', parseGroup),
        styles: list(root.styles, '$.styles', parseStyle),
        elements: list(root.elements, '$.elements', parseElement),
    };

    checkReferences(doc);
    return doc;
}

function parseVertex(value: unknown, path: string): Vertex {
    const r = record(value, path);
    return { id: uuid(r.id, `${path}.id`), x: number(r.x, `${path}.x`), y: number(r.y, `${path}.y`) };
}

function parseFloor(value: unknown, path: string): Floor {
    const r = record(value, path);
    return { id: uuid(r.id, `${path}.id`), name: string(r.name, `${path}.name`) };
}

function parseLayer(value: unknown, path: string): Layer {
    const r = record(value, path);
    const color = string(r.color, `${path}.color`);
    if (!HEX_COLOR.test(color)) {
        throw new CadDocumentError(`${path}.color`, `expected a colour like "#1f2937", got "${color}"`);
    }
    const linetype = string(r.linetype, `${path}.linetype`);
    if (!LINETYPES.includes(linetype as Linetype)) {
        throw new CadDocumentError(`${path}.linetype`, `unknown linetype "${linetype}"`);
    }
    const transparency = number(r.transparency, `${path}.transparency`);
    if (!Number.isInteger(transparency) || transparency < 0 || transparency > MAX_LAYER_TRANSPARENCY) {
        throw new CadDocumentError(`${path}.transparency`, `must be a whole number from 0 to ${MAX_LAYER_TRANSPARENCY}`);
    }
    const lineweight = number(r.lineweight, `${path}.lineweight`);
    if (!isLineweight(lineweight)) {
        throw new CadDocumentError(`${path}.lineweight`, `unknown lineweight ${lineweight}`);
    }
    return {
        id: uuid(r.id, `${path}.id`),
        floorId: string(r.floorId, `${path}.floorId`),
        name: string(r.name, `${path}.name`),
        visible: boolean(r.visible, `${path}.visible`),
        locked: boolean(r.locked, `${path}.locked`),
        color,
        linetype: linetype as Linetype,
        transparency,
        lineweight,
        description: string(r.description, `${path}.description`),
    };
}

function parseGroup(value: unknown, path: string): Group {
    const r = record(value, path);
    return { id: uuid(r.id, `${path}.id`), name: string(r.name, `${path}.name`) };
}

function parseStyle(value: unknown, path: string): ElementStyle {
    const r = record(value, path);
    return {
        id: uuid(r.id, `${path}.id`),
        name: string(r.name, `${path}.name`),
        strokeColor: string(r.strokeColor, `${path}.strokeColor`),
        strokeWidth: positive(r.strokeWidth, `${path}.strokeWidth`, true),
        dashPattern: list(r.dashPattern, `${path}.dashPattern`, (v, p) => positive(v, p, true)),
        fillColor: nullable(r.fillColor, `${path}.fillColor`, string),
    };
}

function parseElement(value: unknown, path: string): CadElement {
    const r = record(value, path);
    const base: BaseElement = {
        id: uuid(r.id, `${path}.id`),
        name: r.name === undefined ? null : nullable(r.name, `${path}.name`, string),
        layerId: string(r.layerId, `${path}.layerId`),
        groupId: nullable(r.groupId, `${path}.groupId`, string),
        styleId: nullable(r.styleId, `${path}.styleId`, string),
    };

    const type = string(r.type, `${path}.type`);
    switch (type) {
        case 'line':
            return {
                ...base,
                type,
                startVertexId: string(r.startVertexId, `${path}.startVertexId`),
                endVertexId: string(r.endVertexId, `${path}.endVertexId`),
            };
        case 'ellipse':
            return {
                ...base,
                type,
                centerVertexId: string(r.centerVertexId, `${path}.centerVertexId`),
                radiusX: positive(r.radiusX, `${path}.radiusX`),
                radiusY: positive(r.radiusY, `${path}.radiusY`),
                rotation: r.rotation === undefined ? 0 : number(r.rotation, `${path}.rotation`),
            };
        case 'circle':
            return {
                ...base,
                type,
                centerVertexId: string(r.centerVertexId, `${path}.centerVertexId`),
                radius: positive(r.radius, `${path}.radius`),
            };
        case 'arc':
            return {
                ...base,
                type,
                centerVertexId: string(r.centerVertexId, `${path}.centerVertexId`),
                startVertexId: string(r.startVertexId, `${path}.startVertexId`),
                endVertexId: string(r.endVertexId, `${path}.endVertexId`),
                clockwise: boolean(r.clockwise, `${path}.clockwise`),
            };
        case 'bezier':
            return {
                ...base,
                type,
                startVertexId: string(r.startVertexId, `${path}.startVertexId`),
                endVertexId: string(r.endVertexId, `${path}.endVertexId`),
                startControl: vector(r.startControl, `${path}.startControl`),
                endControl: vector(r.endControl, `${path}.endControl`),
            };
        case 'polyline': {
            const vertexIds = list(r.vertexIds, `${path}.vertexIds`, string);
            if (vertexIds.length < 2) {
                throw new CadDocumentError(`${path}.vertexIds`, 'needs at least 2 vertices');
            }
            const bulges = list(r.bulges, `${path}.bulges`, number);
            if (bulges.length !== vertexIds.length) {
                throw new CadDocumentError(`${path}.bulges`, 'needs one bulge per vertex');
            }
            return { ...base, type, vertexIds, closed: boolean(r.closed, `${path}.closed`), bulges };
        }
        default:
            throw new CadDocumentError(`${path}.type`, `unknown element type "${type}"`);
    }
}

function checkReferences(doc: CadDocument): void {
    const vertexIds = uniqueIds(doc.vertices, '$.vertices');
    const floorIds = uniqueIds(doc.floors, '$.floors');
    if (floorIds.size === 0) {
        throw new CadDocumentError('$.floors', 'needs at least one floor');
    }
    const layerIds = uniqueIds(doc.layers, '$.layers');
    /** Per floor, the layer names in lower case. */
    const names = new Map<Id, Set<string>>();
    doc.layers.forEach((layer, i) => {
        const path = `$.layers[${i}]`;
        ref(layer.floorId, floorIds, `${path}.floorId`, 'floor');
        const taken = names.get(layer.floorId) ?? new Set();
        names.set(layer.floorId, taken);
        if (taken.has(layer.name.toLowerCase())) {
            throw new CadDocumentError(`${path}.name`, `duplicate layer name "${layer.name}"`);
        }
        taken.add(layer.name.toLowerCase());
    });
    doc.floors.forEach((floor, i) => {
        if (!names.get(floor.id)?.has(DEFAULT_LAYER_NAME)) {
            throw new CadDocumentError(`$.floors[${i}]`, `has no layer "${DEFAULT_LAYER_NAME}"`);
        }
    });
    const groupIds = uniqueIds(doc.groups, '$.groups');
    const styleIds = uniqueIds(doc.styles, '$.styles');
    uniqueIds(doc.elements, '$.elements');

    doc.elements.forEach((element, i) => {
        const path = `$.elements[${i}]`;
        ref(element.layerId, layerIds, `${path}.layerId`, 'layer');
        ref(element.groupId, groupIds, `${path}.groupId`, 'group');
        ref(element.styleId, styleIds, `${path}.styleId`, 'style');
        for (const id of vertexRefs(element)) {
            ref(id, vertexIds, path, 'vertex');
        }
    });
}

function uniqueIds(items: { id: Id }[], path: string): Set<Id> {
    const ids = new Set<Id>();
    items.forEach((item, i) => {
        if (ids.has(item.id)) {
            throw new CadDocumentError(`${path}[${i}].id`, `duplicate id "${item.id}"`);
        }
        ids.add(item.id);
    });
    return ids;
}

function ref(id: Id | null, known: Set<Id>, path: string, kind: string): void {
    if (id !== null && !known.has(id)) {
        throw new CadDocumentError(path, `unknown ${kind} "${id}"`);
    }
}

function record(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new CadDocumentError(path, 'expected an object');
    }
    return value as Record<string, unknown>;
}

function list<T>(value: unknown, path: string, item: (value: unknown, path: string) => T): T[] {
    if (!Array.isArray(value)) {
        throw new CadDocumentError(path, 'expected an array');
    }
    return value.map((v, i) => item(v, `${path}[${i}]`));
}

function string(value: unknown, path: string): string {
    if (typeof value !== 'string') {
        throw new CadDocumentError(path, 'expected a string');
    }
    return value;
}

function uuid(value: unknown, path: string): Id {
    const id = string(value, path);
    if (!UUID.test(id)) {
        throw new CadDocumentError(path, `expected a lowercase UUID, got "${id}"`);
    }
    return id;
}

function number(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new CadDocumentError(path, 'expected a finite number');
    }
    return value;
}

function positive(value: unknown, path: string, allowZero = false): number {
    const n = number(value, path);
    if (allowZero ? n < 0 : n <= 0) {
        throw new CadDocumentError(path, allowZero ? 'must not be negative' : 'must be positive');
    }
    return n;
}

function boolean(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean') {
        throw new CadDocumentError(path, 'expected a boolean');
    }
    return value;
}

function vector(value: unknown, path: string): Vector2 {
    const r = record(value, path);
    return { x: number(r.x, `${path}.x`), y: number(r.y, `${path}.y`) };
}

function nullable<T>(value: unknown, path: string, parse: (value: unknown, path: string) => T): T | null {
    return value === null ? null : parse(value, path);
}
