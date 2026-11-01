<?php

namespace App\Tests\Core\Tenancy;

use App\Core\Tenancy\Entity\Tenant;
use App\Core\Tenancy\Exception\InvalidTenantHashException;
use App\Core\Tenancy\Exception\TenantNotSelectedException;
use App\Core\Tenancy\Exception\TenantProvisioningException;
use App\Core\Tenancy\Repository\TenantRepository;
use App\Core\Tenancy\TenantProvisioner;
use App\Core\Tenancy\TenantSwitcher;
use App\Project\Command\CreateProjectCommand;
use App\Project\Query\GetProjectQuery;
use App\Project\Query\ProjectDto;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Messenger\Stamp\HandledStamp;
use Symfony\Component\Uid\Uuid;

/**
 * Builds real tenant databases (app_<hash>_test) and removes them again.
 */
final class TenantProvisionerTest extends KernelTestCase
{
    /** @var list<string> */
    private array $created = [];

    protected function tearDown(): void
    {
        foreach ($this->created as $hash) {
            if (null !== $this->repository()->findByHash($hash)) {
                $this->provisioner()->delete($hash);
            }
        }

        parent::tearDown();
    }

    public function testCreatedTenantHasDatabaseWithSchema(): void
    {
        $tenant = $this->createTenant();

        self::assertMatchesRegularExpression('/^[a-z0-9]{'.TenantProvisioner::HASH_LENGTH.'}$/', $tenant->getHash());
        $database = $this->provisioner()->databaseName($tenant->getHash());
        self::assertContains($database, $this->provisioner()->databaseNames());
        self::assertSame($tenant->getHash(), $this->repository()->findBySlug($tenant->getSlug())?->getHash());

        $this->switchTo($tenant);
        self::assertTrue($this->tenantConnection()->createSchemaManager()->tablesExist(['project']));
    }

    public function testCreatesTheTenantWithTheGivenHash(): void
    {
        $hash = 'phpunit'.bin2hex(random_bytes(4));

        $tenant = $this->createTenant($hash);

        self::assertSame($hash, $tenant->getHash());
        $this->switchTo($tenant);
        self::assertSame($hash, static::getContainer()->get(TenantSwitcher::class)->current());
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
        self::assertEquals(new ProjectDto($id->toRfc4122(), 'Einfamilienhaus'), $this->query(new GetProjectQuery($id)));
    }

    public function testDeleteDropsDatabaseAndRegistryEntry(): void
    {
        $tenant = $this->createTenant();
        $database = $this->provisioner()->databaseName($tenant->getHash());

        $this->provisioner()->delete($tenant->getHash());

        self::assertNull($this->repository()->findByHash($tenant->getHash()));
        self::assertNotContains($database, $this->provisioner()->databaseNames());
    }

    public function testNameWithAnExistingSlugIsRefused(): void
    {
        $tenant = $this->createTenant();

        $this->expectException(TenantProvisioningException::class);

        $this->provisioner()->create(mb_strtolower($tenant->getName()));
    }

    public function testExistingHashIsRefused(): void
    {
        $tenant = $this->createTenant();

        $this->expectException(TenantProvisioningException::class);

        $this->provisioner()->create('Phpunit '.bin2hex(random_bytes(4)), $tenant->getHash());
    }

    #[DataProvider('invalidHashes')]
    public function testInvalidHashIsRefused(string $hash): void
    {
        $this->expectException(InvalidTenantHashException::class);

        $this->provisioner()->create('Phpunit '.bin2hex(random_bytes(4)), $hash);
    }

    /**
     * @return iterable<string, array{string}>
     */
    public static function invalidHashes(): iterable
    {
        yield 'empty' => [''];
        yield 'upper case' => ['K3x9q2mf'];
        yield 'underscore' => ['demo_test'];
        yield 'hyphen' => ['k3x9-q2mf'];
        yield 'quote' => ['demo`'];
        yield 'too long' => [str_repeat('a', Tenant::HASH_MAX_LENGTH + 1)];
        yield 'main database' => ['main'];
    }

    public function testDatabaseNameIsPrefixHashSuffix(): void
    {
        // The test environment's suffix, see config/services.yaml
        self::assertSame('app_k3x9q2mf_test', $this->provisioner()->databaseName('k3x9q2mf'));
    }

    public function testTenantHashIsTheReverseOfDatabaseName(): void
    {
        self::assertSame('k3x9q2mf', $this->provisioner()->tenantHash('app_k3x9q2mf_test'));

        self::assertNull($this->provisioner()->tenantHash('app_main_test'));
        self::assertNull($this->provisioner()->tenantHash('app_k3x9q2mf'));
        self::assertNull($this->provisioner()->tenantHash('app_k3x9_q2mf_test'));
        self::assertNull($this->provisioner()->tenantHash('other_k3x9q2mf_test'));
    }

    public function testTenantConnectionRefusesQueriesBeforeSelection(): void
    {
        $this->expectException(TenantNotSelectedException::class);

        $this->tenantConnection()->fetchOne('SELECT 1');
    }

    private function createTenant(?string $hash = null): Tenant
    {
        $tenant = $this->provisioner()->create('Phpunit Büro '.bin2hex(random_bytes(4)), $hash);
        $this->created[] = $tenant->getHash();

        return $tenant;
    }

    private function switchTo(Tenant $tenant): void
    {
        static::getContainer()->get(TenantSwitcher::class)->switchTo($tenant->getHash());
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
