<?php

namespace App\Core\Tenancy;

use App\Core\Tenancy\Console\Application;
use Symfony\Component\Console\Input\StringInput;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\HttpKernel\KernelInterface;

/**
 * Runs a console command against one tenant (or, without one, against app_main, e.g. with
 * --em=main), in process and in a kernel of its own. A fresh kernel per run, because services such as
 * the migrations' DependencyFactory are single-use: they remember the state of the first database
 * they saw, and the entity managers of the calling kernel stay untouched. In process rather than as a subprocess, which would
 * inherit the booted kernel's file descriptors and can hang on a pipe that never reaches EOF.
 */
final readonly class TenantCommandRunner
{
    public function __construct(
        private KernelInterface $kernel,
    ) {
    }

    /**
     * @return int the exit code of the command
     *
     * @throws \Throwable whatever the command throws
     */
    public function run(?string $tenant, string $commandLine, OutputInterface $output): int
    {
        $kernelClass = $this->kernel::class;
        $kernel = new $kernelClass($this->kernel->getEnvironment(), $this->kernel->isDebug());
        $kernel->boot();

        try {
            $application = new Application($kernel);
            $application->setAutoExit(false);
            $application->setCatchExceptions(false);

            // Tenant hashes need no quoting, see TenantProvisioner
            $input = new StringInput(null === $tenant
                ? \sprintf('%s --no-interaction', $commandLine)
                : \sprintf('%s --no-interaction --%s=%s', $commandLine, Application::TENANT_OPTION, $tenant));

            return $application->run($input, $output);
        } finally {
            $kernel->shutdown();
        }
    }
}
