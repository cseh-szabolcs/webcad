<?php

namespace App\Plan\Dto;

use OpenApi\Attributes as OA;

#[OA\Schema(description: 'A relative offset in model space (mm, Y up).')]
final readonly class Vector2Dto
{
    public function __construct(
        public float $x,
        public float $y,
    ) {
    }
}
