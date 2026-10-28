<?php

namespace App\Domain\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Ellipse around a centre: radiusX along its first axis, radiusY across it (either may be the
 * longer one). The rotation is the angle of the first axis in radians, counter-clockwise from +X
 * (Y up); 0 is an axis-aligned ellipse.
 */
#[ORM\Entity]
class EllipseElement extends Element
{
    public const string TYPE = 'ellipse';

    public function __construct(
        Uuid $id,
        PlanVersion $planVersion,
        int $position,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(onDelete: 'CASCADE')]
        private Vertex $centerVertex,
        #[ORM\Column(nullable: true)]
        private float $radiusX,
        #[ORM\Column(nullable: true)]
        private float $radiusY,
        #[ORM\Column(nullable: true)]
        private float $rotation = 0.0,
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

    public function getRadiusX(): float
    {
        return $this->radiusX;
    }

    public function getRadiusY(): float
    {
        return $this->radiusY;
    }

    public function getRotation(): float
    {
        return $this->rotation;
    }
}
