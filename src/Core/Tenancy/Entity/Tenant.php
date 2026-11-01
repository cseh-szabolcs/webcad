<?php

namespace App\Core\Tenancy\Entity;

use App\Core\Contracts\UuidAwareInterface;
use App\Core\Tenancy\Repository\TenantRepository;
use App\Core\Traits\Entity\UuidAwareTrait;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * A customer with a database of its own. Lives in app_main. Its name is what people type to log in,
 * its slug what finds it then (Slug::create() with SLUG_SEPARATOR and SLUG_LOCALE); its hash
 * identifies it inside the application and gives the database name (see TenantProvisioner), which
 * is therefore not stored; its uuid is its public id (e.g. in the tenant cookie).
 */
#[ORM\Entity(repositoryClass: TenantRepository::class)]
class Tenant implements UuidAwareInterface
{
    use UuidAwareTrait;

    public const int NAME_MAX_LENGTH = 50;
    /** Longer than the name: an umlaut becomes two letters */
    public const int SLUG_MAX_LENGTH = 100;
    public const int HASH_MAX_LENGTH = 16;
    /** Login and TenantProvisioner make the slug alike, so a typed name finds its tenant */
    public const string SLUG_SEPARATOR = '-';
    /** Fixed, so a slug never depends on the locale of the request or command ("ü" becomes "ue") */
    public const string SLUG_LOCALE = 'de';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(options: ['unsigned' => true])]
    private ?int $id = null;

    public function __construct(
        #[ORM\Column(length: self::NAME_MAX_LENGTH)]
        private string $name,
        #[ORM\Column(length: self::SLUG_MAX_LENGTH, unique: true)]
        private string $slug,
        #[ORM\Column(length: self::HASH_MAX_LENGTH, unique: true)]
        private string $hash,
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

    public function getSlug(): string
    {
        return $this->slug;
    }

    public function getHash(): string
    {
        return $this->hash;
    }
}
