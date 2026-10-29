<?php

namespace App\Plan\Api\Model;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * The properties every element type has, as ElementInterface declares them. A base class rather
 * than a discriminator on a class, which would publish its properties next to the oneOf.
 */
abstract readonly class AbstractElement implements ElementInterface
{
    /**
     * Always sent, null or not. Nelmio leaves a nullable property out of "required", so every
     * element type names them in its #[OA\Schema].
     */
    public const array ALWAYS_SENT = ['layerId', 'groupId', 'styleId'];

    public function __construct(
        #[Assert\Uuid]
        #[OA\Property(format: 'uuid')]
        public string $id,
        #[OA\Property(description: 'Layer of the element; null for none.', format: 'uuid')]
        public ?string $layerId,
        #[OA\Property(description: 'Group of the element; null for none.', format: 'uuid')]
        public ?string $groupId,
        #[OA\Property(description: 'Style of the element; null for the default style.', format: 'uuid')]
        public ?string $styleId,
        #[OA\Property(description: 'Optional display name; the id stays the identity.', example: 'Door swing')]
        public ?string $name = null,
    ) {
    }
}
