<?php

namespace App\Tests\Fixtures;

use App\Core\Tenancy\Repository\TenantRepository;
use App\Core\Tenancy\TenantProvisioner;
use App\Core\Tenancy\TenantSwitcher;
use App\Fixtures\Console\FixtureCreateCommand;
use App\Plan\Entity\Plan;
use App\User\Entity\User;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

/**
 * Rebuilds the test databases (app_main_test, app_<tenant>_test) for real; afterwards they hold the
 * default test tenant again, as the other tests expect.
 */
final class DatabaseRebuildCommandTest extends KernelTestCase
{
    public function testDropsAllDatabasesAndBuildsMainAndOneTenant(): void
    {
        $other = static::getContainer()->get(TenantProvisioner::class)->create('Phpunit '.bin2hex(random_bytes(4)));

        self::assertSame(Command::SUCCESS, $this->tester()->execute(['--force' => true, '--tenant-hash' => $_ENV['DEFAULT_TENANT']]));

        $databases = static::getContainer()->get(TenantProvisioner::class)->databaseNames();
        self::assertNotContains(static::getContainer()->get(TenantProvisioner::class)->databaseName($other->getHash()), $databases);
        self::assertTrue($this->mainConnection()->createSchemaManager()->tablesExist(['tenant', 'token']));
        self::assertSame([['Demo', 'demo', $_ENV['DEFAULT_TENANT']]], array_map(
            static fn ($tenant) => [$tenant->getName(), $tenant->getSlug(), $tenant->getHash()],
            static::getContainer()->get(TenantRepository::class)->findAllOrdered(),
        ));

        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
        $em = static::getContainer()->get(EntityManagerInterface::class);
        self::assertCount(1, $em->getRepository(Plan::class)->findAll());
        self::assertNotNull($em->getRepository(User::class)->findOneBy(['email' => FixtureCreateCommand::DEV_USER_EMAIL]));
    }

    public function testDeclinedConfirmationChangesNothing(): void
    {
        $tester = $this->tester();
        $tester->setInputs(['no']);

        self::assertSame(Command::SUCCESS, $tester->execute([]));
        self::assertStringContainsString('Aborted', $tester->getDisplay());
        self::assertNotNull(static::getContainer()->get(TenantRepository::class)->findByHash($_ENV['DEFAULT_TENANT']));
    }

    private function tester(): CommandTester
    {
        return new CommandTester((new Application(self::bootKernel()))->find('app:database:rebuild'));
    }

    private function mainConnection(): Connection
    {
        return static::getContainer()->get('doctrine.dbal.main_connection');
    }
}
