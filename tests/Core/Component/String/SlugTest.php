<?php

namespace App\Tests\Core\Component\String;

use App\Core\Component\String\Slug;
use App\Core\Tenancy\Entity\Tenant;
use PHPUnit\Framework\TestCase;

final class SlugTest extends TestCase
{
    public function testTenantSlugIsLowercaseAsciiJoinedByHyphens(): void
    {
        $slug = static fn (string $name) => Slug::create($name, Tenant::SLUG_SEPARATOR, Tenant::SLUG_LOCALE);

        self::assertSame('demo', $slug('Demo'));
        self::assertSame('mueller-partner-architekten', $slug(' Müller & Partner  Architekten '));
        self::assertSame('strasse-5', $slug('Straße 5'));
        self::assertSame('', $slug(' !! '));
    }

    public function testWithoutLocaleUmlautsLoseTheirDots(): void
    {
        self::assertSame('muller_partner', Slug::create('Müller Partner'));
    }
}
