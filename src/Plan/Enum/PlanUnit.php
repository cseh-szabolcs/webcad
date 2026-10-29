<?php

namespace App\Plan\Enum;

/**
 * Display unit of a plan. Model coordinates are always millimetres, whatever the unit.
 */
enum PlanUnit: string
{
    case Millimetre = 'mm';
    case Centimetre = 'cm';
    case Metre = 'm';
}
