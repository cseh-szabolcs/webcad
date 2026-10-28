<?php

namespace App\Domain\Entity;

use App\Domain\ElementProps\ElementPropsInterface;
use App\Infrastructure\Doctrine\JsonDocumentType;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * A drawn object. All types share the table "element" (single table inheritance), so the columns
 * of a subclass must be nullable in the database even where its property is not. The structure
 * (vertices, layer, group, style) is mapped as columns; the values only needed to draw it are
 * its props, stored as a JSON document (see JsonDocumentType).
 */
#[ORM\Entity]
#[ORM\InheritanceType('SINGLE_TABLE')]
#[ORM\DiscriminatorColumn(name: 'type', type: 'string', length: 16)]
#[ORM\DiscriminatorMap([
    LineElement::TYPE => LineElement::class,
    PolylineElement::TYPE => PolylineElement::class,
    ArcElement::TYPE => ArcElement::class,
    CircleElement::TYPE => CircleElement::class,
    EllipseElement::TYPE => EllipseElement::class,
    BezierElement::TYPE => BezierElement::class,
])]
#[ORM\Index(columns: ['plan_version_id', 'position'])]
abstract class Element
{
    public function __construct(
        #[ORM\Id]
        #[ORM\Column(type: UuidType::NAME, unique: true)]
        private Uuid $id,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
        private PlanVersion $planVersion,
        /** Document order; within a layer, a higher position is drawn on top. */
        #[ORM\Column]
        private int $position,
        #[ORM\Column(type: JsonDocumentType::NAME)]
        protected ElementPropsInterface $props,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(onDelete: 'SET NULL')]
        private ?Layer $layer = null,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(onDelete: 'SET NULL')]
        private ?Group $group = null,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(onDelete: 'SET NULL')]
        private ?ElementStyle $style = null,
        /** Optional display name, e.g. "Door swing"; the id stays the identity. */
        #[ORM\Column(length: 255, nullable: true)]
        private ?string $name = null,
    ) {
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getPlanVersion(): PlanVersion
    {
        return $this->planVersion;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function getProps(): ElementPropsInterface
    {
        return $this->props;
    }

    public function getLayer(): ?Layer
    {
        return $this->layer;
    }

    public function getGroup(): ?Group
    {
        return $this->group;
    }

    public function getStyle(): ?ElementStyle
    {
        return $this->style;
    }

    public function getName(): ?string
    {
        return $this->name;
    }
}
