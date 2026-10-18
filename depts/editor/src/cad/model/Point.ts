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
