<?php

namespace App\Plan\Entity;

use App\Plan\Props\BezierProps;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Cubic Bézier curve between two vertices; its control vectors are its props.
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
        BezierProps $props,
        ?Layer $layer = null,
        ?Group $group = null,
        ?ElementStyle $style = null,
        ?string $name = null,
    ) {
        parent::__construct($id, $planVersion, $position, $props, $layer, $group, $style, $name);
    }

    public function getProps(): BezierProps
    {
        \assert($this->props instanceof BezierProps);

        return $this->props;
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
