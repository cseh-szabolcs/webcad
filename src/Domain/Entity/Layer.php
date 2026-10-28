<?php

namespace App\Domain\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity]
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
        /** Drawing order: a layer with a higher position is drawn on top. */
        #[ORM\Column]
        private int $position,
        #[ORM\Column(length: 255)]
        private string $name,
        #[ORM\Column]
        private bool $visible = true,
        #[ORM\Column]
        private bool $locked = false,
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
}
