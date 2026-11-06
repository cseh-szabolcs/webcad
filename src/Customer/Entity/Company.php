<?php

namespace App\Customer\Entity;

use App\Core\Traits\Entity\CreatedTrait;
use App\Core\Traits\Entity\UpdatedTrait;
use App\Core\Traits\Entity\UuidAwareTrait;
use App\Customer\Repository\CompanyRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/**
 * The name and contact data of a customer. An organization (a firm, an authority) has a name and
 * can have many customers as its contacts. The company of a private person has no name, as that is
 * the customer's, and only this one customer: Customer's unique index ensures that.
 */
#[ORM\Entity(repositoryClass: CompanyRepository::class)]
#[ORM\HasLifecycleCallbacks]
class Company
{
    use UuidAwareTrait;
    use CreatedTrait;
    use UpdatedTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(options: ['unsigned' => true])]
    private ?int $id = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $email = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $phone = null;

    /**
     * Assigned with Customer::setCompany(), the owning side.
     *
     * @var Collection<int, Customer>
     */
    #[ORM\OneToMany(targetEntity: Customer::class, mappedBy: 'company')]
    private Collection $customers;

    /**
     * @param bool $organization cannot change: Customer::$uniqueCompanyConstraint relies on it
     */
    private function __construct(
        #[ORM\Column(length: 255, nullable: true)]
        private ?string $name,
        #[ORM\Column]
        private bool $organization,
    ) {
        $this->customers = new ArrayCollection();
    }

    public static function forOrganization(string $name): self
    {
        return new self($name, true);
    }

    public static function forPrivatePerson(): self
    {
        return new self(null, false);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    /** Null for a private person. */
    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function isOrganization(): bool
    {
        return $this->organization;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(?string $email): static
    {
        $this->email = $email;

        return $this;
    }

    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function setPhone(?string $phone): static
    {
        $this->phone = $phone;

        return $this;
    }

    /**
     * @return Collection<int, Customer>
     */
    public function getCustomers(): Collection
    {
        return $this->customers;
    }
}
