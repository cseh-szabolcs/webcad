<?php

namespace App\Plan\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Circular arc around a centre. The radius is the distance from centre to start; the end vertex
 * only sets the end angle, so it may lie off the arc.
 */
#[ORM\Entity]
class ArcElement extends Element
{
    public const string TYPE = 'arc';

    public function __construct(
        Uuid $id,
        PlanVersion $planVersion,
        int $position,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(onDelete: 'CASCADE')]
        private Vertex $centerVertex,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(onDelete: 'CASCADE')]
        private Vertex $startVertex,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(onDelete: 'CASCADE')]
        private Vertex $endVertex,
        /** Direction from start to end, Y up: false is counter-clockwise. */
        #[ORM\Column(nullable: true)]
        private bool $clockwise,
        ?Layer $layer = null,
        ?Group $group = null,
        ?ElementStyle $style = null,
        ?string $name = null,
    ) {
        parent::__construct($id, $planVersion, $position, $layer, $group, $style, $name);
    }

    public function getCenterVertex(): Vertex
    {
        return $this->centerVertex;
    }

    public function getStartVertex(): Vertex
    {
        return $this->startVertex;
    }

    public function getEndVertex(): Vertex
    {
        return $this->endVertex;
    }

    public function isClockwise(): bool
    {
        return $this->clockwise;
    }
}
