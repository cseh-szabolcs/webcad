<?php

namespace App\Controller\Api;

use App\Application\DTO\PlanDocumentDTO;
use App\Application\Query\GetPlanDocumentQuery;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Messenger\HandleTrait;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;
use Symfony\Component\Uid\Uuid;

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
    public function get(Uuid $id, Request $request): JsonResponse
    {
        /** @var PlanDocumentDTO|null $document */
        $document = $this->handle(new GetPlanDocumentQuery($id));
        if (null === $document) {
            throw $this->createNotFoundException(\sprintf('Plan "%s" not found.', $id->toRfc4122()));
        }

        $response = JsonResponse::fromJsonString($document->documentJson);
        $response->setEtag((string) $document->revision);
        $response->isNotModified($request);

        return $response;
    }
}
