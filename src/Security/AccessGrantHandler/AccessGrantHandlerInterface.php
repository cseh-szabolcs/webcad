<?php

namespace App\Security\AccessGrantHandler;

use App\Security\Attribute\GrantInterface;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

#[AutoconfigureTag(AccessGrantHandlerInterface::class)]
interface AccessGrantHandlerInterface
{
    /** Whether this handler checks `$attribute` (instanceof, so subclasses of a grant count too). */
    public function supports(GrantInterface $attribute): bool;

    public function handle(GrantInterface $attribute, ControllerEvent $event): ?false;
}
