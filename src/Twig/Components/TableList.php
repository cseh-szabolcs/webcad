<?php

namespace App\Twig\Components;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
class TableList
{
    public string $label = '';

    public bool $toolbar = false;

    public ?string $bindController = null;

    public string $dataSource = '';

    public null|int|string $count = null;
}
