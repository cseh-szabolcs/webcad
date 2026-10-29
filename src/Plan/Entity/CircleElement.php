<?php

namespace App\Plan\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity]
class CircleElement extends Element
{
    public const string TYPE = 'circle';

    public function __construct(
        Uuid $id,
        PlanVersion $planVersion,
        int $position,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(onDelete: 'CASCADE')]
        private Vertex $centerVertex,
        #[ORM\Column(nullable: true)]
        private float $radius,
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

    public function getRadius(): float
    {
        return $this->radius;
    }
}
