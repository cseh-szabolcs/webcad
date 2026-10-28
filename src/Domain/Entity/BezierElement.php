<?php

namespace App\Domain\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Cubic Bézier curve. The control vectors are relative to their end vertex, so they move with it.
 */
#[ORM\Entity]
class BezierElement extends Element
{
    public const string TYPE = 'bezier';

    public function __construct(
        Uuid $id,
        PlanVersion $planVersion,
        int $position,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(onDelete: 'CASCADE')]
        private Vertex $startVertex,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(onDelete: 'CASCADE')]
        private Vertex $endVertex,
        #[ORM\Column(nullable: true)]
        private float $startControlX,
        #[ORM\Column(nullable: true)]
        private float $startControlY,
        #[ORM\Column(nullable: true)]
        private float $endControlX,
        #[ORM\Column(nullable: true)]
        private float $endControlY,
        ?Layer $layer = null,
        ?Group $group = null,
        ?ElementStyle $style = null,
        ?string $name = null,
    ) {
        parent::__construct($id, $planVersion, $position, $layer, $group, $style, $name);
    }

    public function getStartVertex(): Vertex
    {
        return $this->startVertex;
    }

    public function getEndVertex(): Vertex
    {
        return $this->endVertex;
    }

    public function getStartControlX(): float
    {
        return $this->startControlX;
    }

    public function getStartControlY(): float
    {
        return $this->startControlY;
    }

    public function getEndControlX(): float
    {
        return $this->endControlX;
    }

    public function getEndControlY(): float
    {
        return $this->endControlY;
    }
}
