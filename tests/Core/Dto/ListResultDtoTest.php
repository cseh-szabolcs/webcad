<?php

namespace App\Tests\Core\Dto;

use App\Core\Dto\ListResultDto;
use PHPUnit\Framework\TestCase;

final class ListResultDtoTest extends TestCase
{
    public function testFromItemsReturnsThePage(): void
    {
        $result = ListResultDto::fromItems($this->items(23), 2, 5);

        self::assertSame([6, 7, 8, 9, 10], $this->numbers($result));
        self::assertSame(2, $result->page);
        self::assertSame(5, $result->pageSize);
        self::assertSame(23, $result->total);
    }

    public function testFromItemsReturnsTheShortLastPage(): void
    {
        $result = ListResultDto::fromItems($this->items(23), 5, 5);

        self::assertSame([21, 22, 23], $this->numbers($result));
        self::assertSame(5, $result->page);
    }

    public function testFromItemsBringsAPageBeyondTheLastBackToTheLast(): void
    {
        $result = ListResultDto::fromItems($this->items(23), 99, 5);

        self::assertSame([21, 22, 23], $this->numbers($result));
        self::assertSame(5, $result->page);
    }

    public function testFromItemsOfAnEmptyListIsPageOne(): void
    {
        $result = ListResultDto::fromItems([], 3, 5);

        self::assertSame([], $result->items);
        self::assertSame(1, $result->page);
        self::assertSame(0, $result->total);
    }

    public function testPageCount(): void
    {
        self::assertSame(1, ListResultDto::pageCount(0, 5));
        self::assertSame(1, ListResultDto::pageCount(5, 5));
        self::assertSame(2, ListResultDto::pageCount(6, 5));
        self::assertSame(5, ListResultDto::pageCount(23, 5));
    }

    /**
     * @return list<object{number: int}>
     */
    private function items(int $count): array
    {
        return array_map(static fn (int $number): object => (object) ['number' => $number], range(1, $count));
    }

    /**
     * @return list<int>
     */
    private function numbers(ListResultDto $result): array
    {
        return array_map(static fn (object $item): int => $item->number, $result->items);
    }
}
