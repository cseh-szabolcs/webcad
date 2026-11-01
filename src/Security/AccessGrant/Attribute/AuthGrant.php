<?php

namespace App\Security\AccessGrant\Attribute;

use App\Core\Constants\Role;

#[\Attribute(\Attribute::TARGET_CLASS | \Attribute::TARGET_METHOD)]
readonly class AuthGrant implements GrantInterface
{
    public function __construct(
        public string|Role|null $role = null,
    ) {
    }
}
