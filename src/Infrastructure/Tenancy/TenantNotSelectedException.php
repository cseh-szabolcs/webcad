<?php

namespace App\Infrastructure\Tenancy;

use App\Infrastructure\Tenancy\Console\Application;

/**
 * What the tenant connection throws instead of connecting while no tenant is selected.
 */
final class TenantNotSelectedException extends \LogicException
{
    public function __construct()
    {
        $message = 'The tenant connection must not be used before a tenant has been selected via TenantSwitcher::switchTo().';
        if ('cli' === \PHP_SAPI) {
            $message .= \sprintf(' When running a command, pass --%s=<name>.', Application::TENANT_OPTION);
        }

        parent::__construct($message);
    }
}
