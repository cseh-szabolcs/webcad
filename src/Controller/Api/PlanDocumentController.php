<?php

namespace App\Controller\Api;

use App\Application\DTO\PlanDocumentDTO;
use App\Application\Model\Plan\PlanDocument;
use App\Application\Query\GetPlanDocumentQuery;
use Nelmio\ApiDocBundle\Attribute\Areas;
use Nelmio\ApiDocBundle\Attribute\Model;
use OpenApi\Attributes as OA;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Messenger\HandleTrait;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;
use Symfony\Component\Uid\Uuid;

/**
 * The editor loads a plan as one document. The plan's revision is the ETag, so a client that
 * sends it back in If-None-Match gets a 304 while nothing changed.
 */
final class PlanDocumentController extends AbstractController
{
    use HandleTrait;

    public function __construct(
        #[Autowire(service: 'query.bus')]
        MessageBusInterface $messageBus,
    ) {
        $this->messageBus = $messageBus;
    }

    #[Route('/api/plans/{id}/document', name: 'api_plan_document_get', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[Areas(['default'])]
    #[OA\Tag(name: 'Plan')]
    #[OA\Get(
        summary: 'Returns the drawing of a plan.',
        responses: [
            new OA\Response(
                response: 200,
                description: 'The plan document; its revision is the ETag.',
                content: new OA\JsonContent(ref: new Model(type: PlanDocument::class)),
            ),
            new OA\Response(response: 304, description: 'The revision named in If-None-Match is still the current one.'),
            new OA\Response(response: 404, description: 'Unknown plan.'),
        ],
    )]
    public function get(Uuid $id, Request $request): JsonResponse
    {
        /** @var PlanDocumentDTO|null $result */
        $result = $this->handle(new GetPlanDocumentQuery($id));
        if (null === $result) {
            throw $this->createNotFoundException(\sprintf('Plan "%s" not found.', $id->toRfc4122()));
        }

        $response = $this->json($result->document);
        $response->setEtag((string) $result->revision);
        $response->isNotModified($request);

        return $response;
    }
}
