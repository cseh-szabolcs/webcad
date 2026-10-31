import { CURRENT_SCHEMA_VERSION, type CadDocument } from '../model/CadDocument';
import { vertexRefs, type BaseElement, type CadElement } from '../model/CadElement';
import type { ElementStyle } from '../model/ElementStyle';
import type { Group } from '../model/Group';
import type { Layer } from '../model/Layer';
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

function parseLayer(value: unknown, path: string): Layer {
    const r = record(value, path);
    return {
        id: uuid(r.id, `${path}.id`),
        name: string(r.name, `${path}.name`),
        visible: boolean(r.visible, `${path}.visible`),
        locked: boolean(r.locked, `${path}.locked`),
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
        layerId: nullable(r.layerId, `${path}.layerId`, string),
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
            return { ...base, type, vertexIds, closed: boolean(r.closed, `${path}.closed`) };
        }
        default:
            throw new CadDocumentError(`${path}.type`, `unknown element type "${type}"`);
    }
}

function checkReferences(doc: CadDocument): void {
    const vertexIds = uniqueIds(doc.vertices, '$.vertices');
    const layerIds = uniqueIds(doc.layers, '$.layers');
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
