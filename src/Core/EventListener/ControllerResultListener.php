<?php

namespace App\Core\EventListener;

use App\Core\Http\ApiResponse;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ViewEvent;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Turns an ApiResponse returned by a controller into a JSON response.
 */
#[AsEventListener]
final readonly class ControllerResultListener
{
    public function __construct(
        private SerializerInterface $serializer,
    ) {
    }

    public function __invoke(ViewEvent $event): void
    {
        $result = $event->getControllerResult();

        if (!$result instanceof ApiResponse) {
            return;
        }

        // The encoding options of AbstractController::json(), unless the context names others
        $json = $this->serializer->serialize($result->data, 'json', [
            'json_encode_options' => JsonResponse::DEFAULT_ENCODING_OPTIONS,
            ...$result->context,
        ]);

        $response = new JsonResponse($json, $result->status, [], true);

        if (null !== $result->etag) {
            $response->setEtag($result->etag);
            $response->isNotModified($event->getRequest());
        }

        $event->setResponse($response);
    }
}
