<?php

namespace App\Plan\Entity;

use App\Plan\Enum\Linetype;
use App\Plan\Repository\LayerRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * A layer of a floor. An element without a style is drawn with its colour, linetype and transparency.
 */
#[ORM\Entity(repositoryClass: LayerRepository::class)]
#[ORM\Table(name: 'plan_layer')]
#[ORM\Index(columns: ['plan_version_id', 'position'])]
class Layer
{
    public function __construct(
        #[ORM\Id]
        #[ORM\Column(type: UuidType::NAME, unique: true)]
        private Uuid $id,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
        private PlanVersion $planVersion,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
        private Floor $floor,
        /** Drawing order: a layer with a higher position is drawn on top. */
        #[ORM\Column]
        private int $position,
        #[ORM\Column(length: 255)]
        private string $name,
        #[ORM\Column]
        private bool $visible = true,
        #[ORM\Column]
        private bool $locked = false,
        /** As #rrggbb. */
        #[ORM\Column(length: 32)]
        private string $color = '#000000',
        #[ORM\Column(length: 16, enumType: Linetype::class)]
        private Linetype $linetype = Linetype::Continuous,
        /** In percent, 0 (opaque) to 90. */
        #[ORM\Column(type: Types::SMALLINT)]
        private int $transparency = 0,
        /** In 1/100 mm, one of AutoCAD's lineweights (LayerDto::LINEWEIGHTS). */
        #[ORM\Column(type: Types::SMALLINT)]
        private int $lineweight = 25,
        #[ORM\Column(length: 255)]
        private string $description = '',
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

    public function getFloor(): Floor
    {
        return $this->floor;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function isVisible(): bool
    {
        return $this->visible;
    }

    public function isLocked(): bool
    {
        return $this->locked;
    }

    public function getColor(): string
    {
        return $this->color;
    }

    public function getLinetype(): Linetype
    {
        return $this->linetype;
    }

    public function getTransparency(): int
    {
        return $this->transparency;
    }

    public function getLineweight(): int
    {
        return $this->lineweight;
    }

    public function getDescription(): string
    {
        return $this->description;
    }
}
