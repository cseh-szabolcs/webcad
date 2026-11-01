<?php

namespace App\Security\AccessGrant\Handler;

use App\Security\AccessGrant\Attribute\GrantInterface;
use App\Security\AccessGrant\Attribute\XhrGrant;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

class XhrHandler extends AbstractHandler
{
    public function supports(GrantInterface $attribute): bool
    {
        return $attribute instanceof XhrGrant;
    }

    public function handle(GrantInterface $attribute, ControllerEvent $event): ?false
    {
        if ($event->isMainRequest() && !$event->getRequest()->isXmlHttpRequest()) {
            $this->throwNotFound();
        }

        return null;
    }
}
