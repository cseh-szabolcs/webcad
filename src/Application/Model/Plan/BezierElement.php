<?php

namespace App\Application\Model\Plan;

use OpenApi\Attributes as OA;

#[OA\Schema(description: 'A cubic Bézier curve. Each control vector is relative to its end vertex, so it moves with it.', required: self::ALWAYS_SENT)]
final readonly class BezierElement extends AbstractElement
{
    public const string TYPE = 'bezier';

    public function __construct(
        string $id,
        ?string $layerId,
        ?string $groupId,
        ?string $styleId,
        #[OA\Property(format: 'uuid')]
        public string $startVertexId,
        #[OA\Property(format: 'uuid')]
        public string $endVertexId,
        public Vector2 $startControl,
        public Vector2 $endControl,
        ?string $name = null,
    ) {
        parent::__construct($id, $layerId, $groupId, $styleId, $name);
    }
}
