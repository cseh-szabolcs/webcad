<?php

namespace App\Tests\Plan\Controller;

use App\Core\Tenancy\TenantSwitcher;
use App\Fixtures\FixtureCreateCommand;
use App\Plan\Dto\EllipseElementDto;
use App\Plan\Dto\PlanDocumentDto;
use App\Plan\Entity\Plan;
use App\Plan\Entity\Vertex;
use App\Plan\PlanDocumentReader;
use App\Plan\PlanFactory;
use App\Plan\PlanVersionCopier;
use App\Project\Entity\Project;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Uid\Uuid;

final class PlanDocumentControllerTest extends WebTestCase
{
    private KernelBrowser $client;
    private string $planId;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $container = static::getContainer();
        // The request selects the tenant itself; creating the plan beforehand needs it too
        $container->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);

        $em = $container->get(EntityManagerInterface::class);
        $project = new Project(Uuid::v7(), 'Beispielprojekt');
        $em->persist($project);
        $plan = $container->get(PlanFactory::class)->create($project, $this->sampleDocument());
        $em->flush();
        $em->clear();

        $this->planId = $plan->getId()->toRfc4122();
    }

    public function testReturnsThePlanFromTheDatabase(): void
    {
        $this->client->request('GET', '/api/plans/'.$this->planId.'/document');

        self::assertResponseIsSuccessful();
        self::assertResponseHeaderSame('Content-Type', 'application/json');
        self::assertResponseHeaderSame('ETag', '"1"');

        $actual = json_decode($this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        self::assertSame($this->planId, $actual['id']);

        $expected = json_decode(file_get_contents($this->sampleFile()), true, flags: \JSON_THROW_ON_ERROR);
        foreach ($expected['elements'] as $i => $element) {
            if (EllipseElementDto::TYPE === $element['type']) {
                $expected['elements'][$i]['rotation'] ??= 0;
            }
        }

        // Same document as the sample, with every id replaced by a new one in the same order
        $ids = [$actual['id'] => $expected['id']];
        foreach (['vertices', 'layers', 'groups', 'styles', 'elements'] as $list) {
            self::assertCount(\count($expected[$list]), $actual[$list], $list);
            foreach ($actual[$list] as $i => $item) {
                $ids[$item['id']] = $expected[$list][$i]['id'];
            }
        }
        array_walk_recursive($actual, static function (mixed &$value) use ($ids): void {
            if (\is_string($value) && isset($ids[$value])) {
                $value = $ids[$value];
            }
        });

        self::assertEquals($expected, $actual);
    }

    public function testServesTheDraftWhenAHeadExists(): void
    {
        $container = static::getContainer();
        $em = $container->get(EntityManagerInterface::class);
        $plan = $em->find(Plan::class, Uuid::fromString($this->planId));
        // Built by hand: no service uses it before the publish action exists, so the container drops it
        $copier = new PlanVersionCopier($container->get(PlanDocumentReader::class), $container->get(PlanFactory::class));
        $plan->publish($head = $copier->copy($plan->getDraft()));
        $em->flush();

        $this->client->request('GET', '/api/plans/'.$this->planId.'/document');

        $document = json_decode($this->client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
        $draftVertices = $em->getRepository(Vertex::class)->findBy(['planVersion' => $plan->getDraft()]);
        self::assertContains($document['vertices'][0]['id'], array_map(static fn (Vertex $v): string => $v->getId()->toRfc4122(), $draftVertices));
        self::assertNotEquals($head->getId(), $plan->getDraft()->getId());
    }

    public function testMatchingEtagReturns304(): void
    {
        $this->client->request('GET', '/api/plans/'.$this->planId.'/document', server: ['HTTP_IF_NONE_MATCH' => '"1"']);

        self::assertResponseStatusCodeSame(304);
    }

    public function testUnknownPlanReturns404(): void
    {
        $this->client->request('GET', '/api/plans/'.Uuid::v7()->toRfc4122().'/document');

        self::assertResponseStatusCodeSame(404);
    }

    public function testNonUuidIdReturns404(): void
    {
        $this->client->request('GET', '/api/plans/sample-plan/document');

        self::assertResponseStatusCodeSame(404);
    }

    private function sampleDocument(): PlanDocumentDto
    {
        return static::getContainer()->get(SerializerInterface::class)->deserialize(file_get_contents($this->sampleFile()), PlanDocumentDto::class, 'json');
    }

    private function sampleFile(): string
    {
        return static::getContainer()->getParameter('kernel.project_dir').FixtureCreateCommand::SAMPLE_PLAN;
    }
}
