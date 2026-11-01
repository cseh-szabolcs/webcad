<?php

namespace App\Tests\User\Controller;

use App\Core\Constants\Role;
use App\Core\Tenancy\TenantProvisioner;
use App\Core\Tenancy\TenantStorage;
use App\Core\Tenancy\TenantSwitcher;
use App\Tests\Security\LogsInTrait;
use App\User\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\BrowserKit\Cookie;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Uid\Uuid;

final class LoginControllerTest extends WebTestCase
{
    use LogsInTrait;

    private KernelBrowser $client;
    private User $user;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->user = $this->createUser('secret-password');
    }

    public function testShowsTheFieldsTheAuthenticatorReads(): void
    {
        $crawler = $this->client->request('GET', '/de/login');

        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('h1', 'Willkommen zurück');
        $form = $crawler->filter('form.form');
        self::assertSame('/de/login', $form->attr('action'));
        foreach (['tenantName', 'email', 'password', '_remember_me', '_csrf_token'] as $name) {
            self::assertCount(1, $form->filter(\sprintf('input[name="%s"]', $name)), $name);
        }
        self::assertCount(0, $crawler->filter('.field--invalid'));
        self::assertCount(1, $crawler->filter('.card__switch a[href="/de/register"]'));
    }

    public function testUnknownTenantMarksTheTenantField(): void
    {
        $this->submit('Nirgendwo', $this->user->getEmail(), 'secret-password');

        self::assertResponseRedirects('/de/login');
        $crawler = $this->client->followRedirect();
        self::assertSelectorTextContains('.field--invalid .field__errors', 'Dieses Büro gibt es nicht.');
        self::assertCount(1, $crawler->filter('.field--invalid input[name="tenantName"][aria-invalid="true"]'));
        self::assertCount(1, $crawler->filter('.field--invalid'));
        self::assertSame('Nirgendwo', $crawler->filter('input[name="tenantName"]')->attr('value'));
        self::assertSame($this->user->getEmail(), $crawler->filter('input[name="email"]')->attr('value'));
    }

    public function testWrongPasswordMarksTheCredentials(): void
    {
        $this->submit('demo', $this->user->getEmail(), 'wrong-password');

        self::assertResponseRedirects('/de/login');
        $crawler = $this->client->followRedirect();
        self::assertSelectorTextContains('.notice--error', 'Fehlerhafte Zugangsdaten.');
        self::assertCount(1, $crawler->filter('.field--invalid input[name="email"]'));
        self::assertCount(1, $crawler->filter('.field--invalid input[name="password"]'));
        self::assertCount(0, $crawler->filter('.field--invalid input[name="tenantName"]'));
        self::assertSame('demo', $crawler->filter('input[name="tenantName"]')->attr('value'));
    }

    public function testLoginOpensTheStartPageAndKeepsTheTenant(): void
    {
        $this->submit('Demo', $this->user->getEmail(), 'secret-password');

        self::assertResponseRedirects('/de/app');
        self::assertSame($this->defaultTenantUuid(), $this->client->getCookieJar()->get(TenantStorage::COOKIE)?->getValue());

        $this->client->followRedirect();
        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('.page-head__lead', $this->user->getEmail());
        self::assertSelectorExists('a[href="/de/logout"]');

        // The session alone keeps the tenant
        $this->client->getCookieJar()->expire(TenantStorage::COOKIE);
        $this->client->request('GET', '/de/app');
        self::assertResponseIsSuccessful();

        $this->client->request('GET', '/de/login');
        self::assertResponseRedirects('/de/app');
    }

    public function testAGuestsApiRequestIsNotWhereTheLoginLeads(): void
    {
        $this->client->request('GET', '/api/plans/'.Uuid::v7()->toRfc4122().'/document');
        self::assertResponseStatusCodeSame(401);

        $this->submit('demo', $this->user->getEmail(), 'secret-password');

        self::assertResponseRedirects('/de/app');
    }

    public function testApiAcceptsTheLoginOfThePages(): void
    {
        $this->submit('demo', $this->user->getEmail(), 'secret-password');

        $this->client->request('GET', '/api/plans/'.Uuid::v7()->toRfc4122().'/document');

        self::assertResponseStatusCodeSame(404);
    }

    public function testRememberMeFindsTheTenantAfterTheSessionExpired(): void
    {
        $this->submit('demo', $this->user->getEmail(), 'secret-password');
        $this->client->getCookieJar()->expire('MOCKSESSID');

        $this->client->request('GET', '/de/app');

        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('.page-head__lead', $this->user->getEmail());
    }

    public function testATenantCookieWithTheNameInsteadOfTheUuidSelectsNoTenant(): void
    {
        $this->submit('demo', $this->user->getEmail(), 'secret-password');
        $cookies = $this->client->getCookieJar();
        $cookies->expire('MOCKSESSID');
        $cookies->expire(TenantStorage::COOKIE);
        $cookies->set(new Cookie(TenantStorage::COOKIE, 'demo'));

        $this->client->request('GET', '/de/app');

        self::assertResponseRedirects('/de/login');
    }

    public function testLogsInByTheSlugOfTheNameAndKeepsTheTenantByItsUuid(): void
    {
        $container = static::getContainer();
        $provisioner = $container->get(TenantProvisioner::class);
        $tenant = $provisioner->create('Phpunit Büro '.bin2hex(random_bytes(4)));

        try {
            $container->get(TenantSwitcher::class)->switchTo($tenant->getHash());
            $user = new User('anna@example.com', Role::USER);
            $user->setPassword($container->get(UserPasswordHasherInterface::class)->hashPassword($user, 'anna-password'));
            $em = $container->get(EntityManagerInterface::class);
            $em->persist($user);
            $em->flush();

            // Typed differently, the same slug
            $this->submit(' '.mb_strtoupper($tenant->getName()).' ', 'anna@example.com', 'anna-password');

            self::assertResponseRedirects('/de/app');
            self::assertSame($tenant->getUuid()->toRfc4122(), $this->client->getCookieJar()->get(TenantStorage::COOKIE)?->getValue());
            $this->client->followRedirect();
            self::assertSelectorTextContains('.page-head__lead', $tenant->getName());
        } finally {
            $provisioner->delete($tenant->getHash());
        }
    }

    public function testLogoutForgetsTheTenant(): void
    {
        $this->submit('demo', $this->user->getEmail(), 'secret-password');

        $this->client->request('GET', '/de/logout');

        self::assertResponseRedirects('/de');
        self::assertNull($this->client->getCookieJar()->get(TenantStorage::COOKIE));
        $this->client->request('GET', '/de/app');
        self::assertResponseRedirects('/de/login');
    }

    private function submit(string $tenant, string $email, string $password): void
    {
        $this->client->request('GET', '/de/login');
        $this->client->submitForm('Anmelden', ['tenantName' => $tenant, 'email' => $email, 'password' => $password]);
    }
}
