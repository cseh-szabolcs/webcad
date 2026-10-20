import { describe, expect, it, vi } from 'vitest';
import samplePlan from '../__fixtures__/sample-plan.json';
import { CadApiClient, CadApiError } from './CadApiClient';
import { CadDocumentError } from './CadSerializer';

function respond(body: unknown, init: ResponseInit = {}) {
    return vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), init));
}

describe('CadApiClient', () => {
    it('loads and parses a plan document', async () => {
        const fetchFn = respond(samplePlan, { headers: { ETag: '"1"' } });
        const client = new CadApiClient('/api', fetchFn);

        const loaded = await client.loadPlanDocument(samplePlan.id);

        expect(fetchFn).toHaveBeenCalledWith(`/api/plans/${samplePlan.id}/document`, expect.anything());
        expect(loaded.document).toEqual(samplePlan);
        expect(loaded.revision).toBe('1');
    });

    it('strips the weak prefix from the ETag', async () => {
        const client = new CadApiClient('/api', respond(samplePlan, { headers: { ETag: 'W/"7"' } }));
        expect((await client.loadPlanDocument('p')).revision).toBe('7');
    });

    it('encodes the plan id', async () => {
        const fetchFn = respond(samplePlan);
        await new CadApiClient('/api', fetchFn).loadPlanDocument('a/b');
        expect(fetchFn).toHaveBeenCalledWith('/api/plans/a%2Fb/document', expect.anything());
    });

    it('throws CadApiError with the HTTP status', async () => {
        const client = new CadApiClient('/api', respond({}, { status: 404 }));
        await expect(client.loadPlanDocument('missing')).rejects.toMatchObject({
            constructor: CadApiError,
            status: 404,
        });
    });

    it('rejects an invalid document', async () => {
        const client = new CadApiClient('/api', respond({ ...samplePlan, schemaVersion: 99 }));
        await expect(client.loadPlanDocument('p')).rejects.toBeInstanceOf(CadDocumentError);
    });
});
