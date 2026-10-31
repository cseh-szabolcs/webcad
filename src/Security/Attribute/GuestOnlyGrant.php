<?php

namespace App\Security\Attribute;

#[\Attribute(\Attribute::TARGET_CLASS | \Attribute::TARGET_METHOD)]
final readonly class GuestOnlyGrant implements GrantInterface
{
    public function __construct(
        public string $redirect = 'app_dashboard',
        public array $params = [],
    ) {
    }
}
