<?php

namespace App\Security\AccessGrant\Attribute;

#[\Attribute(\Attribute::TARGET_CLASS | \Attribute::TARGET_METHOD)]
final readonly class AuthFullyGrant extends AuthGrant
{
}
