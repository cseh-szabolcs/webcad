Plans: storage, versions, document
==================================

Decisions and pitfalls; the fields themselves are in the entities (`src/Plan/Entity`). The
concept and its history are in `docs/todo/setup.md` ("Dokumentpersistenz", German).

Decisions
---------

- **Relational, one entity per object**, mirroring the editor's document model, instead of one
  JSON document per version: it fits the editor's commands, which report the changed element
  ids, and allows saving only what changed later. Display values (radius, `closed`, control
  vectors) are columns of the element subclass too (single table inheritance, so nullable in the
  database, never in PHP). A new display value is a field, a migration and a field of its
  `…ElementDto`.
- **Versioned:** the contents belong to a `PlanVersion`. A plan always has a **draft**, which the
  editor works on, and after the first publish a **head**. Publishing (the action comes later) is
  `$plan->publish($copier->copy($plan->getDraft()), $name)`: the copy becomes the head with the
  next number; earlier heads stay as history, the draft stays.
- **Plan vs. plan document:** `Plan` is only the frame (project, name, draft/head, versions;
  later `PlanDto` for `GET /api/plans/{id}`). The *plan document* is the drawing of one version
  as a whole, the editor's `CadDocument`. It has no entity, as it is stored spread over the
  content entities; it exists only as `PlanDocumentDto`, built by `PlanDocumentReader`, taken
  apart by `PlanFactory`, sent by `GET /api/plans/{id}/document` with the revision as ETag.
  `schemaVersion` belongs to this wire format, not to the database.
- **Copies go through the document**, not `__clone`: `PlanVersionCopier` reads a version and
  builds it again with `PlanFactory::createVersion`, because only that rewrites the references
  between the copies (fresh UUIDv7 everywhere, shared vertices stay shared). It copies the stored
  state, so flush first.

Pitfalls
--------

- `plan.draft_id`/`head_id` and `plan_version.plan_id` refer to each other, so draft and head are
  `SET NULL` on delete; otherwise deleting a plan is blocked by the versions it cascades to.
- `PlanUnit` lives in `Enum/`, not `Entity/`: `EntityMappingTest` treats every file there as an
  entity (or embeddable, like `Vector2`).
- A read must stay at one query per kind of content (`ElementRepository` fetch-joins the polyline
  vertices); `PlanDocumentReaderTest` counts them.
- The sample plan exists twice, `fixtures/plans/sample-plan.json` (backend: source of
  `app:fixture:create`, expected document of the API tests) and
  `depts/editor/src/cad/__fixtures__/sample-plan.json` (editor tests), because the `php`
  container cannot see `depts/`. **Keep them byte-identical.** Its ids are numbered fixture UUIDs
  (`00000000-0000-7000-8000-000000000NNN`: vertices 001+, elements 101+, layers 201+, groups
  301+, styles 401+), readable names in `name` and the editor's `sampleIds.ts`.
- `app:fixture:create` is a console command registered only in dev and test (`#[When]`), never in
  prod: it **drops the selected tenant's database** (`TenantProvisioner::reset`) before creating
  the sample plan under `DEV_PLAN_ID`, the id the editor loads in dev.
- `PlanVersionCopier` is used by no service before the publish action exists, so the container
  drops it; tests build it by hand.

The `json_document` type
------------------------

`src/Core/Doctrine/JsonDocumentType` stores any object as JSON with its class name under
`"#type"` (a Doctrine type does not know the property it converts). It is unused for now, kept
for values better stored as one document. **Moving or renaming a class stored this way needs a
data migration of `"#type"`.** It needs the app's serializer, so `JsonDocumentTypeRegistrar`
registers an instance from `Kernel::boot()`. Element display values were stored this way until
`migrations/Tenant/Version20261029231058.php` moved them to columns.

Planned and open
----------------

Planned: `User`, `ProjectMember`, REST API under `/api/projects` and
`/api/plans/{id}/document|versions` with revision/ETag-based conflict detection. Real-time
collaboration is out of scope for V1. To be decided before complex editing tools: coordinate
units and precision, when a snap becomes a real shared-vertex connection, how transforms and
groups are stored, and document schema versioning/migrations.
