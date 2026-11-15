<?php

namespace App\Plan\Entity;

use App\Plan\Enum\Linetype;
use App\Plan\Repository\ElementRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * A drawn object. All types share the table "element" (single table inheritance), so the columns
 * of a subclass must be nullable in the database even where its property is not. Both the
 * structure (vertices, layer, group, style) and the values only needed to draw it (radius,
 * closed, control vectors …) are columns, the latter declared by the subclass they belong to.
 */
#[ORM\Entity(repositoryClass: ElementRepository::class)]
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
    /**
     * What the element is drawn with instead of its style's or its layer's value; null where it
     * overrides nothing. The colour as #rrggbb, the lineweight in 1/100 mm, the transparency in percent.
     */
    #[ORM\Column(length: 32, nullable: true)]
    private ?string $color = null;

    #[ORM\Column(length: 16, nullable: true, enumType: Linetype::class)]
    private ?Linetype $linetype = null;

    #[ORM\Column(type: Types::SMALLINT, nullable: true)]
    private ?int $lineweight = null;

    #[ORM\Column(type: Types::SMALLINT, nullable: true)]
    private ?int $transparency = null;

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
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
        private Layer $layer,
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

    public function getLayer(): Layer
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

    public function getColor(): ?string
    {
        return $this->color;
    }

    public function getLinetype(): ?Linetype
    {
        return $this->linetype;
    }

    public function getLineweight(): ?int
    {
        return $this->lineweight;
    }

    public function getTransparency(): ?int
    {
        return $this->transparency;
    }

    /**
     * Sets what the element overrides; null for each value it takes from its style or its layer.
     */
    public function setAppearance(?string $color, ?Linetype $linetype, ?int $lineweight, ?int $transparency): static
    {
        $this->color = $color;
        $this->linetype = $linetype;
        $this->lineweight = $lineweight;
        $this->transparency = $transparency;

        return $this;
    }
}
