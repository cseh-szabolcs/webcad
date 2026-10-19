import type { CadElement } from './CadElement';
import type { ElementStyle } from './ElementStyle';
import type { Group } from './Group';
import type { Layer } from './Layer';
import type { Id, Unit } from './Point';
import type { Vertex } from './Vertex';

export const CURRENT_SCHEMA_VERSION = 1;

/** The persisted CAD document, independent of Paper.js, React and editor tools. */
export interface CadDocument {
    id: Id;
    name: string;
    schemaVersion: number;
    unit: Unit;
    vertices: Vertex[];
    elements: CadElement[];
    layers: Layer[];
    groups: Group[];
    styles: ElementStyle[];
}
