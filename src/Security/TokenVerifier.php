<?php

namespace App\Security;

use App\Core\App;
use App\Core\Exception\SecurityException;
use App\Security\Entity\Token;
use App\Security\Entity\TokenType;
use App\Security\Repository\TokenRepository;
use App\User\Entity\User;
use Doctrine\ORM\NoResultException;

final readonly class TokenVerifier
{
    public function __construct(
        private TokenRepository $tokenRepository,
        private App $app,
    ) {
    }

    public function verify(Token|string|null $token = null, bool $keepToken = false): Token
    {
        try {
            $token = $this->tokenRepository->findToken($token);
        } catch (NoResultException) {
            throw new SecurityException('Token does not exist');
        }

        if ($token->isExpired() && !$token->isRenewable()) {
            throw new SecurityException('Token expired');
        }

        if ($token->isRenewable()) {
            return $token->isExpired()
                ? $this->tokenRepository->replace($token, Token::class)
                : $token;
        }

        if ($keepToken) {
            $token->setTtl(null);
        } else {
            $this->tokenRepository->remove($token);
        }

        return $token;
    }

    public function create(
        User $owner,
        TokenType $type,
        ?array $payload = null,
        ?int $ttl = null,
        bool $renewable = false,
    ): Token {
        if ($existing = $this->tokenRepository->findOneBy(['owner' => $owner, 'type' => $type])) {
            $this->tokenRepository->remove($existing);
        }

        $token = new Token($owner, $type, $payload, $ttl, $renewable);
        $this->tokenRepository->persist($token);

        return $token;
    }

    public function getTokenByUser(string|int $userId, string $type): ?Token
    {
        assert($this->app->isDev());

        return $this->tokenRepository->findOneByOwnerAndType($userId, $type);
    }
}
