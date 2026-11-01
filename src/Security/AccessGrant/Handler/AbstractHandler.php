<?php

namespace App\Security\AccessGrant\Handler;

use App\Core\Traits\EnvAwareTrait;
use App\Security\AuthProvider;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpKernel\Event\ControllerEvent;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Security\Core\Exception\AccessDeniedException;

abstract class AbstractHandler implements HandlerInterface
{
    use EnvAwareTrait;

    public function __construct(
        protected readonly AuthProvider $auth,
        protected readonly UrlGeneratorInterface $urlGenerator,
    ) {
    }

    protected function throwDeny(): never
    {
        throw new AccessDeniedException('Access denied');
    }

    protected function throwNotFound(): void
    {
        throw new NotFoundHttpException('Page not found');
    }

    protected function setRedirectResponse(ControllerEvent $event, string $url): false
    {
        $event->setController(static fn () => new RedirectResponse($url));

        return false;
    }
}
