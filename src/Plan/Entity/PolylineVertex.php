<?php

namespace App\Plan\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * The vertex at one position of a polyline. A row of its own because the order matters and the
 * same vertex may appear more than once.
 */
#[ORM\Entity]
class PolylineVertex
{
    public function __construct(
        #[ORM\Id]
        #[ORM\ManyToOne(inversedBy: 'vertices')]
        #[ORM\JoinColumn(onDelete: 'CASCADE')]
        private PolylineElement $polyline,
        #[ORM\Id]
        #[ORM\Column]
        private int $position,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
        private Vertex $vertex,
    ) {
    }

    public function getPolyline(): PolylineElement
    {
        return $this->polyline;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function getVertex(): Vertex
    {
        return $this->vertex;
    }
}
