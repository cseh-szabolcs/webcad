<?php

namespace App\Plan\Entity;

use App\Plan\Props\LineProps;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity]
class LineElement extends Element
{
    public const string TYPE = 'line';

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
        LineProps $props = new LineProps(),
        ?Layer $layer = null,
        ?Group $group = null,
        ?ElementStyle $style = null,
        ?string $name = null,
    ) {
        parent::__construct($id, $planVersion, $position, $props, $layer, $group, $style, $name);
    }

    public function getProps(): LineProps
    {
        \assert($this->props instanceof LineProps);

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
