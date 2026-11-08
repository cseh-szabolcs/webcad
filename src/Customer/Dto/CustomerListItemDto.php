<?php

namespace App\Customer\Dto;

use App\Customer\Entity\Customer;

/** One row of the customer list; `id` is the customer's public id, its UUID. */
final readonly class CustomerListItemDto
{
    /**
     * @param string               $displayName  see Customer::getDisplayName()
     * @param string|null          $email        the e-mail of the customer's company
     * @param string|null          $company      the name of the customer's company, null for a private person
     * @param bool                 $organization organziation (company) or person
     * @param string|null          $phone        the phone of the customer's company
     * @param list<TagListItemDto> $tags         the customer's tags
     * @param string               $created      ISO 8601
     * @param string               $updated      ISO 8601
     */
    public function __construct(
        public string $id,
        public string $displayName,
        public ?string $email,
        public ?string $company,
        public ?bool $organization,
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
        $company = $customer->getCompany();

        return new self(
            id: $customer->getUuid()->toRfc4122(),
            displayName: $customer->getDisplayName(),
            email: $company->getEmail(),
            company: $company->getName(),
            organization: $company->isOrganization(),
            firstname: $customer->getFirstname(),
            lastname: $customer->getLastname(),
            phone: $company->getPhone(),
            tags: $customer->getTags()->map(TagListItemDto::fromEntity(...))->getValues(),
            created: $customer->getCreated()->format(\DATE_ATOM),
            updated: $customer->getUpdated()->format(\DATE_ATOM),
        );
    }
}
