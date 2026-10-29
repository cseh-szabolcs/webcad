<?php

namespace App\Plan\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Cubic Bézier curve between two vertices. Each control vector is relative to its end vertex, so
 * it moves with it.
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
        #[ORM\Embedded(columnPrefix: 'start_control_')]
        private Vector2 $startControl,
        #[ORM\Embedded(columnPrefix: 'end_control_')]
        private Vector2 $endControl,
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

    public function getStartControl(): Vector2
    {
        return $this->startControl;
    }

    public function getEndControl(): Vector2
    {
        return $this->endControl;
    }
}
