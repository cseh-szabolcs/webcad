<?php

namespace App\Twig\Components\TableList;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class Head
{
    public string $label = '';

    public ?string $class = null;
}
