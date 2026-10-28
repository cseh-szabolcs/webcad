<?php

namespace App\Domain\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * Elements that are picked together. Membership is stored on the element, not here.
 */
#[ORM\Entity]
#[ORM\Table(name: 'element_group')] // "group" is reserved in SQL
class Group
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
}
