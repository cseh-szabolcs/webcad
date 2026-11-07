<?php

namespace App\Twig\Components\Menu;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class ContextMenuLayer
{
    public string $id;

    public array $items = [];

    public ?string $label = null;
}
