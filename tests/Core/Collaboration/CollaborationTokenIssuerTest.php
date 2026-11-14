<?php

namespace App\Tests\Core\Collaboration;

use App\Core\Collaboration\CollaborationTokenIssuer;
use PHPUnit\Framework\TestCase;

final class CollaborationTokenIssuerTest extends TestCase
{
    public function testTokenCarriesTheClaimsAndAVerifiableSignature(): void
    {
        $now = new \DateTimeImmutable('2026-11-13 12:00:00');
        $token = (new CollaborationTokenIssuer('secret'))->issue('tenant-uuid', 'project-uuid', 'user-uuid', 'Erika Muster', $now);

        [$payload, $signature] = explode('.', $token);
        self::assertSame($this->base64url(hash_hmac('sha256', $payload, 'secret', true)), $signature);

        $claims = json_decode(base64_decode(strtr($payload, '-_', '+/')), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame([
            'ns' => 'tenant-uuid',
            'room' => 'project-uuid',
            'sub' => 'user-uuid',
            'name' => 'Erika Muster',
            'exp' => $now->getTimestamp() + CollaborationTokenIssuer::LIFETIME,
        ], $claims);
    }

    public function testAnotherSecretSignsDifferently(): void
    {
        $now = new \DateTimeImmutable('2026-11-13 12:00:00');

        self::assertNotSame(
            (new CollaborationTokenIssuer('one'))->issue('a', 'b', 'c', 'd', $now),
            (new CollaborationTokenIssuer('two'))->issue('a', 'b', 'c', 'd', $now),
        );
    }

    private function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
