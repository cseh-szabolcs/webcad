<?php

namespace App\Twig\Components\Menu;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class ContextMenu
{
    public string $targetId;

    public bool $open = false;

    public ?string $label = null;

    public string $itemObjectJS = 'item';

    public ?string $itemLabelGetterJS = null;

    public ?string $itemActionMethodJS = null;
}

