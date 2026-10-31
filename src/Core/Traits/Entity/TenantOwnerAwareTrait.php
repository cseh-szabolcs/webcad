<?php

namespace App\Core\Traits\Entity;

use Doctrine\ORM\Mapping as ORM;

trait TenantOwnerAwareTrait
{
    use TenantAwareTrait;

    #[ORM\Column(nullable: false, options: ['unsigned' => true])]
    private ?int $ownerId = null;

    public function getOwnerId(): int
    {
        return $this->ownerId;
    }
}
