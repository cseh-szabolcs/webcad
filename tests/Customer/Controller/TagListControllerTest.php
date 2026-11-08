<?php

namespace App\Tests\Customer\Controller;

use App\Core\Tenancy\TenantSwitcher;
use App\Customer\Entity\Tag;
use App\Tests\Security\LogsInTrait;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class TagListControllerTest extends WebTestCase
{
    use LogsInTrait;

    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();

        // The database is not reset between tests, and these tests look at all tags.
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
        $this->em()->createQuery('DELETE FROM '.Tag::class)->execute();
    }

    public function testGuestIsSentToTheLogin(): void
    {
        $this->client->request('GET', '/de/customers/tags');

        self::assertResponseRedirects('/de/login');
    }

    public function testGuestGetsNoData(): void
    {
        $this->client->request('GET', '/de/customers/tags/data');

        self::assertResponseRedirects('/de/login');
    }

    public function testShowsThePageInTheCustomerArea(): void
    {
        $this->logIn($this->client, $this->createUser());

        $crawler = $this->client->request('GET', '/de/customers/tags');

        self::assertResponseIsSuccessful();
        self::assertSelectorTextSame('.page-head__title', 'Tags');
        self::assertSelectorTextSame('.page-head__action', 'Tag erstellen');
        self::assertSelectorTextSame('.app-nav__link[aria-current="true"]', 'Kunden');
        self::assertSelectorTextSame('.segmented__option[aria-current="page"]', 'Tags 1');
        self::assertSame(
            ['Stammkunde'],
            $crawler->filter('.data-table tbody td')->each(static fn ($cell) => $cell->text()),
        );
        self::assertCount(0, $crawler->filter('main [data-controller], main [x-data]'));
    }

    public function testReturnsTheTagsByName(): void
    {
        $this->logIn($this->client, $this->createUser());
        $tag = new Tag('Bauherr');
        $em = $this->em();
        $em->persist(new Tag('Planer'));
        $em->persist($tag);
        $em->flush();
        $em->clear();

        $result = $this->data('page=1&pageSize=20');

        self::assertSame(2, $result['total']);
        self::assertSame(['id' => $tag->getUuid()->toRfc4122(), 'name' => 'Bauherr', 'color' => null], $result['items'][0]);
        self::assertSame('Planer', $result['items'][1]['name']);
    }

    public function testReturnsTheColorTheUserChose(): void
    {
        $this->logIn($this->client, $this->createUser());
        $em = $this->em();
        $em->persist((new Tag('Bauherr'))->setColor('#5b4fc4'));
        $em->flush();
        $em->clear();

        self::assertSame('#5b4fc4', $this->data('page=1&pageSize=20')['items'][0]['color']);
    }

    /**
     * @return array<string, mixed>
     */
    private function data(string $query): array
    {
        $this->client->request('GET', '/de/customers/tags/data?'.$query);
        self::assertResponseIsSuccessful();

        return json_decode($this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
