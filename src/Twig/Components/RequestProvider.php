<?php

namespace App\Twig\Components;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class RequestProvider
{
    public string $path;
    public ?string $prop = null;
}
