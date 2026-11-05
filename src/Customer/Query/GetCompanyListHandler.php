<?php

namespace App\Customer\Query;

use App\Core\Doctrine\ListPaginator;
use App\Core\Dto\ListResultDto;
use App\Customer\Dto\CompanyListItemDto;
use App\Customer\Repository\CompanyRepository;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetCompanyListHandler
{
    public function __construct(
        private CompanyRepository $companies,
    ) {
    }

    /**
     * @return ListResultDto<CompanyListItemDto>
     */
    public function __invoke(GetCompanyListQuery $query): ListResultDto
    {
        return ListPaginator::paginate(
            $this->companies->createListQueryBuilder(),
            $query->page,
            $query->pageSize,
            CompanyListItemDto::fromEntity(...),
            fetchJoinCollection: false,
        );
    }
}
