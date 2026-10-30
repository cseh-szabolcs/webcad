CQRS in this project
====================

Writes go through **commands**, reads through **queries**, each a Messenger message with one
handler on a bus of its own (`command.bus`, `query.bus`, configured in
`config/packages/messenger.yaml`, both synchronous for now: no async transport or worker yet).
The reference example is `CreateProjectCommand`/`GetProjectQuery` in `src/Project/`, tested in
`tests/Project/ProjectCqrsTest.php`.

Rules
-----

- **Commands** are named after business tasks, not field setters (`PublishPlanCommand`, not
  `SetPlanHeadCommand`). Their handlers only `persist()`: the `doctrine_transaction` middleware
  of `command.bus` flushes and commits (and rolls back on an exception). Constraints on the
  command (`#[Assert\…]`) are checked by the `validation` middleware before the handler runs.
- **Queries** never modify state and return DTOs (`…Dto`, only DTOs and scalar values, never
  entities), or `null` for "not found".
- Pin each handler to its bus: `#[AsMessageHandler(bus: 'command.bus'|'query.bus')]`.
- **Entities and repositories, not native SQL**: handlers and readers load through one
  `ServiceEntityRepository` per entity (named in the entity's `repositoryClass`, in the area's
  `Repository/`, no interfaces), with finders of their own where `find`/`findBy` is not enough
  (e.g. `findByPlanVersion`). DBAL or SQL only for a measured reason, and only after asking; a
  separate read model only for a read that is measured to be too slow.
- Load what a read needs in a **fixed number of queries** (fetch joins instead of a lazy load per
  entity).
- A UUID parameter of a DQL query is bound as `setParameter(…, $uuid, UuidType::NAME)`: an entity
  or a `Uuid` without the type is not bound as BINARY(16) and **silently matches nothing**
  (`findBy` is fine).

Folders
-------

Grouped by business area, not by layer: a command and its handler side by side in the area's
`Command/`, a query, its handler and the DTO it returns in `Query/`, the controller that sends it
in `Controller/Api/` (one per endpoint, `__invoke`, named after the message). See "Backend
layout" in `CLAUDE.md`.

Example
-------

```php
// src/Project/Command/CreateProjectHandler.php
#[AsMessageHandler(bus: 'command.bus')]
final readonly class CreateProjectHandler
{
    public function __construct(private EntityManagerInterface $entityManager) {}

    public function __invoke(CreateProjectCommand $command): void
    {
        // flush and commit are done by the doctrine_transaction middleware
        $this->entityManager->persist(new Project($command->id, $command->name));
    }
}

// src/Project/Query/GetProjectHandler.php
#[AsMessageHandler(bus: 'query.bus')]
final readonly class GetProjectHandler
{
    public function __construct(private ProjectRepository $projects) {}

    public function __invoke(GetProjectQuery $query): ?ProjectDto
    {
        $project = $this->projects->find($query->id);

        return null === $project ? null : new ProjectDto($project->getId()->toRfc4122(), $project->getName());
    }
}
```

A controller dispatches with `HandleTrait` on the bus it needs (see
`src/Plan/Controller/Api/GetPlanDocumentController.php`: `#[Autowire(service: 'query.bus')]`,
then `$this->handle(new GetPlanDocumentQuery($id))`); request data is bound with
`#[MapRequestPayload]`/`#[MapQueryString]`, never `json_decode()`. A command that creates
something carries the new id (`CreateProjectCommand::$id`), so the caller knows it without a
return value.
