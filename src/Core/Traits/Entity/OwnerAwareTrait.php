<?php

namespace App\Core\Traits\Entity;

use App\User\Entity\User;
use Doctrine\ORM\Mapping as ORM;

trait OwnerAwareTrait
{
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $owner;

    public function getOwner(): User
    {
        return $this->owner;
    }
}
