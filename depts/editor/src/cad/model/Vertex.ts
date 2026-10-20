import type { Id } from './Point';

/** Persistent point with its own identity; several elements may share it. */
export interface Vertex {
    id: Id;
    x: number;
    y: number;
}
