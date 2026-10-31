<?php

namespace App\Tests\User\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class LoginControllerTest extends WebTestCase
{
    public function testShowsTheFieldsFormLoginReads(): void
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/de/login');

        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('h1', 'Willkommen zurück');
        $form = $crawler->filter('form.form');
        self::assertSame('/de/login', $form->attr('action'));
        foreach (['_username', '_password', '_remember_me', '_csrf_token'] as $name) {
            self::assertCount(1, $form->filter(\sprintf('input[name="%s"]', $name)), $name);
        }
        self::assertCount(1, $crawler->filter('.card__switch a[href="/de/register"]'));
    }

    public function testSubmittingSaysLoginIsNotAvailableYet(): void
    {
        $client = static::createClient();
        $client->request('GET', '/de/login');
        $client->submitForm('Anmelden', ['_username' => 'anna@example.com', '_password' => 'irrelevant']);

        self::assertResponseRedirects('/de/login');
        $client->followRedirect();
        self::assertSelectorTextContains('.notice', 'Die Anmeldung ist noch nicht verfügbar.');
    }
}
