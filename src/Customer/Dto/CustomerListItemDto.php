<?php

namespace App\Customer\Dto;

use App\Customer\Entity\Customer;

/** One row of the customer list; `id` is the customer's public id, its UUID. */
final readonly class CustomerListItemDto
{
    /**
     * @param string|null          $company the name of the customer's company
     * @param list<TagListItemDto> $tags    the customer's tags
     * @param string               $created ISO 8601
     * @param string               $updated ISO 8601
     */
    public function __construct(
        public string $id,
        public ?string $email,
        public ?string $company,
        public ?string $firstname,
        public ?string $lastname,
        public ?string $phone,
        public array $tags,
        public string $created,
        public string $updated,
    ) {
    }

    public static function fromEntity(Customer $customer): self
    {
        return new self(
            id: $customer->getUuid()->toRfc4122(),
            email: $customer->getEmail(),
            company: $customer->getCompany()?->getName(),
            firstname: $customer->getFirstname(),
            lastname: $customer->getLastname(),
            phone: $customer->getPhone(),
            tags: $customer->getTags()->map(TagListItemDto::fromEntity(...))->getValues(),
            created: $customer->getCreated()->format(\DATE_ATOM),
            updated: $customer->getUpdated()->format(\DATE_ATOM),
        );
    }
}
