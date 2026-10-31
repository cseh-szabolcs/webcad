<?php

namespace App\Core;

use App\Core\Tenancy\Entity\Tenant;
use App\Core\Traits\EnvAwareTrait;
use App\Security\AuthProvider;
use App\User\Entity\User;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Routing\RouterInterface;

final class App
{
    use EnvAwareTrait;

    private ?AuthProvider $authProvider = null;

    public function __construct(
        private readonly RequestStack $requestStack,
        public readonly RouterInterface $router,
        public readonly UrlGeneratorInterface $urlGenerator,
        private readonly EventDispatcherInterface $eventDispatcher,
        public string $rootDir
    ) {
    }

    public function authenticate(AuthProvider $authProvider): void
    {
        $this->authProvider = $authProvider;
    }

    public function getTenant(): Tenant
    {
        $this->assertAuth();

        return $this->authProvider->getTenant();
    }

    public function getUser(): User
    {
        $this->assertAuth();

        return $this->authProvider->getUser();
    }

    public function isGranted(mixed $attributes, mixed $subject = null): bool
    {
        return $this->authProvider->isGranted($attributes, $subject);
    }

    public function getCurrentRequest(): Request
    {
        return $this->requestStack->getCurrentRequest();
    }

    public function getMainRequest(): Request
    {
        return $this->requestStack->getMainRequest();
    }

    public function getSession(): Session
    {
        return $this->requestStack->getSession();
    }

    public function getCurrentPath(): string
    {
        $request = $this->getMainRequest();

        return $request->getBaseUrl() . $request->getPathInfo();
    }

    /**
     * @template T of object
     * @param T $event
     * @param string|null $eventName
     *
     * @return T The passed $event MUST be returned
     */
    public function dispatchEvent(object $event, ?string $eventName = null): object
    {
        return $this->eventDispatcher->dispatch($event, $eventName);
    }

    private function assertAuth(): void
    {
        assert($this->authProvider instanceof AuthProvider, 'Not authenticated yet.');
    }
}
