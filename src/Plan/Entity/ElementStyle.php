<?php

namespace App\Plan\Entity;

use App\Plan\Enum\Linetype;
use App\Plan\Repository\ElementStyleRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * A named set of values elements are drawn with instead of their layer's. Each value is optional:
 * null leaves it to the layer. Only a style gives a fill.
 */
#[ORM\Entity(repositoryClass: ElementStyleRepository::class)]
#[ORM\Table(name: 'plan_element_style')]
class ElementStyle
{
    public function __construct(
        #[ORM\Id]
        #[ORM\Column(type: UuidType::NAME, unique: true)]
        private Uuid $id,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
        private PlanVersion $planVersion,
        #[ORM\Column(length: 255)]
        private string $name,
        /** As #rrggbb. */
        #[ORM\Column(length: 32, nullable: true)]
        private ?string $color = null,
        #[ORM\Column(length: 16, nullable: true, enumType: Linetype::class)]
        private ?Linetype $linetype = null,
        /** In 1/100 mm, one of AutoCAD's lineweights (LayerDto::LINEWEIGHTS). */
        #[ORM\Column(type: Types::SMALLINT, nullable: true)]
        private ?int $lineweight = null,
        /** In percent, 0 (opaque) to 90. */
        #[ORM\Column(type: Types::SMALLINT, nullable: true)]
        private ?int $transparency = null,
        /** Fill of a closed element as #rrggbb; null for none. */
        #[ORM\Column(length: 32, nullable: true)]
        private ?string $fillColor = null,
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

    public function getName(): string
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

    public function getFillColor(): ?string
    {
        return $this->fillColor;
    }
}
