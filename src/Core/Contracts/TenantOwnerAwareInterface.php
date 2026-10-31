<?php

namespace App\Core\Contracts;

interface TenantOwnerAwareInterface extends TenantAwareInterface
{
    public function getOwnerId(): int;
}
