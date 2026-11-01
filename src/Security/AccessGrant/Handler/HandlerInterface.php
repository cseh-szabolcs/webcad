<?php

namespace App\Security\AccessGrant\Handler;

use App\Security\AccessGrant\Attribute\GrantInterface;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

#[AutoconfigureTag(HandlerInterface::class)]
interface HandlerInterface
{
    /** Whether this handler checks `$attribute` (instanceof, so subclasses of a grant count too). */
    public function supports(GrantInterface $attribute): bool;

    public function handle(GrantInterface $attribute, ControllerEvent $event): ?false;
}
