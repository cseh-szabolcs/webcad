<?php

namespace App\Core\Dto;

/**
 * One page of a list, as every list route returns it to the client
 * (assets/scripts/states/remoteListState.js): the items of the page, the page actually returned
 * (from 1), the page size and the number of all items, from which the client knows the last page.
 *
 * @template T of object
 */
final readonly class ListResultDto
{
    /**
     * @param list<T> $items
     */
    public function __construct(
        public array $items,
        public int $page,
        public int $pageSize,
        public int $total,
    ) {
    }

    /**
     * The page `$page` of all `$items`, for a list held in memory. A page beyond the last one
     * becomes the last one (page 1 for an empty list), so the client can correct its address.
     *
     * @template U of object
     *
     * @param list<U> $items
     *
     * @return self<U>
     */
    public static function fromItems(array $items, int $page, int $pageSize): self
    {
        $total = count($items);
        $page = min(max(1, $page), self::pageCount($total, $pageSize));

        return new self(
            items: array_slice($items, ($page - 1) * $pageSize, $pageSize),
            page: $page,
            pageSize: $pageSize,
            total: $total,
        );
    }

    /** Number of pages for `$total` items; at least 1, so an empty list has one page. */
    public static function pageCount(int $total, int $pageSize): int
    {
        return max(1, (int) ceil($total / $pageSize));
    }
}
