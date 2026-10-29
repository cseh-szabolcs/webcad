<?php

namespace App\Plan\Api\Model;

use OpenApi\Attributes as OA;
use Symfony\Component\Validator\Constraints as Assert;

#[OA\Schema(description: 'An ellipse around a centre vertex: radiusX along its first axis, radiusY across it (either may be the longer one).', required: self::ALWAYS_SENT)]
final readonly class EllipseElement extends AbstractElement
{
    public const string TYPE = 'ellipse';

    public function __construct(
        string $id,
        ?string $layerId,
        ?string $groupId,
        ?string $styleId,
        #[OA\Property(format: 'uuid')]
        public string $centerVertexId,
        #[Assert\Positive]
        public float $radiusX,
        #[Assert\Positive]
        public float $radiusY,
        #[OA\Property(description: 'Angle of the first axis in radians, counter-clockwise from +X (Y up); 0 is axis-aligned.')]
        public float $rotation = 0.0,
        ?string $name = null,
    ) {
        parent::__construct($id, $layerId, $groupId, $styleId, $name);
    }
}
