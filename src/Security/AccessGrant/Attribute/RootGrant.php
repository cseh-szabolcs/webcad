<?php

namespace App\Security\AccessGrant\Attribute;

use App\Core\Constants\Role;

#[\Attribute(\Attribute::TARGET_CLASS | \Attribute::TARGET_METHOD)]
final readonly class RootGrant extends AuthGrant
{
    public function __construct()
    {
        parent::__construct(role: Role::ROOT);
    }
}
