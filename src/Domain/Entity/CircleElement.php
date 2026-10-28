<?php

namespace App\Domain\Entity;

use App\Domain\ElementProps\CircleProps;
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
        CircleProps $props,
        ?Layer $layer = null,
        ?Group $group = null,
        ?ElementStyle $style = null,
        ?string $name = null,
    ) {
        parent::__construct($id, $planVersion, $position, $props, $layer, $group, $style, $name);
    }

    public function getProps(): CircleProps
    {
        \assert($this->props instanceof CircleProps);

        return $this->props;
    }

    public function getCenterVertex(): Vertex
    {
        return $this->centerVertex;
    }
}
