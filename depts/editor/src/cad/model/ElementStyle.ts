import type { Id } from './Point';

/**
 * Stroke width and dash pattern are currently rendered in screen pixels.
 * Model vs. paper units for printing are still undecided.
 */
export interface ElementStyle {
    id: Id;
    name: string;
    strokeColor: string;
    strokeWidth: number;
    dashPattern: number[];
    fillColor: string | null;
}
