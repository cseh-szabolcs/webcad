<?php

namespace App\Customer\Query\Tag;

use App\Customer\Repository\TagRepository;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetTagCountHandler
{
    public function __construct(
        private TagRepository $tags,
    ) {
    }

    public function __invoke(GetTagCountQuery $query): int
    {
        return $this->tags->count();
    }
}
