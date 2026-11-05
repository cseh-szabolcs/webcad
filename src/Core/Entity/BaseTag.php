<?php

namespace App\Core\Entity;

use App\Core\Traits\Entity\UuidAwareTrait;
use App\Customer\Entity\Tag as CustomerTag;
use Doctrine\ORM\Mapping as ORM;

/**
 * A tag the user creates, e.g. "Bauherr" for customers. All tags share the table `tag`; each
 * purpose is a subclass in its business area and an entry of the discriminator map, the only place
 * where Core names an area: Doctrine needs the map on the root class.
 */
#[ORM\Entity]
#[ORM\Table(name: 'tag')]
#[ORM\InheritanceType('SINGLE_TABLE')]
#[ORM\DiscriminatorColumn(name: 'type', type: 'string', length: 32)]
#[ORM\DiscriminatorMap(['customer' => CustomerTag::class])]
#[ORM\HasLifecycleCallbacks]
abstract class BaseTag
{
    use UuidAwareTrait;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(options: ['unsigned' => true])]
    private ?int $id = null;

    /** The color the user chose as #rrggbb; without one, the page generates it from the tag's id. */
    #[ORM\Column(length: 7, nullable: true)]
    private ?string $color = null;

    public function __construct(
        #[ORM\Column(length: 255)]
        private string $name,
    ) {
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getColor(): ?string
    {
        return $this->color;
    }

    public function setColor(?string $color): static
    {
        $this->color = $color;

        return $this;
    }
}
