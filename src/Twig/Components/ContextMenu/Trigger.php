<?php

namespace App\Twig\Components\ContextMenu;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class Trigger
{
    public string $targetId;

    public bool $open = false;

    public ?string $label = null;

    public ?string $bindItem = null;

    public ?string $bindItemLabelFn = null;
}

