<?php

namespace App\Core\Tenancy;

/**
 * Building or removing a tenant database failed. The output of the command that failed is part of
 * the message, as it is the only place that says what went wrong.
 */
final class TenantProvisioningException extends \RuntimeException
{
    public static function tenantExists(string $name): self
    {
        return new self(\sprintf('Tenant "%s" exists already.', $name));
    }

    public static function databaseExists(string $database): self
    {
        return new self(\sprintf('Database "%s" exists already, but belongs to no tenant. Drop it or choose another name.', $database));
    }

    public static function fromExitCode(string $command, int $exitCode, string $output): self
    {
        return new self(\sprintf('Command "%s" failed with exit code %d: %s', $command, $exitCode, $output));
    }

    public static function fromThrowable(string $command, \Throwable $previous, string $output): self
    {
        return new self(\sprintf('Command "%s" failed: %s%s', $command, $previous->getMessage(), '' === $output ? '' : ' '.$output), 0, $previous);
    }
}
