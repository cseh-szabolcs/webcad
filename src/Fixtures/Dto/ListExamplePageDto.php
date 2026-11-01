<?php

namespace App\Fixtures\Dto;

/**
 * One page of the list example, in the shape assets/scripts/states/remoteListState.js reads:
 * the items of the page, the number of all items and the page actually returned (a page beyond
 * the last one is brought back to the last).
 */
final readonly class ListExamplePageDto
{
    /**
     * @param list<ListExampleItemDto> $items
     */
    public function __construct(
        public array $items,
        public int $total,
        public int $page,
        public int $pageSize,
    ) {
    }
}
