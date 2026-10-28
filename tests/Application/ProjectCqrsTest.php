<?php

namespace App\Tests\Application;

use App\Application\Command\CreateProjectCommand;
use App\Application\DTO\ProjectDTO;
use App\Application\Query\GetProjectQuery;
use App\Infrastructure\Tenancy\TenantSwitcher;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Messenger\Exception\ValidationFailedException;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Messenger\Stamp\HandledStamp;
use Symfony\Component\Uid\Uuid;

final class ProjectCqrsTest extends KernelTestCase
{
    protected function setUp(): void
    {
        // Without a request or console command, nothing selects the tenant (see .env.test)
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
    }

    public function testCreatedProjectCanBeQueried(): void
    {
        $id = Uuid::v7();

        $this->commandBus()->dispatch(new CreateProjectCommand($id, 'Einfamilienhaus'));
        // So the query reads the stored project, not the one in the identity map
        static::getContainer()->get(EntityManagerInterface::class)->clear();
        $project = $this->query(new GetProjectQuery($id));

        self::assertEquals(new ProjectDTO($id->toRfc4122(), 'Einfamilienhaus'), $project);
    }

    public function testUnknownProjectReturnsNull(): void
    {
        self::assertNull($this->query(new GetProjectQuery(Uuid::v7())));
    }

    public function testCommandBusValidatesCommands(): void
    {
        $this->expectException(ValidationFailedException::class);

        $this->commandBus()->dispatch(new CreateProjectCommand(Uuid::v7(), ''));
    }

    private function commandBus(): MessageBusInterface
    {
        return static::getContainer()->get('command.bus');
    }

    private function query(object $query): mixed
    {
        $envelope = static::getContainer()->get('query.bus')->dispatch($query);

        return $envelope->last(HandledStamp::class)?->getResult();
    }
}
