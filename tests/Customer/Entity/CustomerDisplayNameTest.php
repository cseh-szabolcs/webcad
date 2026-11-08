<?php

namespace App\Tests\Customer\Entity;

use App\Customer\Entity\Company;
use App\Customer\Entity\Customer;
use PHPUnit\Framework\TestCase;

final class CustomerDisplayNameTest extends TestCase
{
    public function testAContactOfAnOrganizationShowsItsName(): void
    {
        $customer = (new Customer(Company::forOrganization('Muster GmbH')))->setFirstname('Erika')->setLastname('Muster');

        self::assertSame('Muster GmbH', $customer->getDisplayName());
    }

    public function testAPrivatePersonShowsTheNamesThereAre(): void
    {
        foreach ([['Mira', 'Keller', 'Mira Keller'], ['Mira', null, 'Mira'], [null, 'Keller', 'Keller'], [null, null, '']] as [$firstname, $lastname, $expected]) {
            $customer = (new Customer(Company::forPrivatePerson()))->setFirstname($firstname)->setLastname($lastname);

            self::assertSame($expected, $customer->getDisplayName());
        }
    }
}
