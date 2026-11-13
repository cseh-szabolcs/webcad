<?php

namespace App\Plan\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Segments through its vertices in order, straight or arcs (see PolylineVertex::getBulge); a closed
 * one also joins the last to the first.
 */
#[ORM\Entity]
#[ORM\Table(name: 'plan_poly_element')]
class PolylineElement extends Element
{
    public const string TYPE = 'polyline';

    /** @var Collection<int, PolylineVertex> */
    #[ORM\OneToMany(targetEntity: PolylineVertex::class, mappedBy: 'polyline', cascade: ['persist'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => \SortDirection::Ascending])]
    private Collection $vertices;

    /**
     * @param list<Vertex> $vertices
     * @param list<float>  $bulges   one per vertex, for the segment that starts there; none for all straight
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
        array $bulges = [],
    ) {
        parent::__construct($id, $planVersion, $position, $layer, $group, $style, $name);

        if (\count($vertices) < 2) {
            throw new \InvalidArgumentException('A polyline needs at least 2 vertices.');
        }
        if ([] !== $bulges && \count($bulges) !== \count($vertices)) {
            throw new \InvalidArgumentException('A polyline needs a bulge per vertex, or none.');
        }

        $bulges = array_values($bulges);
        $this->vertices = new ArrayCollection();
        foreach (array_values($vertices) as $i => $vertex) {
            $this->vertices->add(new PolylineVertex($this, $i, $vertex, $bulges[$i] ?? 0.0));
        }
    }

    /**
     * @return list<Vertex>
     */
    public function getVertices(): array
    {
        return array_values($this->vertices->map(static fn (PolylineVertex $v): Vertex => $v->getVertex())->toArray());
    }

    /**
     * @return list<float> one per vertex
     */
    public function getBulges(): array
    {
        return array_values($this->vertices->map(static fn (PolylineVertex $v): float => $v->getBulge())->toArray());
    }

    public function isClosed(): bool
    {
        return $this->closed;
    }
}
