<?php

namespace App\Core\Traits\Entity;

use Doctrine\ORM\Mapping as ORM;

trait UpdatedTrait
{
    #[ORM\Column]
    private ?\DateTimeImmutable $updated = null;

    public function getUpdated(): ?\DateTimeImmutable
    {
        return $this->updated;
    }

    #[ORM\PrePersist]
    public function setUpdated(): static
    {
        $this->updated = new \DateTimeImmutable();

        return $this;
    }
}
