<?php

namespace App\Infrastructure\Tenancy;

use App\Infrastructure\Tenancy\Console\Application;
use Symfony\Component\Console\Input\StringInput;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\HttpKernel\KernelInterface;

/**
 * Runs a console command against one tenant, in process and in a kernel of its own. A fresh kernel
 * per run, because services such as the migrations' DependencyFactory are single-use: they remember
 * the state of the first database they saw. In process rather than as a subprocess, which would
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
    public function run(string $tenant, string $commandLine, OutputInterface $output): int
    {
        $kernelClass = $this->kernel::class;
        $kernel = new $kernelClass($this->kernel->getEnvironment(), $this->kernel->isDebug());
        $kernel->boot();

        try {
            $application = new Application($kernel);
            $application->setAutoExit(false);
            $application->setCatchExceptions(false);

            // Tenant names need no quoting, see TenantNaming
            $input = new StringInput(\sprintf('%s --no-interaction --%s=%s', $commandLine, Application::TENANT_OPTION, $tenant));

            return $application->run($input, $output);
        } finally {
            $kernel->shutdown();
        }
    }
}
