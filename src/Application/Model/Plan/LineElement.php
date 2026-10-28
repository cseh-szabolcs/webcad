<?php

namespace App\Application\Model\Plan;

use OpenApi\Attributes as OA;

#[OA\Schema(description: 'A straight line between two vertices.', required: self::ALWAYS_SENT)]
final readonly class LineElement extends AbstractElement
{
    public const string TYPE = 'line';

    public function __construct(
        string $id,
        ?string $layerId,
        ?string $groupId,
        ?string $styleId,
        #[OA\Property(format: 'uuid')]
        public string $startVertexId,
        #[OA\Property(format: 'uuid')]
        public string $endVertexId,
        ?string $name = null,
    ) {
        parent::__construct($id, $layerId, $groupId, $styleId, $name);
    }
}
