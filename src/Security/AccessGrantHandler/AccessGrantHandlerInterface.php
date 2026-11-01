<?php

namespace App\Security\AccessGrantHandler;

use App\Security\Attribute\GrantInterface;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;
use Symfony\Component\HttpKernel\Event\ControllerEvent;

#[AutoconfigureTag(AccessGrantHandlerInterface::class)]
interface AccessGrantHandlerInterface
{
    public function supports(string $attributeName): bool;

    public function handle(GrantInterface $attribute, ControllerEvent $event): ?false;
}
