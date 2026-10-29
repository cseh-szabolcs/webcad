<?php

namespace App\Plan\Dto;

use OpenApi\Attributes as OA;

#[OA\Schema(description: 'A circular arc around a centre. The radius is the distance from centre to start; the end vertex only sets the end angle, so it may lie off the arc.', required: self::ALWAYS_SENT)]
final readonly class ArcElementDto extends AbstractElementDto
{
    public const string TYPE = 'arc';

    public function __construct(
        string $id,
        ?string $layerId,
        ?string $groupId,
        ?string $styleId,
        #[OA\Property(format: 'uuid')]
        public string $centerVertexId,
        #[OA\Property(format: 'uuid')]
        public string $startVertexId,
        #[OA\Property(format: 'uuid')]
        public string $endVertexId,
        #[OA\Property(description: 'Direction from start to end, Y up: false is counter-clockwise.')]
        public bool $clockwise,
        ?string $name = null,
    ) {
        parent::__construct($id, $layerId, $groupId, $styleId, $name);
    }
}
