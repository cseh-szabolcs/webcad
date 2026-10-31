<?php

namespace App\Security\Exception;

use Symfony\Component\Security\Core\Exception\AuthenticationException;

/**
 * A login naming a tenant (office) the registry does not have. Its message key is translated in the
 * messages domain, unlike Symfony's own authentication errors (security domain).
 */
final class TenantNotFoundAuthenticationException extends AuthenticationException
{
    public function getMessageKey(): string
    {
        return 'user.login.error.tenant_not_found';
    }
}
