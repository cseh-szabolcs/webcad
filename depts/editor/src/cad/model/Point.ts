/** Lowercase RFC 4122 UUID, e.g. `01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42`. */
export type Id = string;

/** Display unit of a document. Model coordinates are always millimetres. */
export type Unit = 'mm' | 'cm' | 'm';

/** Absolute position in model space (mm, Y axis up). */
export interface Point {
    x: number;
    y: number;
}

/** Relative offset in model space (mm, Y axis up). */
export interface Vector2 {
    x: number;
    y: number;
}
