<?php

namespace App\Twig\Components\TableList;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;
use Symfony\UX\TwigComponent\Attribute\PostMount;

#[AsTwigComponent]
class Col extends Head
{
    public string $label = '';

    public bool $contextMenu = false;

    #[PostMount]
    public function onPost(): void
    {
        if ($this->contextMenu) {
            $this->class .= ' data-table__cell--action';
        }
    }
}
