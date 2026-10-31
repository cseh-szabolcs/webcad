<?php

namespace App\User\Entity;

use App\Core\Constants\Locale;
use App\Core\Constants\Role;
use App\Core\Traits\Entity\CreatedTrait;
use App\Core\Traits\Entity\UpdatedTrait;
use App\Core\Traits\Entity\UuidAwareTrait;
use App\User\Contracts\UserInterface;
use App\User\Repository\UserRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: '`user`')]
#[ORM\HasLifecycleCallbacks]
class User implements UserInterface
{
    use UuidAwareTrait;
    use CreatedTrait;
    use UpdatedTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(options: ['unsigned' => true])]
    private ?int $id = null;

    #[ORM\Column(length: 255, unique: true, index: true)]
    private ?string $email;

    #[ORM\Column(length: 255)]
    private ?string $password = null;

    public ?string $passwordPlain = null;

    #[ORM\Column(length: 255)]
    private ?string $role;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $firstname = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $lastname = null;

    #[ORM\Column(length: 2, nullable: true)]
    private ?string $locale;

    #[ORM\Column]
    private ?bool $termsAgreed;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $confirmedAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $lastAccess;

    public function __construct(
        string $email,
        Role $role = Role::AUTH,
        ?string $locale = null,
        ?bool $termsAgreed = false,
    ) {
        $this->email = $email;
        $this->locale = $locale ?? Locale::getDefault()->value;
        $this->termsAgreed = $termsAgreed;
        $this->lastAccess = new \DateTimeImmutable();
        $this->setRole($role);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = mb_strtolower($email);

        return $this;
    }

    public function getPassword(): ?string
    {
        return $this->password;
    }

    public function setPassword(?string $password): void
    {
        $this->password = $password;
    }

    public function getRole(): Role
    {
        return Role::from($this->role);
    }

    public function setRole(string|Role $role): void
    {
        $this->role = ($role instanceof Role)
            ? $role->value
            : $role;
    }

    public function getRoles(): array
    {
        return [$this->role];
    }

    public function eraseCredentials(): void
    {
        $this->passwordPlain = null;
    }

    public function getUserIdentifier(): string
    {
        return $this->email;
    }

    public function getFirstname(): ?string
    {
        return $this->firstname;
    }

    public function setFirstname(?string $firstname): static
    {
        $this->firstname = is_string($firstname) ? mb_ucfirst($firstname) : null;

        return $this;
    }

    public function getLastname(): ?string
    {
        return $this->lastname;
    }

    public function setLastname(?string $lastname): static
    {
        $this->lastname = is_string($lastname) ? mb_ucfirst($lastname) : null;

        return $this;
    }

    public function getName(): ?string
    {
        if ($this->firstname && $this->lastname) {
            return $this->firstname.' '.$this->lastname;
        }

        if ($this->firstname) {
            return $this->firstname;
        }

        if ($this->lastname) {
            return $this->lastname;
        }

        return null;
    }

    public function getLocale(): string
    {
        return $this->locale;
    }

    public function setLocale(string $locale): static
    {
        $this->locale = $locale;

        return $this;
    }

    public function getConfirmedAt(): ?\DateTimeImmutable
    {
        return $this->confirmedAt;
    }

    public function isConfirmed(): bool
    {
        return null !== $this->confirmedAt;
    }

    public function confirm(): static
    {
        if (null === $this->confirmedAt) {
            $this->confirmedAt = new \DateTimeImmutable();
        }

        return $this;
    }

    public function getLastAccess(): \DateTimeImmutable
    {
        return $this->lastAccess;
    }

    public function refreshLastAccess(): static
    {
        $this->lastAccess = new \DateTimeImmutable();

        return $this;
    }

    public function getAuthSignature(): ?string
    {
        return sha1(sprintf(
            '%s:%s',
            $this->email,
            $this->password,
        ));
    }

    public function hasTermsAgreed(): bool
    {
        return $this->termsAgreed;
    }
}
