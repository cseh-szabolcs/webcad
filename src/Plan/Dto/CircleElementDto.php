<?php

namespace App\Plan\Dto;

use App\Plan\Enum\Linetype;
use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'A circle around a centre vertex.', required: self::ALWAYS_SENT)]
final readonly class CircleElementDto extends AbstractElementDto
{
    public const string TYPE = 'circle';

    public function __construct(
        string $id,
        string $layerId,
        ?string $groupId,
        ?string $styleId,
        #[OA\Property(format: 'uuid')]
        public string $centerVertexId,
        #[Assert\Positive]
        public float $radius,
        ?string $name = null,
        ?string $color = null,
        ?Linetype $linetype = null,
        ?int $lineweight = null,
        ?int $transparency = null,
    ) {
        parent::__construct($id, $layerId, $groupId, $styleId, $name, $color, $linetype, $lineweight, $transparency);
    }
}
