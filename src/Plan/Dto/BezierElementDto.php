<?php

namespace App\Plan\Dto;

use App\Plan\Enum\Linetype;
use OpenApi\Attributes as OA;

#[OA\Schema(description: 'A cubic Bézier curve. Each control vector is relative to its end vertex, so it moves with it.', required: self::ALWAYS_SENT)]
final readonly class BezierElementDto extends AbstractElementDto
{
    public const string TYPE = 'bezier';

    public function __construct(
        string $id,
        string $layerId,
        ?string $groupId,
        ?string $styleId,
        #[OA\Property(format: 'uuid')]
        public string $startVertexId,
        #[OA\Property(format: 'uuid')]
        public string $endVertexId,
        public Vector2Dto $startControl,
        public Vector2Dto $endControl,
        ?string $name = null,
        ?string $color = null,
        ?Linetype $linetype = null,
        ?int $lineweight = null,
        ?int $transparency = null,
    ) {
        parent::__construct($id, $layerId, $groupId, $styleId, $name, $color, $linetype, $lineweight, $transparency);
    }
}
