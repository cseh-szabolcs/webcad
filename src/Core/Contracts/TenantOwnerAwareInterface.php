<?php

namespace App\Core\Contracts;

use App\Core\Tenancy\Entity\Tenant;

interface TenantOwnerAwareInterface extends TenantAwareInterface
{
    public function getOwnerId(): int;
}
