<?php

namespace App\Tests\Infrastructure\Tenancy;

use App\Infrastructure\Tenancy\InvalidTenantNameException;
use App\Infrastructure\Tenancy\TenantNaming;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class TenantNamingTest extends TestCase
{
    public function testDatabaseNameIsPrefixNameSuffix(): void
    {
        self::assertSame('app_acme', (new TenantNaming('app_', ''))->databaseName('acme'));
        self::assertSame('app_acme_2_test', (new TenantNaming('app_', '_test'))->databaseName('acme_2'));
    }

    public function testTenantNameIsTheReverseOfDatabaseName(): void
    {
        self::assertSame('acme', (new TenantNaming('app_', ''))->tenantName('app_acme'));
        self::assertSame('acme_2', (new TenantNaming('app_', '_test'))->tenantName('app_acme_2_test'));

        self::assertNull((new TenantNaming('app_', ''))->tenantName('app_main'));
        self::assertNull((new TenantNaming('app_', ''))->tenantName('other_acme'));
        self::assertNull((new TenantNaming('app_', '_test'))->tenantName('app_acme'));
    }

    #[DataProvider('invalidNames')]
    public function testRejectsInvalidNames(string $name): void
    {
        $this->expectException(InvalidTenantNameException::class);

        (new TenantNaming('app_', ''))->assertValidName($name);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function invalidNames(): iterable
    {
        yield 'empty' => [''];
        yield 'upper case' => ['Acme'];
        yield 'hyphen' => ['acme-ag'];
        yield 'starts with a digit' => ['1acme'];
        yield 'quote' => ['acme`'];
        yield 'too long' => [str_repeat('a', TenantNaming::MAX_LENGTH + 1)];
        yield 'main database' => ['main'];
        yield 'test database' => ['acme_test'];
    }

    public function testAcceptsLongestName(): void
    {
        $this->expectNotToPerformAssertions();

        (new TenantNaming('app_', ''))->assertValidName(str_repeat('a', TenantNaming::MAX_LENGTH));
    }
}
