<?php

namespace App\Infrastructure\Tenancy\Console;

use Symfony\Bundle\FrameworkBundle\Console\Application as BaseApplication;
use Symfony\Component\Console\Input\InputDefinition;
use Symfony\Component\Console\Input\InputOption;

/**
 * The console application of bin/console: every command takes --tenant=<name>, which
 * TenantConsoleListener uses to select the tenant database.
 */
class Application extends BaseApplication
{
    public const string TENANT_OPTION = 'tenant';

    protected function getDefaultInputDefinition(): InputDefinition
    {
        $definition = parent::getDefaultInputDefinition();
        $definition->addOption(new InputOption(
            self::TENANT_OPTION,
            null,
            InputOption::VALUE_REQUIRED,
            'Name of the tenant whose database the command uses',
        ));

        return $definition;
    }
}
