<?php

namespace App\Tests\Core\Doctrine;

use App\Core\Doctrine\ListPaginator;
use App\Core\Tenancy\TenantSwitcher;
use App\Project\Entity\Project;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Uid\Uuid;

/**
 * Against the test database, with projects (any entity would do). The database is not reset
 * between tests, so each test only looks at the projects of its own random name prefix.
 */
final class ListPaginatorTest extends KernelTestCase
{
    private string $prefix;

    protected function setUp(): void
    {
        // Without a request or console command, nothing selects the tenant (see .env.test)
        static::getContainer()->get(TenantSwitcher::class)->switchTo($_ENV['DEFAULT_TENANT']);
        $this->prefix = 'paginator-'.bin2hex(random_bytes(4)).'-';
    }

    public function testReturnsThePageInTheOrderOfTheQuery(): void
    {
        $this->createProjects(23);

        $result = ListPaginator::paginate($this->projects('DESC'), 2, 5, $this->shortName(...));

        self::assertSame(['p18', 'p17', 'p16', 'p15', 'p14'], $result->items);
        self::assertSame(2, $result->page);
        self::assertSame(5, $result->pageSize);
        self::assertSame(23, $result->total);
    }

    public function testReturnsTheShortLastPage(): void
    {
        $this->createProjects(23);

        $result = ListPaginator::paginate($this->projects('ASC'), 5, 5, $this->shortName(...));

        self::assertSame(['p21', 'p22', 'p23'], $result->items);
        self::assertSame(5, $result->page);
    }

    public function testBringsAPageBeyondTheLastBackToTheLast(): void
    {
        $this->createProjects(7);

        $result = ListPaginator::paginate($this->projects('ASC'), 99, 5, $this->shortName(...));

        self::assertSame(['p06', 'p07'], $result->items);
        self::assertSame(2, $result->page);
        self::assertSame(7, $result->total);
    }

    public function testAnEmptyListIsPageOne(): void
    {
        $result = ListPaginator::paginate($this->projects('ASC'), 3, 5, $this->shortName(...));

        self::assertSame([], $result->items);
        self::assertSame(1, $result->page);
        self::assertSame(0, $result->total);
    }

    private function createProjects(int $count): void
    {
        $em = $this->em();
        foreach (range(1, $count) as $number) {
            $em->persist(new Project(Uuid::v7(), sprintf('%sp%02d', $this->prefix, $number)));
        }
        $em->flush();
        $em->clear();
    }

    /** The projects of this test, ordered by name. */
    private function projects(string $direction): QueryBuilder
    {
        return $this->em()->createQueryBuilder()
            ->select('p')
            ->from(Project::class, 'p')
            ->where('p.name LIKE :prefix')
            ->setParameter('prefix', $this->prefix.'%')
            ->orderBy('p.name', $direction)
            ->addOrderBy('p.id', $direction);
    }

    /** The name without the prefix, as the "DTO" of the test. */
    private function shortName(Project $project): string
    {
        return substr($project->getName(), strlen($this->prefix));
    }

    private function em(): EntityManagerInterface
    {
        return static::getContainer()->get(EntityManagerInterface::class);
    }
}
