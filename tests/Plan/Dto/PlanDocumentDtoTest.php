<?php

namespace App\Tests\Plan\Dto;

use App\Plan\Dto\BezierElementDto;
use App\Plan\Dto\EllipseElementDto;
use App\Plan\Dto\PlanDocumentDto;
use App\Plan\Dto\PolylineElementDto;
use App\Plan\Enum\PlanUnit;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * The models describe the JSON the editor reads (CadSerializer.parseDocument): the sample plan
 * the editor is tested with goes through them unchanged.
 */
final class PlanDocumentDtoTest extends KernelTestCase
{
    private const string SAMPLE_PLAN = __DIR__.'/../../../fixtures/plans/sample-plan.json';

    public function testSamplePlanRoundTripsThroughTheModels(): void
    {
        $json = file_get_contents(self::SAMPLE_PLAN);
        $document = $this->serializer()->deserialize($json, PlanDocumentDto::class, 'json');

        self::assertInstanceOf(PlanDocumentDto::class, $document);
        self::assertSame(PlanUnit::Millimetre, $document->unit);
        self::assertContainsOnlyInstancesOf(PolylineElementDto::class, [$document->elements[0], $document->elements[1]]);
        self::assertInstanceOf(BezierElementDto::class, $document->elements[9]);

        $expected = json_decode($json, true, flags: \JSON_THROW_ON_ERROR);
        // The model always carries the rotation, which the editor treats as 0 when it is missing
        foreach ($expected['elements'] as $i => $element) {
            if (EllipseElementDto::TYPE === $element['type']) {
                $expected['elements'][$i]['rotation'] ??= 0;
            }
        }

        $actual = json_decode($this->serializer()->serialize($document, 'json'), true, flags: \JSON_THROW_ON_ERROR);
        self::assertEquals($expected, $actual);
    }

    public function testSamplePlanIsValid(): void
    {
        $document = $this->serializer()->deserialize(file_get_contents(self::SAMPLE_PLAN), PlanDocumentDto::class, 'json');

        self::assertCount(0, static::getContainer()->get(ValidatorInterface::class)->validate($document));
    }

    public function testNestedModelsAreValidated(): void
    {
        $json = json_decode(file_get_contents(self::SAMPLE_PLAN), true, flags: \JSON_THROW_ON_ERROR);
        $json['elements'][5]['radius'] = 0; // the table, a circle

        $document = $this->serializer()->deserialize(json_encode($json), PlanDocumentDto::class, 'json');
        $violations = static::getContainer()->get(ValidatorInterface::class)->validate($document);

        self::assertCount(1, $violations);
        self::assertSame('elements[5].radius', $violations[0]->getPropertyPath());
    }

    private function serializer(): SerializerInterface
    {
        return static::getContainer()->get(SerializerInterface::class);
    }
}
