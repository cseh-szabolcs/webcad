<?php

namespace App\Plan\Api\Model;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'How an element is drawn. Stroke width and dash pattern are in screen pixels for now.', required: ['fillColor'])]
final readonly class ElementStyle
{
    /**
     * @param list<float> $dashPattern
     */
    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(format: 'uuid')]
        public string $id,
        #[OA\Property(example: 'Wall')]
        public string $name,
        #[OA\Property(example: '#1f2937')]
        public string $strokeColor,
        #[Assert\PositiveOrZero]
        public float $strokeWidth,
        #[OA\Property(description: 'Lengths of dashes and gaps in turn; empty for a solid line.')]
        public array $dashPattern,
        #[OA\Property(description: 'Fill colour of a closed element; null for none.')]
        public ?string $fillColor,
    ) {
    }
}
