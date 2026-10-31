<?php

namespace App\Core\Contracts;

use App\User\Entity\User;

interface OwnerAwareInterface
{
    public function getOwner(): User;
}
