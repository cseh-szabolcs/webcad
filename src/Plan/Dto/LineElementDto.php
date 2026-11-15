<?php

namespace App\Plan\Dto;

use App\Plan\Enum\Linetype;
use OpenApi\Attributes as OA;

#[OA\Schema(description: 'A straight line between two vertices.', required: self::ALWAYS_SENT)]
final readonly class LineElementDto extends AbstractElementDto
{
    public const string TYPE = 'line';

    public function __construct(
        string $id,
        string $layerId,
        ?string $groupId,
        ?string $styleId,
        #[OA\Property(format: 'uuid')]
        public string $startVertexId,
        #[OA\Property(format: 'uuid')]
        public string $endVertexId,
        ?string $name = null,
        ?string $color = null,
        ?Linetype $linetype = null,
        ?int $lineweight = null,
        ?int $transparency = null,
    ) {
        parent::__construct($id, $layerId, $groupId, $styleId, $name, $color, $linetype, $lineweight, $transparency);
    }
}
