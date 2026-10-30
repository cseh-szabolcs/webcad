<?php

namespace App\Core\EventListener;

use App\Core\Contracts\SerializableResponseInterface;
use App\Core\Traits\EnvAwareTrait;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ViewEvent;
use Symfony\Component\Serializer\SerializerInterface;
use Throwable;

#[AsEventListener]
final class ControllerResultListener
{
    use EnvAwareTrait;

    public function __construct(
        private readonly SerializerInterface $serializer,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * @throws Throwable
     */
    public function __invoke(ViewEvent $event): void
    {
        $result = $event->getControllerResult();

        if (!$result instanceof SerializableResponseInterface) {
            return;
        }

        try {
            $json = $this->serializer->serialize($result, 'json', $result->getSerializationContext() ?? []);

            $response = new JsonResponse($json, 200, [], true);
            if ($etag = $result->getResponseEtag()) {
                $response->setEtag($etag);
                $response->isNotModified($event->getRequest());
            }

            $event->setResponse($response);
        } catch (Throwable $e) {
            if ($this->env->isDev()) {
                throw $e;
            }

            $this->logger->error($e);
        }
    }
}
