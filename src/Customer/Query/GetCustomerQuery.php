<?php

namespace App\Customer\Query;

use Symfony\Component\Uid\Uuid;

/** One customer by its public id, for the detail view of the customer list. */
final readonly class GetCustomerQuery
{
    public function __construct(
        public Uuid $id,
    ) {
    }
}
