<?php

namespace App\Core\Constants;

enum Locale: string
{
    case EN = 'en';
    case DE = 'de';

    public static function getDefault(): self
    {
        return self::DE;
    }

    public static function getSupported(): array
    {
        return [
            self::EN,
            self::DE,
        ];
    }

    public static function supports(string $name): bool
    {
        return in_array($name, array_map(static fn (self $locale): string => $locale->value, self::getSupported()));
    }
}
