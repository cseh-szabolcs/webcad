<?php

namespace App\Domain\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * Stroke width and dash pattern are rendered in screen pixels for now; model vs. paper units
 * for printing are still undecided.
 */
#[ORM\Entity]
class ElementStyle
{
    /**
     * @param list<float> $dashPattern
     */
    public function __construct(
        #[ORM\Id]
        #[ORM\Column(type: UuidType::NAME, unique: true)]
        private Uuid $id,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
        private PlanVersion $planVersion,
        #[ORM\Column(length: 255)]
        private string $name,
        #[ORM\Column(length: 32)]
        private string $strokeColor,
        #[ORM\Column]
        private float $strokeWidth,
        #[ORM\Column]
        private array $dashPattern = [],
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

    public function getStrokeColor(): string
    {
        return $this->strokeColor;
    }

    public function getStrokeWidth(): float
    {
        return $this->strokeWidth;
    }

    /**
     * @return list<float>
     */
    public function getDashPattern(): array
    {
        return $this->dashPattern;
    }

    public function getFillColor(): ?string
    {
        return $this->fillColor;
    }
}
