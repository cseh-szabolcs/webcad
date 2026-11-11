<?php

namespace App\Twig\Components\Form\Select;

use Symfony\UX\TwigComponent\Attribute\AsTwigComponent;
use Symfony\UX\TwigComponent\Attribute\ExposeInTemplate;

#[AsTwigComponent]
class Async
{
    public string $fetchDataPath;
    public string $optionValue;
    public string $optionLabel;
    public null|bool|int|float|string $value = null;
    public ?string $selectData = null;
    public ?string $placeholder = null;


    #[ExposeInTemplate]
    public function getParsedValue(): string
    {
        return match (true) {
            is_int($this->value), is_bool($this->value), is_float($this->value) => "$this->value",
            is_string($this->value) => "'$this->value'",
            default => 'null',
        };
    }
}
