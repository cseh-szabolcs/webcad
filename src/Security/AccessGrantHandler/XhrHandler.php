<?php

namespace App\Security\AccessGrantHandler;

use App\Security\Attribute\GrantInterface;
use App\Security\Attribute\XhrGrant;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

class XhrHandler extends AbstractAccessGrantHandler
{
    public function supports(string $attributeName): bool
    {
        return $attributeName === XhrGrant::class;
    }

    public function handle(GrantInterface $attribute, ControllerEvent $event): ?false
    {
        if ($event->isMainRequest() && !$event->getRequest()->isXmlHttpRequest()) {
            $this->throwNotFound();
        }

        return null;
    }
}
