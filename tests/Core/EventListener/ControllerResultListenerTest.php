<?php

namespace App\Tests\Core\EventListener;

use App\Core\EventListener\ControllerResultListener;
use App\Core\Http\ApiResponse;
use App\Tests\Core\Doctrine\Fixtures\CircleShape;
use App\Tests\Core\Doctrine\Fixtures\Point;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ViewEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Component\Serializer\Normalizer\AbstractNormalizer;

final class ControllerResultListenerTest extends KernelTestCase
{
    public function testSerializesTheDataAsJson(): void
    {
        $response = $this->dispatch(new ApiResponse(new Point(1.5, -2.0)));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('application/json', $response->headers->get('Content-Type'));
        self::assertJsonStringEqualsJsonString('{"x":1.5,"y":-2.0}', $response->getContent());
        self::assertNull($response->getEtag());
    }

    public function testEncodesLikeAbstractControllerJson(): void
    {
        // Whole floats without ".0", and HTML-safe escaping
        $response = $this->dispatch(new ApiResponse(['x' => 6000.0, 'name' => '<a href="x">\'&\'</a>']));

        self::assertSame('{"x":6000,"name":"\u003Ca href=\u0022x\u0022\u003E\u0027\u0026\u0027\u003C\/a\u003E"}', $response->getContent());
    }

    public function testUsesStatusAndSerializerContext(): void
    {
        $response = $this->dispatch(new ApiResponse(
            new CircleShape(600.0, true),
            context: [AbstractNormalizer::IGNORED_ATTRIBUTES => ['filled']],
            status: 201,
        ));

        self::assertSame(201, $response->getStatusCode());
        self::assertJsonStringEqualsJsonString('{"type":"circle","radius":600.0}', $response->getContent());
    }

    public function testSetsTheEtag(): void
    {
        $response = $this->dispatch(new ApiResponse(new Point(1.0, 2.0), etag: '7'));

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('"7"', $response->getEtag());
    }

    public function testMatchingIfNoneMatchGives304(): void
    {
        $request = new Request();
        $request->headers->set('If-None-Match', '"7"');

        $response = $this->dispatch(new ApiResponse(new Point(1.0, 2.0), etag: '7'), $request);

        self::assertSame(304, $response->getStatusCode());
        self::assertSame('', $response->getContent());
    }

    public function testOtherResultsAreLeftAlone(): void
    {
        $event = $this->event(['plain' => 'array']);

        $this->listener()($event);

        self::assertFalse($event->hasResponse());
    }

    private function dispatch(ApiResponse $result, Request $request = new Request()): Response
    {
        $event = $this->event($result, $request);
        $this->listener()($event);

        self::assertTrue($event->hasResponse());

        return $event->getResponse();
    }

    private function event(mixed $result, Request $request = new Request()): ViewEvent
    {
        return new ViewEvent(self::bootKernel(), $request, HttpKernelInterface::MAIN_REQUEST, $result);
    }

    private function listener(): ControllerResultListener
    {
        return static::getContainer()->get(ControllerResultListener::class);
    }
}
