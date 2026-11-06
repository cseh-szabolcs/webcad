<?php

namespace App\Tests\Customer\Entity;

use App\Core\Tenancy\TenantSwitcher;
use App\Customer\Entity\Company;
use App\Customer\Entity\Customer;
use Doctrine\DBAL\Exception\ForeignKeyConstraintViolationException;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/** Against the test database: what the schema itself ensures about a customer's company. */
final class CustomerCompanyTest extends KernelTestCase
{
    protected function setUp(): void
    {
        // Without a request or console command, nothing selects the tenant (see .env.test)
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
    }

    public function testAPrivateCompanyIsSavedWithItsCustomer(): void
    {
        $company = Company::forPrivatePerson()->setEmail('jonas@example.com');
        $em = $this->em();
        $em->persist(new Customer($company));
        $em->flush();
        $id = $company->getId();
        $em->clear();

        $company = $em->find(Company::class, $id);
        self::assertFalse($company->isOrganization());
        self::assertNull($company->getName());
        self::assertSame('jonas@example.com', $company->getEmail());
        self::assertCount(1, $company->getCustomers());
    }

    public function testAnOrganizationCanHaveManyCustomers(): void
    {
        $company = Company::forOrganization('Muster GmbH');
        $em = $this->em();
        $em->persist(new Customer($company));
        $em->persist(new Customer($company));
        $em->flush();
        $id = $company->getId();
        $em->clear();

        $company = $em->find(Company::class, $id);
        self::assertTrue($company->isOrganization());
        self::assertCount(2, $company->getCustomers());
    }

    public function testAPrivateCompanyCannotHaveASecondCustomer(): void
    {
        $company = Company::forPrivatePerson();
        $em = $this->em();
        $em->persist(new Customer($company));
        $em->persist(new Customer($company));

        $this->expectException(UniqueConstraintViolationException::class);
        $em->flush();
    }

    public function testACustomerCannotMoveToAPrivateCompanyInUse(): void
    {
        $company = Company::forPrivatePerson();
        $moved = new Customer(Company::forOrganization('Muster GmbH'));
        $em = $this->em();
        $em->persist(new Customer($company));
        $em->persist($moved);
        $em->flush();

        $moved->setCompany($company);

        $this->expectException(UniqueConstraintViolationException::class);
        $em->flush();
    }

    public function testACustomerLeavingAPrivateCompanyFreesIt(): void
    {
        $company = Company::forPrivatePerson();
        $customer = new Customer($company);
        $em = $this->em();
        $em->persist($customer);
        $em->flush();

        // Two flushes: within one, Doctrine inserts the new customer before it updates the old one.
        $customer->setCompany(Company::forOrganization('Muster GmbH'));
        $em->flush();
        $em->persist(new Customer($company));
        $em->flush();

        $em->clear();
        self::assertCount(1, $em->find(Company::class, $company->getId())->getCustomers());
    }

    public function testACompanyWithCustomersCannotBeDeleted(): void
    {
        $company = Company::forOrganization('Muster GmbH');
        $em = $this->em();
        $em->persist(new Customer($company));
        $em->flush();

        $em->remove($company);

        $this->expectException(ForeignKeyConstraintViolationException::class);
        $em->flush();
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
