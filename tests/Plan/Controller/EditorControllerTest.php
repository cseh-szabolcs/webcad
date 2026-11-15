<?php

namespace App\Tests\Plan\Controller;

use App\Tests\Security\LogsInTrait;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class EditorControllerTest extends WebTestCase
{
    use LogsInTrait;

    private const string PLAN_ID = '01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42';

    public function testGuestIsSentToTheLogin(): void
    {
        $client = static::createClient();
        $client->request('GET', '/de/plans/'.self::PLAN_ID.'/editor');

        self::assertResponseRedirects('/de/login');
    }

    public function testLoadsTheBuiltEditorForThePlan(): void
    {
        $client = static::createClient();
        $this->logIn($client, $this->createUser());

        $client->request('GET', '/de/plans/'.self::PLAN_ID.'/editor');

        self::assertResponseIsSuccessful();
        self::assertSelectorExists('#root[data-plan-id="'.self::PLAN_ID.'"]');
        // EDITOR_BACKEND_HOST of .env.test
        self::assertSelectorExists('#root[data-backend-host="http://backend.test"]');
        self::assertSelectorExists('#root[data-exit-path="/de/plans"]');
        self::assertSelectorExists('script[type="module"][src="/editor/index.js"]');
        self::assertSelectorExists('link[rel="stylesheet"][href="/editor/index.css"]');
    }

    public function testRejectsAnIdThatIsNoUuid(): void
    {
        $client = static::createClient();
        $this->logIn($client, $this->createUser());

        $client->request('GET', '/de/plans/abc/editor');

        self::assertResponseStatusCodeSame(404);
    }
}
