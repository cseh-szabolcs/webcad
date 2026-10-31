<?php

namespace App\Core\Traits\Entity;

use App\Core\Tenancy\Entity\Tenant;
use Doctrine\ORM\Mapping as ORM;

trait TenantAwareTrait
{
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Tenant $tenant = null;

    public function getTenant(): Tenant
    {
        return $this->tenant;
    }
}
