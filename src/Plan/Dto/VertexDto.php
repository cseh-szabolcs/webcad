<?php

namespace App\Plan\Dto;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'A point with its own identity in model space (mm, Y up). Several elements may share it.')]
final readonly class VertexDto
{
    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(format: 'uuid')]
        public string $id,
        public float $x,
        public float $y,
    ) {
    }
}
