import type { Id } from './Point';

export interface Layer {
    id: Id;
    name: string;
    visible: boolean;
    locked: boolean;
}
