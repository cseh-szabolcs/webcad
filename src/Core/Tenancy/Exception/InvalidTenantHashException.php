<?php

namespace App\Core\Tenancy\Exception;

/**
 * A hash given for a new tenant that cannot be part of a database name (see TenantProvisioner).
 */
final class InvalidTenantHashException extends \InvalidArgumentException
{
}
