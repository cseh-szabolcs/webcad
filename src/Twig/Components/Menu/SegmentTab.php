<?php

namespace App\Twig\Components\Menu;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
final class SegmentTab
{
    public string $key;

    public ?string $label = null;

    public ?string $href = null;

    public ?string $dataSource  = null;

    public bool $active = false;
}

