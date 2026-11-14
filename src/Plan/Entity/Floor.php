<?php

namespace App\Plan\Entity;

use App\Plan\Repository\FloorRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * A storey of the plan, the top of its contents: layers belong to a floor, elements to a layer.
 */
#[ORM\Entity(repositoryClass: FloorRepository::class)]
#[ORM\Table(name: 'plan_floor')]
#[ORM\Index(columns: ['plan_version_id', 'position'])]
class Floor
{
    public function __construct(
        #[ORM\Id]
        #[ORM\Column(type: UuidType::NAME, unique: true)]
        private Uuid $id,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
        private PlanVersion $planVersion,
        /** Order of the floors, as their tabs show them. */
        #[ORM\Column]
        private int $position,
        #[ORM\Column(length: 255)]
        private string $name,
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
}
