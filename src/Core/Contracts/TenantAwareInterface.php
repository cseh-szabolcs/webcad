<?php

namespace App\Core\Contracts;

use App\Core\Tenancy\Entity\Tenant;

interface TenantAwareInterface
{
    public function getTenant(): Tenant;
}
