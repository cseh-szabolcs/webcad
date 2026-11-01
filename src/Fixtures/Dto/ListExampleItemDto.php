<?php

namespace App\Fixtures\Dto;

/** One row of the list example. */
final readonly class ListExampleItemDto
{
    public function __construct(
        public int $number,
        public int $value,
    ) {
    }
}
