<?php

namespace App\Security\Model;

use App\Core\Component\String\Slug;
use App\Core\Tenancy\Entity\Tenant;

final readonly class Credentials
{
    /** The tenant is found by the slug of the typed name, made as TenantProvisioner makes it */
    public string $tenantSlug;

    public function __construct(
        public string $tenantName,
        public string $identifier,
        public string $password,
    ) {
        $this->tenantSlug = Slug::create($tenantName, Tenant::SLUG_SEPARATOR, Tenant::SLUG_LOCALE);
    }
}
