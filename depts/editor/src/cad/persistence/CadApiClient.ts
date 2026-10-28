import type { ApiSchema } from 'app/api/types';
import type { CadDocument } from '../model/CadDocument';
import type { Id } from '../model/Point';
import { parseDocument } from './CadSerializer';

/** The API sends `name: null` where the editor's model leaves the name out. */
type ReceivedElement<E> = E extends unknown ? Omit<E, 'name'> & { name?: Exclude<E[keyof E & 'name'], null> } : never;

/** A plan document from the API with the editor's spelling of a missing name. */
type ReceivedDocument = Omit<ApiSchema['PlanDocument'], 'elements'> & {
    elements: ReceivedElement<ApiSchema['Element']>[];
};

type Assert<T extends true> = T;

/**
 * Fails to compile ("Type 'false' does not satisfy the constraint 'true'") when the generated API
 * types no longer fit the editor's document model, e.g. after the backend renamed or retyped a
 * property. `parseDocument` still checks the values at runtime.
 */
export type ApiDocumentFitsModel = Assert<[ReceivedDocument] extends [CadDocument] ? true : false>;

export class CadApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'CadApiError';
        this.status = status;
    }
}

export interface LoadedPlanDocument {
    document: CadDocument;
    /** Server revision from the ETag header, used for conflict detection when saving. */
    revision: string | null;
}

export class CadApiClient {
    private readonly baseUrl: string;
    private readonly fetchFn: typeof fetch;

    constructor(baseUrl = '/api', fetchFn: typeof fetch = (...args) => fetch(...args)) {
        this.baseUrl = baseUrl;
        this.fetchFn = fetchFn;
    }

    async loadPlanDocument(planId: Id, signal?: AbortSignal): Promise<LoadedPlanDocument> {
        const url = `${this.baseUrl}/plans/${encodeURIComponent(planId)}/document`;
        const response = await this.fetchFn(url, { headers: { Accept: 'application/json' }, signal });
        if (!response.ok) {
            throw new CadApiError(response.status, `Loading plan "${planId}" failed with HTTP ${response.status}`);
        }

        const body = (await response.json()) as ApiSchema['PlanDocument'];
        return {
            document: parseDocument(body),
            revision: parseEtag(response.headers.get('ETag')),
        };
    }
}

function parseEtag(etag: string | null): string | null {
    return etag === null ? null : etag.replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
}
