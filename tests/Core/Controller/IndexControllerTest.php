<?php

namespace App\Tests\Core\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class IndexControllerTest extends WebTestCase
{
    public function testIndex(): void
    {
        $client = static::createClient();
        $client->request('GET', '/index');

        self::assertResponseIsSuccessful();
    }
}
