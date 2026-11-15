<?php

namespace App\Plan\Dto;

use App\Plan\Enum\Linetype;
use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'A layer of a floor. Elements on a hidden layer are neither drawn nor snapped to nor selectable; those on a locked one cannot be selected. An element without a style is drawn with the colour, linetype, lineweight and transparency of its layer. Every floor has a layer "0".')]
final readonly class LayerDto
{
    /** AutoCAD's lineweights, in 1/100 mm. */
    public const array LINEWEIGHTS = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];

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
        #[Assert\Choice(choices: self::LINEWEIGHTS)]
        #[OA\Property(description: 'In 1/100 mm, like DXF: one of AutoCAD\'s lineweights.', example: 25)]
        public int $lineweight,
        #[Assert\Length(max: 255)]
        #[OA\Property(description: 'Free text; empty for none.', example: 'Load-bearing walls')]
        public string $description,
    ) {
    }
}
