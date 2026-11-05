<?php

namespace App\Customer\Query;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * One page of the customers; also the query string of the list's data route, as
 * assets/controllers/page/customer/customer_list_controller.js sends it. `query` searches names,
 * company and e-mail, `tag` is the UUID of a tag.
 */
final readonly class GetCustomerListQuery
{
    public function __construct(
        #[Assert\Positive]
        public int $page = 1,
        #[Assert\Range(min: 1, max: 100)]
        public int $pageSize = 20,
        #[Assert\Length(max: 255)]
        public string $query = '',
        #[Assert\Uuid]
        public ?string $tag = null,
        #[Assert\Choice(choices: ['name', 'updated', 'created'])]
        public string $sort = 'name',
        #[Assert\Choice(choices: ['asc', 'desc'])]
        public string $direction = 'asc',
    ) {
    }
}
