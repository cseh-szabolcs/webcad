<?php

namespace App\Security\AccessGrantHandler;

use App\Security\Attribute\GrantInterface;
use App\Security\Attribute\GuestOnlyGrant;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

class GuestOnlyHandler extends AbstractAccessGrantHandler
{
    public function supports(string $attributeName): bool
    {
        return $attributeName === GuestOnlyGrant::class;
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
