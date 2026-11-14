<?php

namespace App\Twig\Components\Form;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

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
