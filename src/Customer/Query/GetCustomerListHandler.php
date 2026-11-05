<?php

namespace App\Customer\Query;

use App\Core\Doctrine\ListPaginator;
use App\Core\Dto\ListResultDto;
use App\Customer\Dto\CustomerListItemDto;
use App\Customer\Repository\CustomerRepository;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Uid\Uuid;

#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetCustomerListHandler
{
    public function __construct(
        private CustomerRepository $customers,
    ) {
    }

    /**
     * @return ListResultDto<CustomerListItemDto>
     */
    public function __invoke(GetCustomerListQuery $query): ListResultDto
    {
        return ListPaginator::paginate(
            $this->customers->createListQueryBuilder(
                $query->query,
                null !== $query->tag ? Uuid::fromString($query->tag) : null,
                $query->sort,
                $query->direction,
            ),
            $query->page,
            $query->pageSize,
            CustomerListItemDto::fromEntity(...),
        );
    }
}
