<?php

namespace App\Plan\Dto;

use App\Plan\Enum\Linetype;
use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * The properties every element type has, as ElementDtoInterface declares them. A base class rather
 * than a discriminator on a class, which would publish its properties next to the oneOf.
 */
abstract readonly class AbstractElementDto implements ElementDtoInterface
{
    /**
     * Always sent, null or not. Nelmio leaves a nullable property out of "required", so every
     * element type names them in its #[OA\Schema].
     */
    public const array ALWAYS_SENT = ['groupId', 'styleId'];

    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(format: 'uuid')]
        public string $id,
        #[Assert\Uuid]
        #[OA\Property(description: 'Layer of the element.', format: 'uuid')]
        public string $layerId,
        #[OA\Property(description: 'Group of the element; null for none.', format: 'uuid')]
        public ?string $groupId,
        #[OA\Property(description: 'Style of the element; null to draw it with the colour, linetype, lineweight and transparency of its layer.', format: 'uuid')]
        public ?string $styleId,
        #[OA\Property(description: 'Optional display name; the id stays the identity.', example: 'Door swing')]
        public ?string $name = null,
        #[Assert\CssColor(Assert\CssColor::HEX_LONG)]
        #[OA\Property(description: 'Colour of this element; null for that of its style or its layer.', example: '#b45309')]
        public ?string $color = null,
        #[OA\Property(description: 'Linetype of this element; null for that of its style or its layer.')]
        public ?Linetype $linetype = null,
        #[Assert\Choice(choices: LayerDto::LINEWEIGHTS)]
        #[OA\Property(description: 'Lineweight of this element in 1/100 mm; null for that of its style or its layer.', example: 50)]
        public ?int $lineweight = null,
        #[Assert\Range(min: 0, max: 90)]
        #[OA\Property(description: 'Transparency of this element in percent; null for that of its layer.')]
        public ?int $transparency = null,
    ) {
    }
}
