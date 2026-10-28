import type { components } from './schema';

/**
 * Every model of the generated API schema, named by its schema name: `ApiSchema['PlanDocument']`
 * rather than an alias per model, so the name in the code is the name in the published schema.
 */
export type ApiSchema = components['schemas'];
