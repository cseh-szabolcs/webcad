<?php

namespace App\Plan\Dto;

use OpenApi\Attributes as OA;
use Symfony\Component\Serializer\Attribute\DiscriminatorMap;

#[DiscriminatorMap('type', [
    LineElementDto::TYPE => LineElementDto::class,
    PolylineElementDto::TYPE => PolylineElementDto::class,
    ArcElementDto::TYPE => ArcElementDto::class,
    CircleElementDto::TYPE => CircleElementDto::class,
    EllipseElementDto::TYPE => EllipseElementDto::class,
    BezierElementDto::TYPE => BezierElementDto::class,
])]
#[OA\Schema(description: 'A drawn object of the plan, told apart by its type.')]
interface ElementDtoInterface
{
    // The properties every element type has, declared in AbstractElementDto
    public string $id { get; }

    public ?string $layerId { get; }

    public ?string $groupId { get; }

    public ?string $styleId { get; }

    public ?string $name { get; }
}
