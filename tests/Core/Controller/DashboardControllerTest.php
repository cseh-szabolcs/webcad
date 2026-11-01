<?php

namespace App\Tests\Core\Controller;

use App\Tests\Security\LogsInTrait;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\BrowserKit\Cookie;

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
        self::assertSelectorTextContains('.page-head__lead', \sprintf('Angemeldet als %s im Büro „Demo“.', $user->getEmail()));
        self::assertSelectorExists('a.brand[href="/de/app"]');
    }

    public function testUsesTheLayoutForLoggedInUsers(): void
    {
        $client = static::createClient();
        $user = $this->createUser();
        $user->setFirstname('Erika')->setLastname('Muster');
        static::getContainer()->get(EntityManagerInterface::class)->flush();
        $this->logIn($client, $user);

        $crawler = $client->request('GET', '/de/app');

        self::assertResponseIsSuccessful();
        self::assertSelectorExists('html.layout-app');
        self::assertSelectorNotExists('.site-header');
        self::assertSelectorNotExists('.site-footer');

        $nav = $crawler->filter('.app-nav__link');
        self::assertSame(['Dashboard', 'Pläne', 'Kunden', 'Verwaltung'], $nav->each(static fn ($link) => $link->text()));
        self::assertSame(['/de/app', '#', '#', '#'], $nav->each(static fn ($link) => $link->attr('href')));
        self::assertSelectorTextSame('.app-nav__link[aria-current="page"]', 'Dashboard');

        self::assertSelectorTextSame('.page-head__title', 'Willkommen, Erika Muster');
        self::assertSelectorTextSame('.user-menu__name', 'Erika Muster');
        self::assertSelectorTextSame('.user-menu__avatar', 'EM');
        self::assertCount(3, $crawler->filter('.user-menu [data-controller="layout--theme"] button[data-theme-choice]'));
        self::assertSelectorTextContains('.user-menu__links', 'Einstellungen');
        self::assertSelectorExists('.user-menu a.user-menu__logout[href="/de/logout"]');
    }

    public function testOffersTheCurrentPageInEveryLocale(): void
    {
        $client = static::createClient();
        $this->logIn($client, $this->createUser());

        $crawler = $client->request('GET', '/de/app');

        $locales = $crawler->filter('.app-header__actions .locale-switcher a[hreflang]');
        self::assertSame(['/de/app', '/en/app'], $locales->each(static fn ($link) => $link->attr('href')));
        self::assertSelectorTextContains('.locale-switcher a[aria-current="true"]', 'Deutsch');
        self::assertSelectorNotExists('.user-menu a[hreflang]');
    }

    /**
     * @return iterable<string, array{?string, ?string}>
     */
    public static function themeCookies(): iterable
    {
        yield 'none' => [null, null];
        yield 'light' => ['light', 'light'];
        yield 'dark' => ['dark', 'dark'];
        yield 'unknown' => ['<script>', null];
    }

    #[DataProvider('themeCookies')]
    public function testRendersTheThemeFromTheCookie(?string $cookie, ?string $theme): void
    {
        $client = static::createClient();
        $this->logIn($client, $this->createUser());
        if (null !== $cookie) {
            $client->getCookieJar()->set(new Cookie('theme', $cookie));
        }

        $crawler = $client->request('GET', '/de/app');

        self::assertSame($theme, $crawler->filter('html')->attr('data-theme'));
    }

    public function testShowsTheEmailWithoutAName(): void
    {
        $client = static::createClient();
        $user = $this->createUser();
        $this->logIn($client, $user);

        $client->request('GET', '/de/app');

        self::assertSelectorTextSame('.page-head__title', 'Willkommen');
        self::assertSelectorTextSame('.user-menu__name', $user->getEmail());
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
