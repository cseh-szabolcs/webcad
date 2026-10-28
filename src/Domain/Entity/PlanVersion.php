<?php

namespace App\Domain\Entity;

use App\Domain\Enum\PlanUnit;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * One state of a plan's drawing: the draft the editor works on, or a published copy of it. The
 * contents (layers, groups, styles, vertices, elements) belong to a version, not to the plan.
 */
#[ORM\Entity]
class PlanVersion
{
    /** Null for a draft; the publish number (1, 2, …) once published. */
    #[ORM\Column(nullable: true)]
    private ?int $number = null;

    /** Optional name given on publishing, to find the version again later; null for a draft. */
    #[ORM\Column(length: 255, nullable: true)]
    private ?string $name = null;

    /**
     * Bumped by every change of the contents; the API sends it as the ETag.
     */
    #[ORM\Column]
    private int $revision = 1;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(type: UuidType::NAME, unique: true)]
        private Uuid $id,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
        private Plan $plan,
        #[ORM\Column(length: 2, enumType: PlanUnit::class)]
        private PlanUnit $unit,
    ) {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getPlan(): Plan
    {
        return $this->plan;
    }

    public function getUnit(): PlanUnit
    {
        return $this->unit;
    }

    public function getNumber(): ?int
    {
        return $this->number;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function isPublished(): bool
    {
        return null !== $this->number;
    }

    public function getRevision(): int
    {
        return $this->revision;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /**
     * Only for Plan::publish(), which hands out the numbers.
     */
    public function markPublished(int $number, ?string $name = null): void
    {
        if ($this->isPublished()) {
            throw new \LogicException(\sprintf('Version "%s" is already published as number %d.', $this->id->toRfc4122(), $this->number));
        }

        $this->number = $number;
        $this->name = $name;
    }
}
