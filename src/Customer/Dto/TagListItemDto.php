<?php

namespace App\Customer\Dto;

use App\Customer\Entity\Tag;

/** A tag, in the tag list and at a customer; `id` is the tag's public id, its UUID. */
final readonly class TagListItemDto
{
    /**
     * @param string|null $color the color the user chose as #rrggbb
     */
    public function __construct(
        public string $id,
        public string $name,
        public ?string $color,
    ) {
    }

    public static function fromEntity(Tag $tag): self
    {
        return new self(
            id: $tag->getUuid()->toRfc4122(),
            name: $tag->getName(),
            color: $tag->getColor(),
        );
    }
}
