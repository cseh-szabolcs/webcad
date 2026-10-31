<?php

namespace App\Core\Traits\Entity;

use DateTimeImmutable;
use Doctrine\ORM\Mapping as ORM;

trait CreatedTrait
{
    #[ORM\Column]
    private ?DateTimeImmutable $created = null;

    public function getCreated(): DateTimeImmutable
    {
        return $this->created;
    }

    #[ORM\PrePersist]
    public function setCreated(): static
    {
        if (null === $this->created) {
            $this->created = new DateTimeImmutable();
        }

        return $this;
    }
}
