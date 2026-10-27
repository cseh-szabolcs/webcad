<?php

namespace App\Domain\Main\Entity;

use App\Infrastructure\Tenancy\TenantRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * A customer with a database of its own. Lives in app_main; its name gives the database name
 * (see TenantNaming), which is therefore not stored.
 */
#[ORM\Entity(repositoryClass: TenantRepository::class)]
class Tenant
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    public function __construct(
        #[ORM\Column(length: 40, unique: true)]
        private string $name,
        #[ORM\Column(length: 255)]
        private string $displayName,
    ) {
        $this->id = Uuid::v7();
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getDisplayName(): string
    {
        return $this->displayName;
    }
}
