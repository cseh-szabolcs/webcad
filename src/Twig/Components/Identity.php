<?php

namespace App\Twig\Components;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class Identity
{
    public string $name = '-';

    public string $subtext = '';

    public string $initials = '??';

    public ?string $icon = null;

    public bool $bind = false;

    public string $bindIconCondition = 'false';

    public string $toneStyle = 'blue';

    public ?string $toneColor = null;
}
