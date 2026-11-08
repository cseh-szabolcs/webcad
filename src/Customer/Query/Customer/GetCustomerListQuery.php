<?php

namespace App\Customer\Query\Customer;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * One page of the customers; also the query string of the list's data route, as
 * assets/scripts/states/remoteListState.js sends it (filters as `filter[…]`).
 */
final readonly class GetCustomerListQuery
{
    public function __construct(
        #[Assert\Positive]
        public int $page = 1,
        #[Assert\Range(min: 1, max: 100)]
        public int $pageSize = 20,
        #[Assert\Valid]
        public ListFilter $filter = new ListFilter(),
        #[Assert\Choice(choices: ['name', 'updated', 'created'])]
        public string $sort = 'name',
        #[Assert\Choice(choices: ['asc', 'desc'])]
        public string $direction = 'asc',
    ) {
    }
}
