<?php

namespace App\Core\Contracts;

interface SerializableResponseInterface
{
    public function getSerializationContext(): ?array;

    public function getResponseEtag(): ?string;
}
