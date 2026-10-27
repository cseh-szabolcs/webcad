<?php

namespace App\Infrastructure\Tenancy;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * A tenant name that is not in the registry. A 404 over HTTP: a customer this installation does
 * not have.
 */
final class TenantNotFoundException extends NotFoundHttpException
{
    public function __construct(string $name)
    {
        parent::__construct(\sprintf('Tenant "%s" not found.', $name));
    }
}
