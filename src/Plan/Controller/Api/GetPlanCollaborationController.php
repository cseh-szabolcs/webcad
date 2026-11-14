<?php

namespace App\Plan\Controller\Api;

use App\Core\Http\ApiResponse;
use App\Plan\Dto\CollaborationAccessDto;
use App\Plan\Query\GetPlanCollaborationQuery;
use App\User\Entity\User;
use Nelmio\ApiDocBundle\Attribute\Areas;
use Nelmio\ApiDocBundle\Attribute\Model;
use OpenApi\Attributes as OA;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Messenger\HandleTrait;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Uid\Uuid;

/**
 * Where an editor that has loaded a plan learns which collaboration room to join, and gets the
 * token to prove it may.
 */
final class GetPlanCollaborationController extends AbstractController
{
    use HandleTrait;

    public function __construct(
        #[Autowire(service: 'query.bus')]
        MessageBusInterface $messageBus,
    ) {
        $this->messageBus = $messageBus;
    }

    #[Route('/api/plans/{id}/collaboration', name: 'api_plan_collaboration_get', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[Areas(['default'])]
    #[OA\Tag(name: 'Plan')]
    #[OA\Get(
        summary: 'Returns the collaboration room of the plan\'s project and a token to join it.',
        responses: [
            new OA\Response(
                response: 200,
                description: 'Namespace, room and a short-lived token.',
                content: new OA\JsonContent(ref: new Model(type: CollaborationAccessDto::class)),
            ),
            new OA\Response(response: 404, description: 'Unknown plan.'),
        ],
    )]
    public function __invoke(Uuid $id, #[CurrentUser] User $user): ApiResponse
    {
        /** @var CollaborationAccessDto|null $access */
        $access = $this->handle(new GetPlanCollaborationQuery($id, $user->getUuid(), $user->getName() ?? $user->getEmail()));
        if (null === $access) {
            throw $this->createNotFoundException(\sprintf('Plan "%s" not found.', $id->toRfc4122()));
        }

        return new ApiResponse(data: $access);
    }
}
