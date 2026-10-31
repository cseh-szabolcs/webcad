<?php

namespace App\Security\Entity;

use App\Core\Contracts\TenantOwnerAwareInterface;
use App\Core\Tenancy\Entity\Tenant;
use App\Core\Traits\Entity\CreatedTrait;
use App\Core\Traits\Entity\TenantOwnerAwareTrait;
use App\Core\Traits\Entity\UuidTrait;
use App\Security\Repository\TokenRepository;
use App\User\Entity\User;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TokenRepository::class)]
class Token implements TenantOwnerAwareInterface
{
    use UuidTrait;
    use TenantOwnerAwareTrait;
    use CreatedTrait;

    #[ORM\Column(length: 50, index: true)]
    private ?TokenType $type;

    #[ORM\Column(nullable: true)]
    private ?array $payload;

    #[ORM\Column]
    private ?bool $renewable;

    #[ORM\Column(nullable: true)]
    private ?int $ttl;

    public function __construct(
        Tenant $tenant,
        User|int $ownerId,
        TokenType $type,
        ?array $payload = null,
        ?int $ttl = null,
        bool $renewable = false,
    ) {
        $this->tenant = $tenant;
        $this->ownerId = $ownerId instanceof User ? $ownerId->getId() : $ownerId;
        $this->type = $type;
        $this->payload = $payload;
        $this->ttl = $ttl;
        $this->renewable = $renewable;
        $this->setCreated();
    }

    public function getType(): TokenType
    {
        return $this->type;
    }

    public function getPayload(?string $key = null, mixed $default = null): mixed
    {
        if (null === $this->payload) {
            return $default;
        }

        return $key
            ? $this->payload[$key]
            : $this->payload;
    }

    public function getTtl(): ?int
    {
        return $this->ttl;
    }

    public function setTtl(?int $ttl): self
    {
        $this->ttl = $ttl;

        return $this;
    }

    public function isRenewable(): ?bool
    {
        return $this->renewable;
    }

    public function isExpired(?int $ttl = null): bool
    {
        $ttl = $ttl ?? $this->ttl;

        return null !== $ttl && $this->created->getTimestamp() + $ttl < time();
    }

    public function __clone()
    {
        $this->id = null;
        $this->created = null;
        $this->setCreated();
    }

    public function __toString(): string
    {
        return (string) $this->id;
    }
}
