<?php

namespace App\Core\Component\String;

use App\Core\Traits\Pattern\StaticTrait;
use Hidehalo\Nanoid\Client;

final class NanoId
{
    use StaticTrait;

    private static string $alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

    public static function generate(int $size = 8): string
    {
        return new Client()->formattedId(self::$alphabet, $size);
    }
}
