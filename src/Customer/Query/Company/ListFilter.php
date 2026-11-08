<?php

namespace App\Customer\Query\Company;

use Symfony\Component\Validator\Constraints as Assert;

/** The filters of the company list, `filter[…]` in the query string: `search` searches name and e-mail. */
final readonly class ListFilter
{
    public function __construct(
        #[Assert\Length(max: 255)]
        public string $search = '',
    ) {
    }
}
