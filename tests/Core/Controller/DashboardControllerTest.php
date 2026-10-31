<?php

namespace App\Tests\Core\Controller;

use App\Tests\Security\LogsInTrait;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class DashboardControllerTest extends WebTestCase
{
    use LogsInTrait;

    public function testGuestIsSentToTheLogin(): void
    {
        $client = static::createClient();
        $client->request('GET', '/de/app');

        self::assertResponseRedirects('/de/login');
    }

    public function testShowsTheUserAndTheTenant(): void
    {
        $client = static::createClient();
        $user = $this->createUser();
        $this->logIn($client, $user);

        $client->request('GET', '/de/app');

        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('.card__lead', \sprintf('Angemeldet als %s im Büro „Demo“.', $user->getEmail()));
        self::assertSelectorTextContains('.site-nav', 'Abmelden');
        self::assertSelectorExists('a.brand[href="/de/app"]');
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function guestPages(): iterable
    {
        yield 'root' => ['/', '/de/app'];
        yield 'home' => ['/de', '/de/app'];
        yield 'home en' => ['/en', '/en/app'];
        yield 'login' => ['/de/login', '/de/app'];
        yield 'registration' => ['/de/register', '/de/app'];
    }

    #[DataProvider('guestPages')]
    public function testLoggedInUserIsSentFromGuestPagesToTheStartPage(string $page, string $target): void
    {
        $client = static::createClient();
        $this->logIn($client, $this->createUser());

        $client->request('GET', $page, server: ['HTTP_ACCEPT_LANGUAGE' => 'de']);

        self::assertResponseRedirects($target);
    }
}
