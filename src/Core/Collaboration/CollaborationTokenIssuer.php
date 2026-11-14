<?php

namespace App\Core\Collaboration;

use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Signs the token an editor shows the collaboration server in its socket handshake: the tenant
 * (namespace), the project (room) and who the user is. The server (depts/collaboration) knows the
 * same secret and only checks the signature, so it needs neither a session nor a database.
 *
 * Format: base64url(json payload) . '.' . base64url(hmac-sha256 of the first part). The token is
 * only needed for the handshake, so it expires quickly.
 */
final readonly class CollaborationTokenIssuer
{
    public const int LIFETIME = 60;

    public function __construct(
        #[Autowire(env: 'COLLAB_AUTH_TOKEN')]
        private string $secret,
    ) {
    }

    public function issue(string $namespace, string $room, string $userId, string $userName, ?\DateTimeImmutable $now = null): string
    {
        $payload = $this->encode(json_encode([
            'ns' => $namespace,
            'room' => $room,
            'sub' => $userId,
            'name' => $userName,
            'exp' => ($now ?? new \DateTimeImmutable())->getTimestamp() + self::LIFETIME,
        ], \JSON_THROW_ON_ERROR));

        return $payload.'.'.$this->encode(hash_hmac('sha256', $payload, $this->secret, true));
    }

    private function encode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
