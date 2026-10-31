<?php

namespace App\Tests\User\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class RegistrationControllerTest extends WebTestCase
{
    public function testShowsTheRegistrationForm(): void
    {
        $client = static::createClient();
        $crawler = $client->request('GET', '/de/register');

        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('h1', 'Konto erstellen');
        self::assertSelectorTextContains('label[for="registration_form_company"]', 'Büro');
        self::assertCount(2, $crawler->filter('input[type="password"]'));
        self::assertCount(1, $crawler->filter('.card__switch a[href="/de/login"]'));
    }

    public function testEmptySubmissionShowsTranslatedErrors(): void
    {
        $client = static::createClient();
        $client->request('GET', '/de/register');
        $crawler = $client->submitForm('Konto erstellen');

        self::assertResponseStatusCodeSame(422);
        self::assertSelectorTextContains('.field--invalid .field__errors', 'Dieser Wert sollte nicht leer sein.');
        self::assertStringContainsString('Bitte akzeptieren Sie die Nutzungsbedingungen.', $crawler->filter('.field--check')->text());
    }

    public function testMismatchingPasswordsAreRejected(): void
    {
        $client = static::createClient();
        $client->request('GET', '/de/register');
        $client->submitForm('Konto erstellen', $this->validData([
            'registration_form[plainPassword][second]' => 'something-else-entirely',
        ]));

        self::assertResponseStatusCodeSame(422);
        self::assertSelectorTextContains('.field__errors', 'Die Passwörter stimmen nicht überein.');
    }

    public function testValidSubmissionSaysRegistrationIsNotAvailableYet(): void
    {
        $client = static::createClient();
        $client->request('GET', '/de/register');
        $client->submitForm('Konto erstellen', $this->validData());

        self::assertResponseRedirects('/de/register');
        $client->followRedirect();
        self::assertSelectorTextContains('.notice', 'Die Registrierung ist noch nicht verfügbar');
    }

    /**
     * @param array<string, string|bool> $overrides
     *
     * @return array<string, string|bool>
     */
    private function validData(array $overrides = []): array
    {
        return $overrides + [
            'registration_form[company]' => 'Muster Architekten',
            'registration_form[name]' => 'Anna Muster',
            'registration_form[email]' => 'anna@example.com',
            'registration_form[plainPassword][first]' => 'correct-horse-battery',
            'registration_form[plainPassword][second]' => 'correct-horse-battery',
            'registration_form[acceptTerms]' => true,
        ];
    }
}
