<?php

namespace App\Twig\Components\SegmentTabs;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
final class Tab
{
    public string $key;

    public ?string $label = null;

    public ?string $href = null;

    public ?string $dataSource  = null;

    public bool $active = false;
}

