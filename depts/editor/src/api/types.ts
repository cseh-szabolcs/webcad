import type { components } from './schema';

/**
 * Every model of the generated API schema, named by its schema name: `ApiSchema['PlanDocument']`,
 * so the name in the code is the name in the published schema. Only `cad/model` aliases the
 * models of the stored document under the editor's names (`CadDocument`, `CadElement`, …).
 */
export type ApiSchema = components['schemas'];
