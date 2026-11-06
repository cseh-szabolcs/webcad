<?php

namespace App\Customer\Entity;

use App\Core\Traits\Entity\CreatedTrait;
use App\Core\Traits\Entity\UpdatedTrait;
use App\Core\Traits\Entity\UuidAwareTrait;
use App\Customer\Repository\CustomerRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/**
 * A customer of the office: a contact of an organization or a private person, whose e-mail and
 * phone are in its company in both cases. Every field of its own may stay empty.
 */
#[ORM\Entity(repositoryClass: CustomerRepository::class)]
#[ORM\UniqueConstraint(name: 'uniq_customer_company', columns: ['company_id', 'unique_company_constraint'])]
#[ORM\HasLifecycleCallbacks]
class Customer
{
    use UuidAwareTrait;
    use CreatedTrait;
    use UpdatedTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(options: ['unsigned' => true])]
    private ?int $id = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $firstname = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $lastname = null;

    /**
     * Purely technical: true or null, so the unique index allows a private person's company only
     * one customer (NULLs never collide). Set by setCompany().
     */
    #[ORM\Column(nullable: true)]
    private ?bool $uniqueCompanyConstraint = null;

    /** A company with customers cannot be deleted. */
    #[ORM\ManyToOne(targetEntity: Company::class, cascade: ['persist'], inversedBy: 'customers')]
    #[ORM\JoinColumn(nullable: false)]
    private Company $company;

    /**
     * Deleting a tag keeps its customers.
     *
     * @var Collection<int, Tag>
     */
    #[ORM\ManyToMany(targetEntity: Tag::class)]
    #[ORM\OrderBy(['name' => 'ASC'])]
    private Collection $tags;

    public function __construct(Company $company)
    {
        $this->setCompany($company);
        $this->tags = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getFirstname(): ?string
    {
        return $this->firstname;
    }

    public function setFirstname(?string $firstname): static
    {
        $this->firstname = $firstname;

        return $this;
    }

    public function getLastname(): ?string
    {
        return $this->lastname;
    }

    public function setLastname(?string $lastname): static
    {
        $this->lastname = $lastname;

        return $this;
    }

    public function getCompany(): Company
    {
        return $this->company;
    }

    public function setCompany(Company $company): static
    {
        $this->company = $company;
        $this->uniqueCompanyConstraint = $company->isOrganization() ? null : true;

        return $this;
    }

    /**
     * @return Collection<int, Tag>
     */
    public function getTags(): Collection
    {
        return $this->tags;
    }

    public function addTag(Tag $tag): static
    {
        if (!$this->tags->contains($tag)) {
            $this->tags->add($tag);
        }

        return $this;
    }

    public function removeTag(Tag $tag): static
    {
        $this->tags->removeElement($tag);

        return $this;
    }
}
