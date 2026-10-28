<?php

namespace App\Application\Model\Plan;

use OpenApi\Attributes as OA;
use Symfony\Component\Serializer\Attribute\DiscriminatorMap;

#[DiscriminatorMap('type', [
    LineElement::TYPE => LineElement::class,
    PolylineElement::TYPE => PolylineElement::class,
    ArcElement::TYPE => ArcElement::class,
    CircleElement::TYPE => CircleElement::class,
    EllipseElement::TYPE => EllipseElement::class,
    BezierElement::TYPE => BezierElement::class,
])]
#[OA\Schema(description: 'A drawn object of the plan, told apart by its type.')]
interface ElementInterface
{
    // The properties every element type has, declared in AbstractElement
    public string $id { get; }

    public ?string $layerId { get; }

    public ?string $groupId { get; }

    public ?string $styleId { get; }

    public ?string $name { get; }
}
