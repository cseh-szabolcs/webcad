<?php

namespace App\Customer\Query\Customer;

use App\Customer\Repository\CustomerRepository;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetCustomerCountHandler
{
    public function __construct(
        private CustomerRepository $customers,
    ) {
    }

    public function __invoke(GetCustomerCountQuery $query): int
    {
        return $this->customers->count();
    }
}
