<?php

namespace App\Infrastructure\Tenancy;

use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Tenant names and the database each one gets: <prefix><name><suffix>, e.g. app_acme (dev) or
 * app_acme_test (test). "main" and names ending in "_test" are reserved, so no tenant database
 * can be app_main or the test database of another tenant.
 */
final readonly class TenantNaming
{
    public const int MAX_LENGTH = 40;

    private const string PATTERN = '/^[a-z][a-z0-9_]*$/';
    private const string RESERVED_NAME = 'main';
    private const string RESERVED_ENDING = '_test';

    public function __construct(
        #[Autowire(param: 'app.tenant_database_prefix')]
        private string $prefix,
        #[Autowire(param: 'app.tenant_database_suffix')]
        private string $suffix,
    ) {
    }

    /**
     * @throws InvalidTenantNameException
     */
    public function assertValidName(string $name): void
    {
        if (\strlen($name) > self::MAX_LENGTH || 1 !== preg_match(self::PATTERN, $name)) {
            throw new InvalidTenantNameException(\sprintf('Invalid tenant name "%s": only lowercase letters, digits and "_", starting with a letter, at most %d characters.', $name, self::MAX_LENGTH));
        }

        if (self::RESERVED_NAME === $name || str_ends_with($name, self::RESERVED_ENDING)) {
            throw new InvalidTenantNameException(\sprintf('Invalid tenant name "%s": "%s" and names ending in "%s" are reserved.', $name, self::RESERVED_NAME, self::RESERVED_ENDING));
        }
    }

    /**
     * @throws InvalidTenantNameException
     */
    public function databaseName(string $name): string
    {
        $this->assertValidName($name);

        return $this->prefix.$name.$this->suffix;
    }
}
