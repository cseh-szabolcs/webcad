<?php

namespace App\Customer\Entity;

use App\Core\Traits\Entity\CreatedTrait;
use App\Core\Traits\Entity\UpdatedTrait;
use App\Core\Traits\Entity\UuidAwareTrait;
use App\Customer\Repository\CompanyRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/** A company: it can have many customers, a customer belongs to at most one company. */
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

    public function __construct(
        #[ORM\Column(length: 255)]
        private string $name,
    ) {
        $this->customers = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
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
