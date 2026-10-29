<?php

namespace App\Plan\Props;

use Symfony\Component\Serializer\Attribute\DiscriminatorMap;

/**
 * The display values of an element: what the editor needs to draw it beyond its vertices.
 * Stored as a JSON document in element.props (App\Core\Doctrine\JsonDocumentType), so
 * new values need no schema change. The property names and "type" are those of the API's element
 * models, so the normalized props fit them as they are.
 */
#[DiscriminatorMap('type', [
    LineProps::TYPE => LineProps::class,
    PolylineProps::TYPE => PolylineProps::class,
    ArcProps::TYPE => ArcProps::class,
    CircleProps::TYPE => CircleProps::class,
    EllipseProps::TYPE => EllipseProps::class,
    BezierProps::TYPE => BezierProps::class,
])]
interface ElementPropsInterface
{
}
