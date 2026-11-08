<?php

namespace App\Twig\Components\TableList;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class Row
{
    public bool $selected = false;
}
