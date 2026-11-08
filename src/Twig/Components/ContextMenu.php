<?php

namespace App\Twig\Components;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class ContextMenu
{
    public string $id;

    public array $items = [];

    public ?string $label = null;
}
