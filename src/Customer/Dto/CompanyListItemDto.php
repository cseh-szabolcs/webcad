<?php

namespace App\Customer\Dto;

use App\Customer\Entity\Company;

/** One row of the company list; `id` is the company's public id, its UUID. */
final readonly class CompanyListItemDto
{
    /**
     * @param string $created ISO 8601
     * @param string $updated ISO 8601
     */
    public function __construct(
        public string $id,
        public string $name,
        public ?string $email,
        public ?string $phone,
        public string $created,
        public string $updated,
    ) {
    }

    public static function fromEntity(Company $company): self
    {
        return new self(
            id: $company->getUuid()->toRfc4122(),
            name: $company->getName(),
            email: $company->getEmail(),
            phone: $company->getPhone(),
            created: $company->getCreated()->format(\DATE_ATOM),
            updated: $company->getUpdated()->format(\DATE_ATOM),
        );
    }
}
