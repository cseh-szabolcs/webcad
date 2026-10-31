<?php

namespace App\Tests\Core\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class IndexControllerTest extends WebTestCase
{
    public function testRootRedirectsToTheBrowserLanguage(): void
    {
        $client = static::createClient();

        $client->request('GET', '/', server: ['HTTP_ACCEPT_LANGUAGE' => 'en-US,en;q=0.8']);
        self::assertResponseRedirects('/en');

        $client->request('GET', '/', server: ['HTTP_ACCEPT_LANGUAGE' => 'fr-FR']);
        self::assertResponseRedirects('/de');
    }

    public function testHomePageLinksLoginRegistrationAndLocales(): void
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/de');

        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('h1', 'Vom Projekt zur Zeichnung');
        self::assertSame('de', $crawler->filter('html')->attr('lang'));
        self::assertCount(2, $crawler->filter('.site-nav a[href="/de/login"], .site-nav a[href="/de/register"]'));
        self::assertCount(1, $crawler->filter('.locale-switcher a[href="/en"]'));
        self::assertCount(1, $crawler->filter('.locale-switcher a[href="/de"][aria-current="true"]'));
    }

    public function testEnglishFallsBackToGermanTexts(): void
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/en');

        self::assertResponseIsSuccessful();
        self::assertSame('en', $crawler->filter('html')->attr('lang'));
        self::assertSelectorTextContains('h1', 'Vom Projekt zur Zeichnung');
        self::assertCount(1, $crawler->filter('.site-nav a[href="/en/login"]'));
    }

    public function testUnknownLocaleIsNotFound(): void
    {
        $client = static::createClient();
        $client->request('GET', '/fr');

        self::assertResponseStatusCodeSame(404);
    }
}
