import type { CadDocument } from '../model/CadDocument';
import type { Id } from '../model/Point';
import type { ApiSchema } from '../../api/types';
import { parseDocument } from './CadSerializer';

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

        return {
            document: parseDocument(await response.json()),
            revision: parseEtag(response.headers.get('ETag')),
        };
    }

    /** The room of the plan's project and a short-lived token to join it. */
    async loadCollaborationAccess(planId: Id, signal?: AbortSignal): Promise<ApiSchema['CollaborationAccess']> {
        const url = `${this.baseUrl}/plans/${encodeURIComponent(planId)}/collaboration`;
        const response = await this.fetchFn(url, { headers: { Accept: 'application/json' }, signal });
        if (!response.ok) {
            throw new CadApiError(response.status, `Loading the collaboration of plan "${planId}" failed with HTTP ${response.status}`);
        }

        return (await response.json()) as ApiSchema['CollaborationAccess'];
    }
}

function parseEtag(etag: string | null): string | null {
    return etag === null ? null : etag.replace(/^W\//, '').replace(/^"(.*)"$/, '$1');
}
