<?php

namespace App\Plan\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Straight segments through its vertices in order; a closed one also joins the last to the first.
 */
#[ORM\Entity]
class PolylineElement extends Element
{
    public const string TYPE = 'polyline';

    /** @var Collection<int, PolylineVertex> */
    #[ORM\OneToMany(targetEntity: PolylineVertex::class, mappedBy: 'polyline', cascade: ['persist'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => \SortDirection::Ascending])]
    private Collection $vertices;

    /**
     * @param list<Vertex> $vertices
     */
    public function __construct(
        Uuid $id,
        PlanVersion $planVersion,
        int $position,
        array $vertices,
        /** A closed polyline also joins its last vertex to the first. */
        #[ORM\Column(nullable: true)]
        private bool $closed,
        ?Layer $layer = null,
        ?Group $group = null,
        ?ElementStyle $style = null,
        ?string $name = null,
    ) {
        parent::__construct($id, $planVersion, $position, $layer, $group, $style, $name);

        if (\count($vertices) < 2) {
            throw new \InvalidArgumentException('A polyline needs at least 2 vertices.');
        }

        $this->vertices = new ArrayCollection();
        foreach (array_values($vertices) as $i => $vertex) {
            $this->vertices->add(new PolylineVertex($this, $i, $vertex));
        }
    }

    /**
     * @return list<Vertex>
     */
    public function getVertices(): array
    {
        return array_values($this->vertices->map(static fn (PolylineVertex $v): Vertex => $v->getVertex())->toArray());
    }

    public function isClosed(): bool
    {
        return $this->closed;
    }
}
