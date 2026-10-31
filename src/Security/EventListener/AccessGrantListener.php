<?php

namespace App\Security\EventListener;

use App\Core\Component\Reader\AttributeReader;
use App\Security\Attribute\AuthFullyGrant;
use App\Security\Attribute\AuthGrant;
use App\Security\Attribute\GrantInterface;
use App\Security\Attribute\GuestOnlyGrant;
use App\Security\Attribute\XhrGrant;
use App\Security\AuthProvider;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ControllerEvent;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Core\Exception\AccessDeniedException;

#[AsEventListener]
final readonly class AccessGrantListener
{
    public function __construct(
        private AuthProvider $auth,
        private UrlGeneratorInterface $urlGenerator,
    ) {
    }

    public function __invoke(ControllerEvent $event): void
    {
        $controller = $event->getController();

        if (!is_callable($controller)) {
            return;
        }

        $attributes = match (true) {
            is_object($controller) => AttributeReader::fromMethod($controller, '__invoke', GrantInterface::class),
            is_array($controller) && 2 === count($controller) => AttributeReader::fromMethod($controller[0], $controller[1], GrantInterface::class),
            default => [],
        };

        foreach ($attributes as $attribute) {
            match (get_class($attribute)) {
                GuestOnlyGrant::class => $this->handleGuestGrant($attribute, $event),
                AuthGrant::class => $this->handleAuthGrant($attribute),
                AuthFullyGrant::class => $this->handleAuthGrant($attribute, true),
                XhrGrant::class => $this->handleXhrGrant($event),
                default => throw new \LogicException(sprintf('Attribute "%s" is not supported.', $attribute->getName())),
            };
        }
    }

    private function handleGuestGrant(GuestOnlyGrant $grant, ControllerEvent $event): void
    {
        if ($this->auth->isAuthenticated()) {
            $url = $this->urlGenerator->generate($grant->redirect, $grant->params);
            $event->setController(static fn () => new RedirectResponse($url));
        }
    }

    private function handleAuthGrant(AuthGrant $authGrant, bool $fully = false): void
    {
        if (!$this->auth->isAuthenticated($fully)) {
            $this->deny();
        }

        if ($authGrant->role && !$this->auth->isGranted($authGrant->role)) {
            $this->deny();
        }
    }

    private function handleXhrGrant(ControllerEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        if (!$event->getRequest()->isXmlHttpRequest()) {
            $this->deny($event);
        }
    }

    private function deny(?ControllerEvent $event = null): void
    {
        if (!$event) {
            throw new AccessDeniedException('Access denied');
        }

        $event->setController(static fn () => new Response('Page not found.', 404));
    }
}
