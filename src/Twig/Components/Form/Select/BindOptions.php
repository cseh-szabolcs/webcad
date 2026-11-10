<?php

namespace App\Twig\Components\Form\Select;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class BindOptions
{
    public string $data;
    public string $identifier;
    public string $label;
    public ?string $value = null;
}
