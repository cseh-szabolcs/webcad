<?php

namespace App\Twig\Components\Form;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class SearchInput
{
    public ?string $label = null;

    public ?string $placeholder = null;

    public ?string $bindHandler = null;

    public ?string $bindModel = null;
}
