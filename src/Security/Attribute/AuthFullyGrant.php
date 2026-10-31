<?php

namespace App\Security\Attribute;

#[\Attribute(\Attribute::TARGET_CLASS | \Attribute::TARGET_METHOD)]
final readonly class AuthFullyGrant extends AuthGrant
{
}
