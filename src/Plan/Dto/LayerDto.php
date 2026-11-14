<?php

namespace App\Plan\Dto;

use App\Plan\Enum\Linetype;
use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'A layer of a floor. Elements on a hidden layer are neither drawn nor snapped to nor selectable; those on a locked one cannot be selected. An element without a style is drawn with the colour, linetype and transparency of its layer. Every floor has a layer "0".')]
final readonly class LayerDto
{
    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(format: 'uuid')]
        public string $id,
        #[Assert\Uuid]
        #[OA\Property(description: 'The floor the layer belongs to.', format: 'uuid')]
        public string $floorId,
        #[Assert\NotBlank]
        #[Assert\Length(max: 255)]
        #[OA\Property(description: 'Unique within its floor, whatever the case.', example: 'Walls')]
        public string $name,
        public bool $visible,
        public bool $locked,
        #[Assert\CssColor(Assert\CssColor::HEX_LONG)]
        #[OA\Property(example: '#1f2937')]
        public string $color,
        public Linetype $linetype,
        #[Assert\Range(min: 0, max: 90)]
        #[OA\Property(description: 'In percent: 0 is opaque, 90 the most see-through.')]
        public int $transparency,
        #[Assert\Length(max: 255)]
        #[OA\Property(description: 'Free text; empty for none.', example: 'Load-bearing walls')]
        public string $description,
    ) {
    }
}
