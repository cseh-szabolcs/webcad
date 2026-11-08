<?php

namespace App\Tests\Customer\Controller;

use App\Core\Tenancy\TenantSwitcher;
use App\Customer\Entity\Company;
use App\Customer\Entity\Customer;
use App\Tests\Security\LogsInTrait;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class CompanyListControllerTest extends WebTestCase
{
    use LogsInTrait;

    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();

        // The database is not reset between tests, and these tests look at all companies.
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
        $this->em()->createQuery('DELETE FROM '.Customer::class)->execute();
        $this->em()->createQuery('DELETE FROM '.Company::class)->execute();
    }

    public function testGuestIsSentToTheLogin(): void
    {
        $this->client->request('GET', '/de/customers/companies');

        self::assertResponseRedirects('/de/login');
    }

    public function testGuestGetsNoData(): void
    {
        $this->client->request('GET', '/de/customers/companies/data');

        self::assertResponseRedirects('/de/login');
    }

    public function testShowsThePageInTheCustomerArea(): void
    {
        $this->logIn($this->client, $this->createUser());

        $crawler = $this->client->request('GET', '/de/customers/companies');

        self::assertResponseIsSuccessful();
        self::assertSelectorTextSame('.page-head__title', 'Firmen');
        self::assertSelectorTextSame('.page-head__action', 'Firma hinzufügen');
        self::assertSelectorTextSame('.app-nav__link[aria-current="true"]', 'Kunden');
        self::assertSelectorTextSame('.segmented__option[aria-current="page"]', 'Firmen 1');
        self::assertSame(
            ['Stadtwerke Musterstadt', 'info@stadtwerke.example.com', '–', '06.11.2026', '06.11.2026'],
            $crawler->filter('.data-table tbody td')->each(static fn ($cell) => $cell->text()),
        );
        self::assertCount(0, $crawler->filter('main [data-controller], main [x-data]'));
    }

    public function testReturnsTheCompaniesByName(): void
    {
        $this->logIn($this->client, $this->createUser());
        $company = Company::forOrganization('Muster GmbH')->setEmail('info@muster.example.com')->setPhone('+49 30 123456');
        $em = $this->em();
        $em->persist(Company::forOrganization('Zimmerei Holz'));
        $em->persist($company);
        $em->flush();
        $em->clear();

        $result = $this->data('page=1&pageSize=20');

        self::assertSame(2, $result['total']);
        self::assertSame([
            'id' => $company->getUuid()->toRfc4122(),
            'name' => 'Muster GmbH',
            'email' => 'info@muster.example.com',
            'phone' => '+49 30 123456',
            'created' => $company->getCreated()->format(\DATE_ATOM),
            'updated' => $company->getUpdated()->format(\DATE_ATOM),
        ], $result['items'][0]);
        self::assertSame('Zimmerei Holz', $result['items'][1]['name']);
        self::assertNull($result['items'][1]['email']);
    }

    public function testLeavesOutTheCompaniesOfPrivatePersons(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        $em->persist(Company::forOrganization('Muster GmbH'));
        $em->persist(new Customer(Company::forPrivatePerson()));
        $em->flush();
        $em->clear();

        $result = $this->data('page=1&pageSize=20');

        self::assertSame(1, $result['total']);
        self::assertSame(['Muster GmbH'], array_column($result['items'], 'name'));
    }

    public function testReturnsTheRequestedPage(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        foreach (['Adler AG', 'Berger KG', 'Conrad GmbH'] as $name) {
            $em->persist(Company::forOrganization($name));
        }
        $em->flush();
        $em->clear();

        $result = $this->data('page=2&pageSize=2');

        self::assertSame(['Conrad GmbH'], array_column($result['items'], 'name'));
        self::assertSame(3, $result['total']);
    }

    public function testSearchesNameAndEmail(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        $em->persist(Company::forOrganization('Nordbau GmbH')->setEmail('info@nord.test'));
        $em->persist(Company::forOrganization('Zimmerei Holz')->setEmail('kontakt@holz.example'));
        $em->flush();
        $em->clear();

        foreach (['muster' => [], 'NORDBAU' => ['Nordbau GmbH'], 'holz.example' => ['Zimmerei Holz'], 'nordbau+info' => ['Nordbau GmbH'], 'nordbau+holz' => []] as $search => $expected) {
            self::assertSame($expected, array_column($this->data('filter[search]='.$search)['items'], 'name'), $search);
        }
        self::assertSame(0, $this->data('filter[search]=%25')['total']);
    }

    public function testSortsByNameAndTheDates(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        foreach (['Adler AG' => '2020-01-01', 'Berger KG' => '2022-01-01', 'Conrad GmbH' => '2021-01-01'] as $name => $date) {
            $em->persist(Company::forOrganization($name));
            $em->flush();
            $em->createQuery('UPDATE '.Company::class.' c SET c.created = :date, c.updated = :date WHERE c.name = :name')
                ->setParameter('date', new \DateTimeImmutable($date))
                ->setParameter('name', $name)
                ->execute();
        }
        $em->clear();

        self::assertSame(['Conrad GmbH', 'Berger KG', 'Adler AG'], array_column($this->data('sort=name&direction=desc')['items'], 'name'));
        foreach (['updated', 'created'] as $sort) {
            self::assertSame(['Berger KG', 'Conrad GmbH', 'Adler AG'], array_column($this->data('sort='.$sort.'&direction=desc')['items'], 'name'), $sort);
            self::assertSame(['Adler AG', 'Conrad GmbH', 'Berger KG'], array_column($this->data('sort='.$sort.'&direction=asc')['items'], 'name'), $sort);
        }
    }

    public function testRejectsAnUnknownSortingOrFilter(): void
    {
        $this->logIn($this->client, $this->createUser());

        foreach (['sort=email', 'direction=up', 'filter[search][]=a', 'filter[search]='.str_repeat('a', 256)] as $query) {
            $this->client->request('GET', '/de/customers/companies/data?'.$query);

            self::assertResponseStatusCodeSame(404, $query);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function data(string $query): array
    {
        $this->client->request('GET', '/de/customers/companies/data?'.$query);
        self::assertResponseIsSuccessful();

        return json_decode($this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
