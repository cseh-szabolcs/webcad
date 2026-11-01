<?php

namespace App\Security\AccessGrantHandler;

use App\Security\Attribute\EnvironmentGrant;
use App\Security\Attribute\GrantInterface;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

class EnvironmentHandler extends AbstractAccessGrantHandler
{
    public function supports(string $attributeName): bool
    {
        return $attributeName === EnvironmentGrant::class;
    }

    public function handle(GrantInterface $attribute, ControllerEvent $event): ?false
    {
        /** @var EnvironmentGrant $guard */
        $guard = $attribute;

        if (!in_array($this->env, (array) $guard->env, true)) {
            $this->throwNotFound();
        }

        return null;
    }
}
