<?php

namespace App\Customer\Query;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * One page of the companies; also the query string of the list's data route, as
 * assets/scripts/states/remoteListState.js sends it.
 */
final readonly class GetCompanyListQuery
{
    public function __construct(
        #[Assert\Positive]
        public int $page = 1,
        #[Assert\Range(min: 1, max: 100)]
        public int $pageSize = 20,
    ) {
    }
}
