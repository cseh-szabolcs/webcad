<?php

namespace App\Plan\Dto;

use App\Plan\Enum\Linetype;
use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'A named set of values elements are drawn with instead of their layer\'s; each is null where the style leaves it to the layer. Only a style gives a fill.', required: ['color', 'linetype', 'lineweight', 'transparency', 'fillColor'])]
final readonly class ElementStyleDto
{
    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(format: 'uuid')]
        public string $id,
        #[Assert\NotBlank]
        #[Assert\Length(max: 255)]
        #[OA\Property(description: 'Unique within the plan, whatever the case.', example: 'Wall')]
        public string $name,
        #[Assert\CssColor(Assert\CssColor::HEX_LONG)]
        #[OA\Property(example: '#1f2937')]
        public ?string $color,
        public ?Linetype $linetype,
        #[Assert\Choice(choices: LayerDto::LINEWEIGHTS)]
        #[OA\Property(description: 'In 1/100 mm, one of AutoCAD\'s lineweights.', example: 50)]
        public ?int $lineweight,
        #[Assert\Range(min: 0, max: 90)]
        #[OA\Property(description: 'In percent: 0 is opaque, 90 the most see-through.')]
        public ?int $transparency,
        #[Assert\CssColor(Assert\CssColor::HEX_LONG)]
        #[OA\Property(description: 'Fill colour of a closed element; null for none.', example: '#dbeafe')]
        public ?string $fillColor,
    ) {
    }
}
