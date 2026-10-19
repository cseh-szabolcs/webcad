import type { Id } from './Point';

/** Membership is stored on the element (`groupId`), not duplicated here. */
export interface Group {
    id: Id;
    name: string;
}
