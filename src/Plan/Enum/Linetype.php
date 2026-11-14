<?php

namespace App\Plan\Enum;

/**
 * How the lines of a layer are drawn. The dash patterns themselves belong to the editor.
 */
enum Linetype: string
{
    case Continuous = 'continuous';
    case Dashed = 'dashed';
    case Hidden = 'hidden';
    case Center = 'center';
    case Dot = 'dot';
    case DashDot = 'dashDot';
}
