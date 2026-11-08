<?php

namespace App\Twig\Extension;

use Twig\Attribute\AsTwigFunction;

final class SvgIconExtension
{
    private const array Icons = [
        'search' => '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
        'filter' => '<path d="M3 5h18l-7 8v6l-4-2v-4z"/>',
        'sort' => '<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>',
        'building' => '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3"/>',
        'mail' => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
        'phone' => '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
        'close' => '<path d="M6 6l12 12M18 6L6 18"/>',
    ];

    private const string Svg = '<svg class="icon" viewBox="0 0 %d %d" aria-hidden="true">%s</svg>';

    ##[AsTwigFilter('svg_icon')]
    #[AsTwigFunction(name: 'svg_icon', isSafe: ['html'])]
    public function svgIcon(string $name, int $size = 24, string $default = ':/'): string
    {
        if ($icon = self::Icons[$name] ?? null) {
            return sprintf(self::Svg, $size, $size, $icon);
        }

        return $default;
    }
}
