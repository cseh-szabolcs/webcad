<?php

namespace App\Core\Tenancy;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Driver\Connection as DriverConnection;
use Doctrine\DBAL\Driver\Exception as DriverException;
use Doctrine\DBAL\DriverManager;

/**
 * The DBAL connection of the tenant entity manager (wrapper_class in config/packages/doctrine.yaml).
 * Its configured database is app_main; it connects to the selected tenant's database instead and,
 * until one is selected, refuses to connect, so nothing silently reads or writes app_main.
 *
 * @phpstan-import-type Params from DriverManager
 */
class TenantConnection extends Connection
{
    private ?string $tenantDatabase = null;

    /**
     * Only TenantSwitcher calls this, together with clearing the tenant entity manager.
     */
    public function selectDatabase(string $database): void
    {
        if ($database === $this->tenantDatabase) {
            return;
        }

        // Reconnect lazily on the next query; the database need not exist yet.
        $this->close();
        $this->tenantDatabase = $database;
    }

    public function getTenantDatabase(): ?string
    {
        return $this->tenantDatabase;
    }

    /**
     * The selected tenant database as dbname, so tooling reading the params (doctrine:database:*,
     * migrations) targets it. Without wrapperClass, or the connections DBAL derives from these
     * params would be guarded too.
     *
     * @return array<string, mixed>
     *
     * @phpstan-return Params
     */
    public function getParams(): array
    {
        $params = parent::getParams();
        if (null !== $this->tenantDatabase) {
            $params['dbname'] = $this->tenantDatabase;
        }
        unset($params['wrapperClass']);

        return $params;
    }

    /**
     * The parent connects with its private params, which always name app_main.
     */
    protected function connect(): DriverConnection
    {
        if (null === $this->tenantDatabase) {
            throw new TenantNotSelectedException();
        }

        if (null !== $this->_conn) {
            return $this->_conn;
        }

        try {
            $connection = $this->_conn = $this->driver->connect($this->getParams());
        } catch (DriverException $e) {
            throw $this->convertException($e);
        }

        if (false === $this->isAutoCommit()) {
            $this->beginTransaction();
        }

        return $connection;
    }
}
