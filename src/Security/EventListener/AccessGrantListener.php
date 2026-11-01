<?php

namespace App\Security\EventListener;

use App\Core\Component\Reader\AttributeReader;
use App\Core\Traits\EnvAwareTrait;
use App\Security\AccessGrantHandler\AccessGrantHandlerInterface;
use App\Security\Attribute\GrantInterface;
use App\Security\AuthProvider;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ControllerEvent;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

#[AsEventListener]
final class AccessGrantListener
{
    use EnvAwareTrait;

    public function __construct(
        /** @var callable():AccessGrantHandlerInterface[] */
        #[AutowireIterator(tag: AccessGrantHandlerInterface::class)]
        private readonly iterable $handlers,
        private readonly AuthProvider $auth,
        private readonly UrlGeneratorInterface $urlGenerator,
    ) {
    }

    public function __invoke(ControllerEvent $event): void
    {
        $controller = $event->getController();

        if (!is_callable($controller)) {
            return;
        }

        $attributes = match (true) {
            is_object($controller) => AttributeReader::fromMethod($controller, '__invoke', GrantInterface::class),
            is_array($controller) && 2 === count($controller) => AttributeReader::fromMethod($controller[0], $controller[1], GrantInterface::class),
            default => [],
        };

        if (count($attributes)) {
            $this->handle($attributes, $event);
        }
    }

    /**
     * @param GrantInterface[] $attributes
     */
    private function handle(array $attributes, ControllerEvent $event): void
    {
        foreach ($attributes as $attribute) {
            $handled = false;

            /** @var AccessGrantHandlerInterface $handler */
            foreach ($this->handlers as $handler) {
                if (!$handler->supports($attribute)) {
                    continue;
                }

                if (false === $handler->handle($attribute, $event)) {
                    break 2;
                }
                $handled = true;
            }

            if (!$handled) {
                throw new \LogicException(sprintf('Attribute "%s" is not supported.', $attribute::class));
            }
        }
    }
}
