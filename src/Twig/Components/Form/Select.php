<?php

namespace App\Twig\Components\Form;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;
use Symfony\UX\TwigComponent\Attribute\ExposeInTemplate;

#[AsTwigComponent]
class Select
{
    public array $options = [];

    public ?string $label = null;

    public ?string $icon = null;

    public ?string $value = null;

    public ?string $bindHandler = null;

    public ?string $bindModel = null;
}
