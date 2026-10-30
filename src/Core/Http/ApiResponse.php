<?php

namespace App\Core\Http;

/**
 * What an API controller returns instead of a Response: ControllerResultListener serializes the
 * data to JSON and sets the ETag, answering 304 when the request's If-None-Match matches it. So
 * query results stay free of HTTP; the controller decides what of them goes where.
 */
final readonly class ApiResponse
{
    /**
     * @param array<string, mixed> $context serializer context, e.g. groups
     */
    public function __construct(
        public mixed $data,
        public ?string $etag = null,
        public array $context = [],
        public int $status = 200,
    ) {
    }
}
