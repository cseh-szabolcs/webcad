<?php

namespace App\Tests\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Uid\Uuid;

final class PlanDocumentControllerTest extends WebTestCase
{
    private const string FIXTURE_PLAN_ID = '01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42';

    public function testReturnsPlanDocumentWithEtag(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/plans/'.self::FIXTURE_PLAN_ID.'/document');

        self::assertResponseIsSuccessful();
        self::assertResponseHeaderSame('Content-Type', 'application/json');
        self::assertResponseHeaderSame('ETag', '"1"');

        $document = json_decode($client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame(1, $document['schemaVersion']);
        self::assertSame(self::FIXTURE_PLAN_ID, $document['id']);
        self::assertNotEmpty($document['elements']);
    }

    public function testUnknownPlanReturns404(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/plans/'.Uuid::v7()->toRfc4122().'/document');

        self::assertResponseStatusCodeSame(404);
    }

    public function testNonUuidIdReturns404(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/plans/sample-plan/document');

        self::assertResponseStatusCodeSame(404);
    }

    public function testMatchingEtagReturns304(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/plans/'.self::FIXTURE_PLAN_ID.'/document', server: ['HTTP_IF_NONE_MATCH' => '"1"']);

        self::assertResponseStatusCodeSame(304);
    }
}
