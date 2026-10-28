<?php

namespace App\Tests\Application\Reader;

use App\Application\Factory\PlanFactory;
use App\Application\Model\Plan\PlanDocument;
use App\Application\Reader\PlanDocumentReader;
use App\Domain\Entity\Plan;
use App\Domain\Entity\PlanVersion;
use App\Domain\Entity\Project;
use App\Infrastructure\Fixtures\Console\FixtureCreateCommand;
use App\Infrastructure\Tenancy\TenantSwitcher;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Uid\Uuid;

final class PlanDocumentReaderTest extends KernelTestCase
{
    protected function setUp(): void
    {
        // Without a request or console command, nothing selects the tenant (see .env.test)
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
    }

    public function testNeedsOneQueryPerKindOfContent(): void
    {
        $draft = $this->storedDraft($this->sampleDocument());
        $queries = static::getContainer()->get('doctrine.debug_data_holder');
        $queries->reset();

        static::getContainer()->get(PlanDocumentReader::class)->read($draft);

        // Vertices, polylines with their vertices, elements, layers, groups, styles; none per element
        self::assertCount(6, $queries->getData()['tenant']);
    }

    private function sampleDocument(): PlanDocument
    {
        $container = static::getContainer();
        $json = file_get_contents($container->getParameter('kernel.project_dir').FixtureCreateCommand::SAMPLE_PLAN);

        return $container->get(SerializerInterface::class)->deserialize($json, PlanDocument::class, 'json');
    }

    /**
     * The draft as loaded in a later request: stored, and nothing of it in the identity map.
     */
    private function storedDraft(PlanDocument $document): PlanVersion
    {
        $em = static::getContainer()->get(EntityManagerInterface::class);
        $project = new Project(Uuid::v7(), 'Beispielprojekt');
        $em->persist($project);
        $plan = static::getContainer()->get(PlanFactory::class)->create($project, $document);
        $em->flush();
        $em->clear();

        $draft = $em->find(Plan::class, $plan->getId())->getDraft();
        $draft->getUnit(); // loads the version itself, which is not part of the reading

        return $draft;
    }
}
