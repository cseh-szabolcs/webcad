<?php

declare(strict_types=1);

namespace App\Security\Authenticator;

use App\Core\App;
use App\Core\Constants\Http;
use App\Security\TokenVerifier;
use App\User\Entity\User;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;
use Symfony\Component\Uid\Exception\InvalidArgumentException;

class TokenAuthenticator extends AbstractAuthenticator
{
    private ?string $token = null;

    private ?string $newToken = null;

    public function __construct(
        private readonly TokenVerifier $tokenVerifier,
        private readonly App $app,
    ) {}

    public function supports(Request $request): ?bool
    {
        $this->token = $this->getAuthToken($request);

        return is_string($this->token);
    }

    public function authenticate(Request $request): SelfValidatingPassport
    {
        try {
            return new SelfValidatingPassport(
                new UserBadge(
                    $this->token,
                    $this->verifyToken(...),
                )
            );
        } catch (InvalidArgumentException) {
            throw new AuthenticationException('Missing Bearer token.');
        }
    }

    public function verifyToken(string $token): User
    {
        $token = $this->tokenVerifier->verify($token);
        $current = $token->__toString();

        if ($current !== $this->token) {
            $this->newToken = $current;
        }

        return $token->getOwner();
    }

    #[AsEventListener]
    public function onResponse(ResponseEvent $event): void
    {
        if (is_string($this->newToken)) {
            $event->getResponse()->headers->set(Http::HEADER_AUTH_TOKEN, $this->newToken);
        }
    }

    private function getAuthToken(Request $request): ?string
    {
        if ($token = $this->getTokenFromRequest($request)) {
            if ($this->isDevUserIdToken($token)) {
                return $this->getTokenFromUserId($token);
            }
        }

        return $token;
    }

    public function onAuthenticationSuccess(Request $request, $token, string $firewallName): ?Response
    {
        // just run request for api
        return null;
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        // for api could return 401 JSON, for "just load user" null is also ok
        return null;
    }

    private function getTokenFromRequest(Request $request): ?string
    {
        if ($this->app->isDev() && $request->query->has('authToken')) {
            return $request->query->get('authToken');
        }

        if ($request->headers->has('Authorization')
            && $token = $request->headers->get('Authorization')
        ) {
            if (str_starts_with($token, 'Bearer ')) {
                return substr($token, 7);
            }
        }
        return null;
    }

    private function isDevUserIdToken(int|string $token): bool
    {
        return is_numeric($token) && $this->app->isDev();
    }

    private function getTokenFromUserId(int|string $userId): ?string
    {
        if ($token = $this->tokenVerifier->getTokenByUser($userId, Token::TYPE_AUTH)) {
            return $token->__toString();
        }

        return null;
    }
}
