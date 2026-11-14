<?php

namespace App\Plan\Dto;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'A storey of the plan, the top of its contents: layers belong to a floor, elements to a layer.')]
final readonly class FloorDto
{
    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(format: 'uuid')]
        public string $id,
        #[Assert\NotBlank]
        #[Assert\Length(max: 255)]
        #[OA\Property(example: 'Ground floor')]
        public string $name,
    ) {
    }
}
