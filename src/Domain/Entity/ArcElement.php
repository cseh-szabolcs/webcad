<?php

namespace App\Domain\Entity;

use App\Domain\ElementProps\ArcProps;
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
        ArcProps $props,
        ?Layer $layer = null,
        ?Group $group = null,
        ?ElementStyle $style = null,
        ?string $name = null,
    ) {
        parent::__construct($id, $planVersion, $position, $props, $layer, $group, $style, $name);
    }

    public function getProps(): ArcProps
    {
        \assert($this->props instanceof ArcProps);

        return $this->props;
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
}
