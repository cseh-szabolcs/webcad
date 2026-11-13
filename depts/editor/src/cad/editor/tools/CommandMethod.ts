import type { ArcMethod } from './ArcTool';
import type { CircleMethod } from './CircleTool';
import type { EllipseMethod } from './EllipseTool';

/**
 * A way a command draws that its tool button offers: the command then asks that way straight
 * away, as its options would. Each belongs to one command (see the tool).
 */
export type CommandMethod = ArcMethod | CircleMethod | EllipseMethod;
