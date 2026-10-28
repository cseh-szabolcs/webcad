<?php

namespace App\Domain\Entity;

use App\Domain\ElementProps\EllipseProps;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Ellipse around a centre vertex; its radii and rotation are its props.
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
        EllipseProps $props,
        ?Layer $layer = null,
        ?Group $group = null,
        ?ElementStyle $style = null,
        ?string $name = null,
    ) {
        parent::__construct($id, $planVersion, $position, $props, $layer, $group, $style, $name);
    }

    public function getProps(): EllipseProps
    {
        \assert($this->props instanceof EllipseProps);

        return $this->props;
    }

    public function getCenterVertex(): Vertex
    {
        return $this->centerVertex;
    }
}
