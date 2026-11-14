<?php

namespace App\Plan\Query;

use App\Core\Collaboration\CollaborationTokenIssuer;
use App\Core\Tenancy\TenantSwitcher;
use App\Plan\Dto\CollaborationAccessDto;
use App\Plan\Repository\PlanRepository;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

/**
 * Namespace is the tenant's uuid, room the plan's project: everybody working on one project meets in
 * one room, whichever of its plans they have open.
 */
#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetPlanCollaborationHandler
{
    public function __construct(
        private PlanRepository $plans,
        private TenantSwitcher $tenants,
        private CollaborationTokenIssuer $tokens,
    ) {
    }

    public function __invoke(GetPlanCollaborationQuery $query): ?CollaborationAccessDto
    {
        $plan = $this->plans->find($query->planId);
        $tenant = $this->tenants->currentTenant();
        if (null === $plan || null === $tenant) {
            return null;
        }

        $namespace = $tenant->getUuid()->toRfc4122();
        $room = $plan->getProject()->getId()->toRfc4122();

        return new CollaborationAccessDto(
            namespace: $namespace,
            room: $room,
            userName: $query->userName,
            token: $this->tokens->issue($namespace, $room, $query->userId->toRfc4122(), $query->userName),
        );
    }
}
