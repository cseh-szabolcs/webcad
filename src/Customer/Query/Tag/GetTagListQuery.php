<?php

namespace App\Customer\Query\Tag;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * One page of the tags; also the query string of the list's data route, as
 * assets/scripts/states/remoteListState.js sends it.
 */
final readonly class GetTagListQuery
{
    public function __construct(
        #[Assert\Positive]
        public int $page = 1,
        #[Assert\Range(min: 1, max: 100)]
        public int $pageSize = 20,
    ) {
    }
}
