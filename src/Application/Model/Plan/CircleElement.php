<?php

namespace App\Application\Model\Plan;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'A circle around a centre vertex.', required: self::ALWAYS_SENT)]
final readonly class CircleElement extends AbstractElement
{
    public const string TYPE = 'circle';

    public function __construct(
        string $id,
        ?string $layerId,
        ?string $groupId,
        ?string $styleId,
        #[OA\Property(format: 'uuid')]
        public string $centerVertexId,
        #[Assert\Positive]
        public float $radius,
        ?string $name = null,
    ) {
        parent::__construct($id, $layerId, $groupId, $styleId, $name);
    }
}
