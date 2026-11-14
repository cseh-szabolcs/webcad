<?php

namespace App\Tests\Customer\Controller;

use App\Core\Tenancy\TenantSwitcher;
use App\Customer\Entity\Company;
use App\Customer\Entity\Customer;
use App\Customer\Entity\Tag;
use App\Tests\Security\LogsInTrait;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class CustomerListControllerTest extends WebTestCase
{
    use LogsInTrait;

    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();

        // The database is not reset between tests, and these tests look at all customers.
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
        $em = $this->em();
        $em->createQuery('DELETE FROM '.Customer::class)->execute();
        $em->createQuery('DELETE FROM '.Company::class)->execute();
        $em->createQuery('DELETE FROM '.Tag::class)->execute();
    }

    public function testGuestIsSentToTheLogin(): void
    {
        $this->client->request('GET', '/de/customers');

        self::assertResponseRedirects('/de/login');
    }

    public function testGuestGetsNoData(): void
    {
        $this->client->request('GET', '/de/customers/data');

        self::assertResponseRedirects('/de/login');
    }

    public function testShowsThePageWithTheTabs(): void
    {
        $this->logIn($this->client, $this->createUser());

        $crawler = $this->client->request('GET', '/de/customers');

        self::assertResponseIsSuccessful();
        self::assertSelectorTextSame('.page-head__title', 'Kunden');
        self::assertSelectorTextSame('.app-nav__link[aria-current="page"]', 'Kunden');
        self::assertSelectorTextSame('.page-head__action', 'Kunde hinzufügen');
        self::assertSelectorNotExists('.eyebrow');

        // The tabs load their counts from `data-source`, so the badges are empty in the markup.
        $tabs = $crawler->filter('.segmented--tabs a.segmented__option');
        self::assertSame(['Kontakte', 'Firmen', 'Tags'], $tabs->each(static fn ($link) => $link->text()));
        self::assertSame(
            ['/de/customers', '/de/customers/companies', '/de/customers/tags'],
            $tabs->each(static fn ($link) => $link->attr('href')),
        );
        self::assertSame(
            ['/de/customers/count', '/de/customers/companies/count', '/de/customers/tags/count'],
            $tabs->each(static fn ($link) => $link->attr('data-source')),
        );
        self::assertSelectorTextSame('.segmented__option[aria-current="page"]', 'Kontakte');
        self::assertCount(1, $crawler->filter('.segmented__option[aria-current]'));
    }

    public function testTheListLoadsItsRowsFromTheDataRoute(): void
    {
        $this->logIn($this->client, $this->createUser());

        $crawler = $this->client->request('GET', '/de/customers');
        // Not the static copy below it, which is there for comparison only.
        $list = $crawler->filter('section[data-controller="page--customer--list"]');

        self::assertCount(1, $list);
        self::assertSame('/de/customers/data', $list->attr('data-page--customer--list-url-value'));
        self::assertSame(
            ['Name', 'Kontakt', 'Tags', 'Geändert', 'Aktionen'],
            $list->filter('.data-table th')->each(static fn ($header) => $header->text()),
        );
        self::assertCount(1, $list->filter('.toolbar input[type="search"]'));
        self::assertCount(2, $list->filter('.toolbar select'));
        // One template for the rows; inside it another one for the tags of a row
        self::assertCount(1, $list->filter('.data-table tbody > template[x-for]'));
        self::assertCount(1, $list->filter('.data-table tbody template[x-for="tag in item.tags"]'));
        self::assertSame(
            ['Bearbeiten', 'Löschen', 'Plan anlegen'],
            $list->filter('#customer-actions[popover] .context-menu__item')->each(static fn ($item) => $item->text()),
        );
    }

    public function testTheRouteOfTheTabCountReturnsTheTotal(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        foreach (['Adler', 'Berger', 'Conrad'] as $lastname) {
            $em->persist((new Customer(Company::forPrivatePerson()))->setLastname($lastname));
        }
        $em->flush();
        $em->clear();

        $this->client->request('GET', '/de/customers/count');

        self::assertResponseIsSuccessful();
        self::assertSame(['value' => 3], json_decode($this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR));
    }

    public function testGuestGetsNoCount(): void
    {
        $this->client->request('GET', '/de/customers/count');

        self::assertResponseRedirects('/de/login');
    }

    public function testAnEmptyListIsOneEmptyPage(): void
    {
        $this->logIn($this->client, $this->createUser());

        self::assertSame(
            ['items' => [], 'page' => 1, 'pageSize' => 20, 'total' => 0],
            $this->data('page=1&pageSize=20'),
        );
    }

    public function testReturnsTheCustomersWithTheirTagsByName(): void
    {
        $this->logIn($this->client, $this->createUser());
        $company = Company::forOrganization('Muster GmbH')->setEmail('erika@example.com')->setPhone('+49 30 123456');
        $customer = (new Customer($company))->setFirstname('Erika')->setLastname('Muster');
        $em = $this->em();
        $em->persist($company);
        $tags = [];
        foreach (['Planer', 'Bauherr'] as $name) {
            $tags[$name] = new Tag($name);
            $customer->addTag($tags[$name]);
            $em->persist($tags[$name]);
        }
        $em->persist($customer);
        $em->persist((new Customer(Company::forPrivatePerson()))->setLastname('Zimmermann'));
        $em->flush();
        $em->clear();

        $result = $this->data('page=1&pageSize=20');

        self::assertSame(2, $result['total']);
        self::assertSame([
            'id' => $customer->getUuid()->toRfc4122(),
            'displayName' => 'Muster GmbH',
            'email' => 'erika@example.com',
            'company' => 'Muster GmbH',
            'organization' => true,
            'firstname' => 'Erika',
            'lastname' => 'Muster',
            'phone' => '+49 30 123456',
            'tags' => [
                ['id' => $tags['Bauherr']->getUuid()->toRfc4122(), 'name' => 'Bauherr', 'color' => null],
                ['id' => $tags['Planer']->getUuid()->toRfc4122(), 'name' => 'Planer', 'color' => null],
            ],
            'created' => $customer->getCreated()->format(\DATE_ATOM),
            'updated' => $customer->getUpdated()->format(\DATE_ATOM),
        ], $result['items'][0]);
        self::assertSame('Zimmermann', $result['items'][1]['lastname']);
        self::assertSame('Zimmermann', $result['items'][1]['displayName']);
        self::assertNull($result['items'][1]['company']);
        self::assertSame([], $result['items'][1]['tags']);
    }

    public function testOneCompanyCanHaveManyCustomers(): void
    {
        $this->logIn($this->client, $this->createUser());
        $company = Company::forOrganization('Muster GmbH');
        $em = $this->em();
        $em->persist($company);
        foreach (['Adler', 'Berger'] as $lastname) {
            $em->persist((new Customer($company))->setLastname($lastname));
        }
        $em->flush();
        $em->clear();

        $result = $this->data('page=1&pageSize=20');

        self::assertSame(['Muster GmbH', 'Muster GmbH'], array_column($result['items'], 'company'));
        self::assertCount(2, $em->find(Company::class, $company->getId())->getCustomers());
    }

    public function testAPrivatePersonHasTheContactDataOfItsCompanyButNoCompanyName(): void
    {
        $this->logIn($this->client, $this->createUser());
        $company = Company::forPrivatePerson()->setEmail('jonas@example.com')->setPhone('+49 170 123456');
        $em = $this->em();
        $em->persist((new Customer($company))->setFirstname('Jonas')->setLastname('Beispiel'));
        $em->flush();
        $em->clear();

        $item = $this->data('page=1&pageSize=20')['items'][0];

        self::assertNull($item['company']);
        self::assertSame('jonas@example.com', $item['email']);
        self::assertSame('+49 170 123456', $item['phone']);
    }

    public function testOneTagCanBeAssignedToManyCustomers(): void
    {
        $this->logIn($this->client, $this->createUser());
        $tag = new Tag('Bauherr');
        $em = $this->em();
        $em->persist($tag);
        foreach (['Adler', 'Berger'] as $lastname) {
            $customer = (new Customer(Company::forPrivatePerson()))->setLastname($lastname);
            $customer->addTag($tag);
            $em->persist($customer);
        }
        $em->flush();
        $em->clear();

        $result = $this->data('page=1&pageSize=20');

        self::assertSame([['Bauherr'], ['Bauherr']], array_map($this->tagNames(...), $result['items']));
    }

    public function testACustomerWithSeveralTagsIsOneItem(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        foreach (['Adler', 'Berger'] as $lastname) {
            $customer = (new Customer(Company::forPrivatePerson()))->setLastname($lastname);
            foreach (['Bauherr', 'Planer', 'Statik'] as $name) {
                $tag = new Tag($name);
                $customer->addTag($tag);
                $em->persist($tag);
            }
            $em->persist($customer);
        }
        $em->flush();
        $em->clear();

        $result = $this->data('page=2&pageSize=1');

        self::assertSame(2, $result['total']);
        self::assertSame(['Berger'], array_column($result['items'], 'lastname'));
        self::assertSame(['Bauherr', 'Planer', 'Statik'], $this->tagNames($result['items'][0]));
    }

    public function testDeletingATagKeepsItsCustomers(): void
    {
        $this->logIn($this->client, $this->createUser());
        $tag = new Tag('Bauherr');
        $customer = (new Customer(Company::forPrivatePerson()))->setLastname('Muster');
        $customer->addTag($tag);
        $em = $this->em();
        $em->persist($tag);
        $em->persist($customer);
        $em->flush();
        $em->clear();

        $em->remove($em->find(Tag::class, $tag->getId()));
        $em->flush();
        $em->clear();

        $result = $this->data('page=1&pageSize=20');

        self::assertSame(1, $result['total']);
        self::assertSame([], $result['items'][0]['tags']);
    }

    public function testReturnsTheRequestedPage(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        foreach (['Adler', 'Berger', 'Conrad'] as $lastname) {
            $em->persist((new Customer(Company::forPrivatePerson()))->setLastname($lastname));
        }
        $em->flush();
        $em->clear();

        $result = $this->data('page=2&pageSize=2');

        self::assertSame(['Conrad'], array_column($result['items'], 'lastname'));
        self::assertSame(2, $result['page']);
        self::assertSame(3, $result['total']);
    }

    public function testSearchesNamesCompanyAndEmail(): void
    {
        $this->logIn($this->client, $this->createUser());
        $this->createSearchableCustomers();

        foreach (['filter[search]=muster' => ['Muster'], 'filter[search]=NORDBAU' => ['Muster'], 'filter[search]=b.example' => ['Beispiel']] as $query => $expected) {
            self::assertSame($expected, array_column($this->data($query)['items'], 'lastname'), $query);
        }
        self::assertSame(0, $this->data('filter[search]=nichts')['total']);
    }

    public function testEveryWordOfTheSearchMustMatch(): void
    {
        $this->logIn($this->client, $this->createUser());
        $this->createSearchableCustomers();

        self::assertSame(['Muster'], array_column($this->data('filter[search]=erika+nordbau')['items'], 'lastname'));
        self::assertSame(0, $this->data('filter[search]=erika+beispiel')['total']);
    }

    public function testWildcardsInTheSearchAreOrdinaryCharacters(): void
    {
        $this->logIn($this->client, $this->createUser());
        $this->createSearchableCustomers();

        self::assertSame(0, $this->data('filter[search]=%25')['total']);
        self::assertSame(0, $this->data('filter[search]=_')['total']);
    }

    public function testFilteringByATagKeepsTheOtherTagsOfTheCustomer(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        $wanted = new Tag('Bauherr');
        $other = new Tag('Planer');
        $em->persist($wanted);
        $em->persist($other);
        $customer = (new Customer(Company::forPrivatePerson()))->setLastname('Adler');
        $customer->addTag($wanted);
        $customer->addTag($other);
        $em->persist($customer);
        $withoutWanted = (new Customer(Company::forPrivatePerson()))->setLastname('Berger');
        $withoutWanted->addTag($other);
        $em->persist($withoutWanted);
        $em->flush();
        $em->clear();

        $result = $this->data('filter[tag]='.$wanted->getUuid()->toRfc4122());

        self::assertSame(1, $result['total']);
        self::assertSame('Adler', $result['items'][0]['lastname']);
        self::assertSame(['Bauherr', 'Planer'], $this->tagNames($result['items'][0]));
    }

    public function testSortsANameByTheCompanyIfTheCustomerHasNoLastName(): void
    {
        $this->logIn($this->client, $this->createUser());
        $company = Company::forOrganization('Moser AG');
        $em = $this->em();
        $em->persist($company);
        $em->persist(new Customer($company));
        foreach (['Zimmermann', 'Adler'] as $lastname) {
            $em->persist((new Customer(Company::forPrivatePerson()))->setLastname($lastname));
        }
        $em->flush();
        $em->clear();

        $ascending = $this->data('sort=name&direction=asc')['items'];
        self::assertSame(['Adler', null, 'Zimmermann'], array_column($ascending, 'lastname'));
        self::assertSame('Moser AG', $ascending[1]['company']);
        self::assertSame(
            ['Zimmermann', null, 'Adler'],
            array_column($this->data('sort=name&direction=desc')['items'], 'lastname'),
        );
    }

    public function testSortsByTheDates(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        foreach (['Adler' => '2020-01-01', 'Berger' => '2022-01-01', 'Conrad' => '2021-01-01'] as $lastname => $date) {
            $em->persist((new Customer(Company::forPrivatePerson()))->setLastname($lastname));
            $em->flush();
            $em->createQuery('UPDATE '.Customer::class.' c SET c.created = :date, c.updated = :date WHERE c.lastname = :lastname')
                ->setParameter('date', new \DateTimeImmutable($date))
                ->setParameter('lastname', $lastname)
                ->execute();
        }
        $em->clear();

        foreach (['updated', 'created'] as $sort) {
            self::assertSame(
                ['Berger', 'Conrad', 'Adler'],
                array_column($this->data('sort='.$sort.'&direction=desc')['items'], 'lastname'),
            );
            self::assertSame(
                ['Adler', 'Conrad', 'Berger'],
                array_column($this->data('sort='.$sort.'&direction=asc')['items'], 'lastname'),
            );
        }
    }

    public function testRejectsAnUnknownSortingOrFilter(): void
    {
        $this->logIn($this->client, $this->createUser());

        foreach (['sort=email', 'direction=up', 'filter[tag]=abc', 'filter[search][]=a'] as $query) {
            $this->client->request('GET', '/de/customers/data?'.$query);

            self::assertResponseStatusCodeSame(404, $query);
        }
    }

    public function testReturnsOneCustomerForTheDetailView(): void
    {
        $this->logIn($this->client, $this->createUser());
        $company = Company::forOrganization('Muster GmbH');
        $tag = new Tag('Bauherr');
        $customer = (new Customer($company))->setLastname('Muster');
        $customer->addTag($tag);
        $em = $this->em();
        $em->persist($company);
        $em->persist($tag);
        $em->persist($customer);
        $em->flush();
        $em->clear();

        $this->client->request('GET', '/de/customers/data/'.$customer->getUuid()->toRfc4122());

        self::assertResponseIsSuccessful();
        $result = json_decode($this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame($customer->getUuid()->toRfc4122(), $result['id']);
        self::assertSame('Muster GmbH', $result['company']);
        self::assertSame(['Bauherr'], $this->tagNames($result));
    }

    public function testAnUnknownCustomerIsNotFound(): void
    {
        $this->logIn($this->client, $this->createUser());

        $this->client->request('GET', '/de/customers/data/01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42');
        self::assertResponseStatusCodeSame(404);

        $this->client->request('GET', '/de/customers/data/no-uuid');
        self::assertResponseStatusCodeSame(404);
    }

    public function testGuestGetsNoCustomer(): void
    {
        $this->client->request('GET', '/de/customers/data/01994f4e-6f3a-7c2d-9b1e-5a3c2d1e0f42');

        self::assertResponseRedirects('/de/login');
    }

    public function testASearchIsDividedIntoPagesToo(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        foreach (['Adler', 'Adlmann', 'Berger'] as $lastname) {
            $em->persist((new Customer(Company::forPrivatePerson()))->setLastname($lastname));
        }
        $em->flush();
        $em->clear();

        $result = $this->data('filter[search]=adl&sort=name&page=2&pageSize=1');

        self::assertSame(2, $result['total']);
        self::assertSame(2, $result['page']);
        self::assertSame(['Adlmann'], array_column($result['items'], 'lastname'));
    }

    public function testRejectsAnInvalidPageSize(): void
    {
        $this->logIn($this->client, $this->createUser());

        $this->client->request('GET', '/de/customers/data?pageSize=1000');

        self::assertResponseStatusCodeSame(404);
    }

    /**
     * @param array<string, mixed> $customer
     *
     * @return list<string>
     */
    private function tagNames(array $customer): array
    {
        return array_column($customer['tags'], 'name');
    }

    private function createSearchableCustomers(): void
    {
        $company = Company::forOrganization('Nordbau GmbH')->setEmail('info@nord.test');
        $em = $this->em();
        $em->persist((new Customer($company))->setFirstname('Erika')->setLastname('Muster'));
        $em->persist((new Customer(Company::forPrivatePerson()->setEmail('jonas@b.example')))->setFirstname('Jonas')->setLastname('Beispiel'));
        $em->flush();
        $em->clear();
    }

    /**
     * @return array<string, mixed>
     */
    private function data(string $query): array
    {
        $this->client->request('GET', '/de/customers/data?'.$query);
        self::assertResponseIsSuccessful();

        return json_decode($this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
