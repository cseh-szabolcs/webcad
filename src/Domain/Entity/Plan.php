<?php

namespace App\Domain\Entity;

use App\Domain\Enum\PlanUnit;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * One drawing of a project, e.g. a floor plan. Its contents live in versions: the editor works on
 * the draft, and publishing makes a copy of it the head. Earlier heads stay as history.
 *
 * Plan and version refer to each other, so draft_id and head_id are nullable in the database
 * (MySQL has no deferred constraints; Doctrine inserts the plan first and sets draft_id after),
 * and SET NULL on delete, or deleting a plan would be blocked by the versions it cascades to.
 */
#[ORM\Entity]
class Plan
{
    #[ORM\OneToOne(cascade: ['persist'])]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private PlanVersion $draft;

    #[ORM\OneToOne]
    #[ORM\JoinColumn(onDelete: 'SET NULL')]
    private ?PlanVersion $head = null;

    /** Number of the last publish; 0 while nothing is published. */
    #[ORM\Column]
    private int $version = 0;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(type: UuidType::NAME, unique: true)]
        private Uuid $id,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
        private Project $project,
        #[ORM\Column(length: 255)]
        private string $name,
        PlanUnit $unit,
    ) {
        $this->draft = new PlanVersion(Uuid::v7(), $this, $unit);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getProject(): Project
    {
        return $this->project;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getDraft(): PlanVersion
    {
        return $this->draft;
    }

    public function getHead(): ?PlanVersion
    {
        return $this->head;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    /**
     * Makes a copy of the draft the published head (see PlanVersionCopier); the draft itself stays
     * the one the editor works on. The name, if any, helps to find the version again later.
     *
     * @throws \InvalidArgumentException when the version is not an unpublished copy of this plan
     */
    public function publish(PlanVersion $copy, ?string $name = null): void
    {
        if ($copy->getPlan() !== $this) {
            throw new \InvalidArgumentException('The version belongs to another plan.');
        }
        if ($copy === $this->draft) {
            throw new \InvalidArgumentException('The draft cannot be published itself, only a copy of it.');
        }
        if ($copy->isPublished()) {
            throw new \InvalidArgumentException(\sprintf('The version is already published as number %d.', $copy->getNumber()));
        }

        ++$this->version;
        $copy->markPublished($this->version, $name);
        $this->head = $copy;
    }
}
