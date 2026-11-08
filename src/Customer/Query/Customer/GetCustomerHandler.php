<?php

namespace App\Customer\Query\Customer;

use App\Customer\Dto\CustomerListItemDto;
use App\Customer\Repository\CustomerRepository;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetCustomerHandler
{
    public function __construct(
        private CustomerRepository $customers,
    ) {
    }

    public function __invoke(GetCustomerQuery $query): ?CustomerListItemDto
    {
        $customer = $this->customers->findOneForDetail($query->id);

        return null !== $customer ? CustomerListItemDto::fromEntity($customer) : null;
    }
}
