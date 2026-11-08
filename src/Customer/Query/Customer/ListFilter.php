<?php

namespace App\Customer\Query\Customer;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * The filters of the customer list, `filter[…]` in the query string: `search` searches names,
 * company and e-mail, `tag` is the UUID of a tag.
 */
final readonly class ListFilter
{
    public function __construct(
        #[Assert\Length(max: 255)]
        public string $search = '',
        #[Assert\Uuid]
        public ?string $tag = null,
    ) {
    }
}
