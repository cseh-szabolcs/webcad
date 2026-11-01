<?php

namespace App\Security\AccessGrantHandler;

use App\Security\Attribute\AuthFullyGrant;
use App\Security\Attribute\AuthGrant;
use App\Security\Attribute\GrantInterface;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

class AuthHandler extends AbstractAccessGrantHandler
{
    public function supports(GrantInterface $attribute): bool
    {
        return $attribute instanceof AuthGrant;
    }

    public function handle(GrantInterface $attribute, ControllerEvent $event): ?false
    {
        /** @var AuthGrant $guard */
        $guard = $attribute;

        if (!$this->auth->isAuthenticated($guard instanceof AuthFullyGrant)) {
            $this->throwDeny();
        }

        if ($guard->role && !$this->auth->isGranted($guard->role)) {
            $this->throwDeny();
        }

        return null;
    }
}
