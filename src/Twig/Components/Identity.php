<?php

namespace App\Twig\Components;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class Identity
{
    public string $name;

    public string $subtext;

    public string $initials = '??';

    public ?string $icon = null;
}
