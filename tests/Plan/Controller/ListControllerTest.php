<?php

namespace App\Tests\Plan\Controller;

use App\Tests\Security\LogsInTrait;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class ListControllerTest extends WebTestCase
{
    use LogsInTrait;

    public function testGuestIsSentToTheLogin(): void
    {
        $client = static::createClient();
        $client->request('GET', '/de/plans');

        self::assertResponseRedirects('/de/login');
    }

    public function testShowsTheDummyPlansAsGallery(): void
    {
        $client = static::createClient();
        $this->logIn($client, $this->createUser());

        $crawler = $client->request('GET', '/de/plans');

        self::assertResponseIsSuccessful();
        self::assertSelectorTextSame('.page-head__title', 'Pläne');
        self::assertSelectorTextSame('.app-nav__link[aria-current="page"]', 'Pläne');
        self::assertSame(
            ['Erdgeschoss', 'Obergeschoss', 'Schnitt A–A'],
            $crawler->filter('.plan-card__title')->each(static fn ($title) => $title->text()),
        );
        self::assertCount(3, $crawler->filter('.plan-card svg.plan-thumb'));
        // All three open the sample plan of app:fixture:create.
        $editor = '/de/plans/01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42/editor';
        self::assertSame([$editor, $editor, $editor], $crawler->filter('.plan-card__link')->each(static fn ($link) => $link->attr('href')));
    }
}
