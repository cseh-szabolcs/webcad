<?php

namespace App\Customer\Query\Company;

use App\Customer\Repository\CompanyRepository;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetCompanyCountHandler
{
    public function __construct(
        private CompanyRepository $companies,
    ) {
    }

    public function __invoke(GetCompanyCountQuery $query): int
    {
        return $this->companies->count(['organization' => true]);
    }
}
