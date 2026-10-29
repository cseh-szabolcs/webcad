<?php

namespace App\Tests\Core\Doctrine\Fixtures;

use Symfony\Component\Serializer\Attribute\DiscriminatorMap;

/**
 * A union for JsonDocumentTypeTest: its implementations also carry the "type" of the map.
 */
#[DiscriminatorMap('type', [
    CircleShape::TYPE => CircleShape::class,
    SegmentShape::TYPE => SegmentShape::class,
])]
interface ShapeInterface
{
}
