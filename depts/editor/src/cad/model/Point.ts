import type { ApiSchema } from 'app/api/types';

/** Lowercase RFC 4122 UUID, e.g. `01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42`. */
export type Id = string;

export type Unit = ApiSchema['PlanUnit'];

/** Absolute position in model space (mm, Y axis up). Editor only: the document stores vertices. */
export interface Point {
    x: number;
    y: number;
}

export type Vector2 = ApiSchema['Vector2'];
