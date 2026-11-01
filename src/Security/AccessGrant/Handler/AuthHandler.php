<?php

namespace App\Security\AccessGrant\Handler;

use App\Security\AccessGrant\Attribute\AuthFullyGrant;
use App\Security\AccessGrant\Attribute\AuthGrant;
use App\Security\AccessGrant\Attribute\GrantInterface;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

class AuthHandler extends AbstractHandler
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
