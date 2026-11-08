<?php

namespace App\Customer\Query\Tag;

use App\Core\Doctrine\ListPaginator;
use App\Core\Dto\ListResultDto;
use App\Customer\Dto\TagListItemDto;
use App\Customer\Repository\TagRepository;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetTagListHandler
{
    public function __construct(
        private TagRepository $tags,
    ) {
    }

    /**
     * @return ListResultDto<TagListItemDto>
     */
    public function __invoke(GetTagListQuery $query): ListResultDto
    {
        return ListPaginator::paginate(
            $this->tags->createListQueryBuilder(),
            $query->page,
            $query->pageSize,
            TagListItemDto::fromEntity(...),
            fetchJoinCollection: false,
        );
    }
}
