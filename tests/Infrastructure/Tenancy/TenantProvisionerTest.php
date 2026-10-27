<?php

namespace App\Tests\Infrastructure\Tenancy;

use App\Application\Command\CreateProjectCommand;
use App\Application\DTO\ProjectDTO;
use App\Application\Query\GetProjectQuery;
use App\Infrastructure\Tenancy\TenantNaming;
use App\Infrastructure\Tenancy\TenantNotSelectedException;
use App\Infrastructure\Tenancy\TenantProvisioner;
use App\Infrastructure\Tenancy\TenantProvisioningException;
use App\Infrastructure\Tenancy\TenantRepository;
use App\Infrastructure\Tenancy\TenantSwitcher;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Messenger\Stamp\HandledStamp;
use Symfony\Component\Uid\Uuid;

/**
 * Builds real tenant databases (app_phpunit_…_test) and removes them again.
 */
final class TenantProvisionerTest extends KernelTestCase
{
    /** @var list<string> */
    private array $created = [];

    protected function tearDown(): void
    {
        foreach ($this->created as $name) {
            if (null !== $this->repository()->findByName($name)) {
                $this->provisioner()->delete($name);
            }
        }

        parent::tearDown();
    }

    public function testCreatedTenantHasMigratedDatabase(): void
    {
        $name = $this->createTenant();

        $database = static::getContainer()->get(TenantNaming::class)->databaseName($name);
        self::assertContains($database, $this->mainConnection()->createSchemaManager()->listDatabases());
        self::assertSame('Phpunit', $this->repository()->findByName($name)?->getDisplayName());

        $this->switchTo($name);
        self::assertTrue($this->tenantConnection()->createSchemaManager()->tablesExist(['project']));
    }

    public function testTenantsDoNotSeeEachOthersData(): void
    {
        $first = $this->createTenant();
        $second = $this->createTenant();
        $id = Uuid::v7();

        $this->switchTo($first);
        static::getContainer()->get('command.bus')->dispatch(new CreateProjectCommand($id, 'Einfamilienhaus'));

        $this->switchTo($second);
        self::assertNull($this->query(new GetProjectQuery($id)));

        $this->switchTo($first);
        self::assertEquals(new ProjectDTO($id->toRfc4122(), 'Einfamilienhaus'), $this->query(new GetProjectQuery($id)));
    }

    public function testDeleteDropsDatabaseAndRegistryEntry(): void
    {
        $name = $this->createTenant();
        $database = static::getContainer()->get(TenantNaming::class)->databaseName($name);

        $this->provisioner()->delete($name);

        self::assertNull($this->repository()->findByName($name));
        self::assertNotContains($database, $this->mainConnection()->createSchemaManager()->listDatabases());
    }

    public function testExistingTenantIsRefused(): void
    {
        $name = $this->createTenant();

        $this->expectException(TenantProvisioningException::class);

        $this->provisioner()->create($name, 'Phpunit');
    }

    public function testTenantConnectionRefusesQueriesBeforeSelection(): void
    {
        $this->expectException(TenantNotSelectedException::class);

        $this->tenantConnection()->fetchOne('SELECT 1');
    }

    private function createTenant(): string
    {
        $name = 'phpunit_'.bin2hex(random_bytes(4));
        $this->created[] = $name;
        $this->provisioner()->create($name, 'Phpunit');

        return $name;
    }

    private function switchTo(string $name): void
    {
        static::getContainer()->get(TenantSwitcher::class)->switchTo($name);
    }

    private function query(object $query): mixed
    {
        $envelope = static::getContainer()->get('query.bus')->dispatch($query);

        return $envelope->last(HandledStamp::class)?->getResult();
    }

    private function provisioner(): TenantProvisioner
    {
        return static::getContainer()->get(TenantProvisioner::class);
    }

    private function repository(): TenantRepository
    {
        return static::getContainer()->get(TenantRepository::class);
    }

    private function mainConnection(): Connection
    {
        return static::getContainer()->get('doctrine.dbal.main_connection');
    }

    private function tenantConnection(): Connection
    {
        return static::getContainer()->get('doctrine.dbal.tenant_connection');
    }
}
