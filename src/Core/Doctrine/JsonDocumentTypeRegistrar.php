<?php

namespace App\Core\Doctrine;

use Doctrine\DBAL\Types\Type;
use Symfony\Component\DependencyInjection\Attribute\Autoconfigure;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

/**
 * DBAL types live in a static registry and are made without arguments when named by class, but
 * JsonDocumentType needs the serializer. So this registers an instance of it; Kernel::boot()
 * calls it, which covers requests, console commands and tests alike. Public for that reason.
 */
#[Autoconfigure(public: true)]
final readonly class JsonDocumentTypeRegistrar
{
    public function __construct(
        private NormalizerInterface $normalizer,
        private DenormalizerInterface $denormalizer,
    ) {
    }

    public function register(): void
    {
        $registry = Type::getTypeRegistry();
        $type = new JsonDocumentType($this->normalizer, $this->denormalizer);

        // A kernel booted again (as in tests) replaces the instance with one of its own serializer
        if ($registry->has(JsonDocumentType::NAME)) {
            $registry->override(JsonDocumentType::NAME, $type);
        } else {
            $registry->register(JsonDocumentType::NAME, $type);
        }
    }
}
