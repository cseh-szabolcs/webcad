<?php

namespace App\Twig\Components;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;

#[AsTwigComponent]
final class SegmentTabs
{
    public array $tabs = [];

    public ?string $activeTab = null;

    public ?string $label = null;
}
