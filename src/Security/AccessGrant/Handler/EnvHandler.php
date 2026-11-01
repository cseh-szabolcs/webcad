<?php

namespace App\Security\AccessGrant\Handler;

use App\Security\AccessGrant\Attribute\EnvGrant;
use App\Security\AccessGrant\Attribute\GrantInterface;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

class EnvHandler extends AbstractHandler
{
    public function supports(GrantInterface $attribute): bool
    {
        return $attribute instanceof EnvGrant;
    }

    public function handle(GrantInterface $attribute, ControllerEvent $event): ?false
    {
        /** @var EnvGrant $guard */
        $guard = $attribute;

        if (!in_array($this->env, (array) $guard->env, true)) {
            $this->throwNotFound();
        }

        return null;
    }
}
