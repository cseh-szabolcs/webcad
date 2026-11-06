<?php

namespace App\Tests\Customer\Entity;

use App\Core\Tenancy\TenantSwitcher;
use App\Customer\Entity\Company;
use App\Customer\Entity\Customer;
use App\Customer\Entity\Tag;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Against the test database: `updated` follows every change that is written, `created` stays.
 * The columns have no fractions of a second, so the tests start from a date in the past.
 */
final class CustomerTimestampsTest extends KernelTestCase
{
    private const string PAST = '2020-01-01 12:00:00';

    protected function setUp(): void
    {
        // Without a request or console command, nothing selects the tenant (see .env.test)
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
    }

    public function testANewCustomerGetsBothDates(): void
    {
        $customer = $this->reload($this->createCustomerInThePast());

        self::assertSame(self::PAST, $customer->getCreated()->format('Y-m-d H:i:s'));
        self::assertSame(self::PAST, $customer->getUpdated()->format('Y-m-d H:i:s'));
    }

    public function testChangingAFieldSetsUpdated(): void
    {
        $customer = $this->reload($this->createCustomerInThePast());

        $customer->setFirstname('Erika');
        $this->em()->flush();

        $customer = $this->reload($customer);
        self::assertGreaterThan(new \DateTimeImmutable(self::PAST), $customer->getUpdated());
        self::assertSame(self::PAST, $customer->getCreated()->format('Y-m-d H:i:s'));
    }

    public function testAssigningACompanySetsUpdated(): void
    {
        $customer = $this->reload($this->createCustomerInThePast());
        $company = Company::forOrganization('Muster GmbH');
        $this->em()->persist($company);

        $customer->setCompany($company);
        $this->em()->flush();

        self::assertGreaterThan(new \DateTimeImmutable(self::PAST), $this->reload($customer)->getUpdated());
    }

    public function testAssigningATagSetsUpdated(): void
    {
        $customer = $this->reload($this->createCustomerInThePast());
        $tag = new Tag('Bauherr');
        $this->em()->persist($tag);

        $customer->addTag($tag);
        $this->em()->flush();

        self::assertGreaterThan(new \DateTimeImmutable(self::PAST), $this->reload($customer)->getUpdated());
    }

    public function testFlushingWithoutAChangeKeepsUpdated(): void
    {
        $customer = $this->reload($this->createCustomerInThePast());

        $this->em()->flush();

        self::assertSame(self::PAST, $this->reload($customer)->getUpdated()->format('Y-m-d H:i:s'));
    }

    private function createCustomerInThePast(): Customer
    {
        $customer = (new Customer(Company::forPrivatePerson()))->setLastname('Muster');
        $em = $this->em();
        $em->persist($customer);
        $em->flush();
        self::assertNotNull($customer->getCreated());
        self::assertNotNull($customer->getUpdated());

        $em->createQuery('UPDATE '.Customer::class.' c SET c.created = :past, c.updated = :past WHERE c.id = :id')
            ->setParameter('past', self::PAST)
            ->setParameter('id', $customer->getId())
            ->execute();

        return $customer;
    }

    private function reload(Customer $customer): Customer
    {
        $id = $customer->getId();
        $this->em()->clear();

        return $this->em()->find(Customer::class, $id);
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
