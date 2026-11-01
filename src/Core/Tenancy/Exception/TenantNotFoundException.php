<?php

namespace App\Core\Tenancy\Exception;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * A tenant name, hash or uuid that is not in the registry. A 404 over HTTP: a customer this
 * installation does not have.
 */
final class TenantNotFoundException extends NotFoundHttpException
{
    public function __construct(string $identifier)
    {
        parent::__construct(\sprintf('Tenant "%s" not found.', $identifier));
    }
}
