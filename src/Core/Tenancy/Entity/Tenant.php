<?php

namespace App\Core\Tenancy\Entity;

use App\Core\Contracts\UuidAwareInterface;
use App\Core\Tenancy\Repository\TenantRepository;
use App\Core\Traits\Entity\UuidAwareTrait;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * A customer with a database of its own. Lives in app_main; its name gives the database name
 * (see TenantNaming), which is therefore not stored.
 */
#[ORM\Entity(repositoryClass: TenantRepository::class)]
class Tenant implements UuidAwareInterface
{
    use UuidAwareTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(options: ['unsigned' => true])]
    private ?int $id = null;

    public function __construct(
        #[ORM\Column(length: 40, unique: true)]
        private string $name,
        #[ORM\Column(length: 255)]
        private string $displayName,
    ) {
        $this->uuid = Uuid::v7();
    }

    public function getId(): int
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
