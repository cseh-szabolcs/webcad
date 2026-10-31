<?php

namespace App\Core\Traits\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Serializer\Attribute\SerializedName;
use Symfony\Component\Uid\Uuid;

trait UuidAwareTrait
{
    #[SerializedName('id')]
    #[ORM\Column(type: UuidType::NAME, unique: true, index: true)]
    private ?Uuid $uuid = null;

    #[Groups(['app', 'editor'])]
    public function getUuid(): Uuid
    {
        return $this->uuid;
    }

    #[ORM\PrePersist]
    public function generateUuid(): void
    {
        if (null === $this->uuid) {
            $this->uuid = Uuid::v4();
        }
    }
}
