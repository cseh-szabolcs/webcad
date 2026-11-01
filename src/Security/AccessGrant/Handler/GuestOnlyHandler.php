<?php

namespace App\Security\AccessGrant\Handler;

use App\Security\AccessGrant\Attribute\GrantInterface;
use App\Security\AccessGrant\Attribute\GuestOnlyGrant;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

class GuestOnlyHandler extends AbstractHandler
{
    public function supports(GrantInterface $attribute): bool
    {
        return $attribute instanceof GuestOnlyGrant;
    }

    public function handle(GrantInterface $attribute, ControllerEvent $event): ?false
    {
        /** @var GuestOnlyGrant $guard */
        $guard = $attribute;

        if ($this->auth->isAuthenticated()) {
            $url = $this->urlGenerator->generate($guard->redirect, $guard->params);

            return $this->setRedirectResponse($event, $url);
        }

        return null;
    }
}
