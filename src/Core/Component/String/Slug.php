<?php

namespace App\Core\Component\String;

use App\Core\Traits\Pattern\StaticTrait;
use Symfony\Component\String\Slugger\AsciiSlugger;

class Slug
{
    use StaticTrait;

    /**
     * @param string|null $locale e.g. "de", so "ü" becomes "ue" instead of "u"
     */
    public static function create($string, string $separator = '_', ?string $locale = null): string
    {
        return new AsciiSlugger($locale)->slug($string, $separator)->lower();
    }
}
