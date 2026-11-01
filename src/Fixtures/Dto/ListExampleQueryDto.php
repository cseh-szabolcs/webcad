<?php

namespace App\Fixtures\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/**
 * Query string of the list example's data route, as assets/scripts/states/remoteListState.js
 * sends it: the page (from 1), its size and the sorting (`sort` null for the stored order).
 */
final readonly class ListExampleQueryDto
{
    public function __construct(
        #[Assert\Positive]
        public int $page = 1,
        #[Assert\Range(min: 1, max: 100)]
        public int $pageSize = 20,
        #[Assert\Choice(choices: ['number', 'value'])]
        public ?string $sort = null,
        #[Assert\Choice(choices: ['asc', 'desc'])]
        public string $direction = 'asc',
    ) {
    }
}
