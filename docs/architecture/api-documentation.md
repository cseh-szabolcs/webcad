API: DTOs, documentation, editor types
======================================

The REST API is documented from the code with NelmioApiDocBundle
(`config/packages/nelmio_api_doc.yaml`): the DTOs and the controller attributes are the only
source; the OpenAPI document (http://localhost:8080/_doc.json, UI at `/_doc`, dev and test only)
and from it the editor's TypeScript types are generated. How to run it is in `README.md`.

DTOs
----

`src/Plan/Dto/`: `final readonly` classes describing exactly the JSON the editor's
`CadSerializer.parseDocument` reads, the element union being `ElementDtoInterface` (a serializer
`#[DiscriminatorMap]` on `type`, shared properties in `AbstractElementDto`).

- Suffix **`Dto`**, so a DTO is never named like an entity. `SchemaNameProcessor` drops it, so
  the OpenAPI schema names and `ApiSchema['…']` in the editor stay `PlanDocument`,
  `CircleElement` …. PHP class names are case-insensitive, so the suffix in capitals and as `Dto`
  would clash: always write `Dto`.
- DTOs hold only DTOs and scalar values, never entities.
- `EllipseElementDto.rotation` is always sent (0 = axis-aligned).
- `PlanDocumentDtoTest` round-trips the sample plan through them.

Documentation rules
-------------------

- **Actions:** a documented action carries `#[Areas(['default'])]`, `#[OA\Tag]` (described under
  `documentation.tags`) and `#[OA\Get|Post|…]` with only `summary` and `responses`; the success
  response names its model (`new OA\JsonContent(ref: new Model(type: …))`), as nothing else tells
  Nelmio the response schema. Only paths under `path_patterns` (`^/api/`) are documented. One
  controller per endpoint with `__invoke`, which carries these attributes (see "Backend layout"
  in `CLAUDE.md`).
- **Models:** `final readonly`, constructor promotion, required parameters before optional ones.
  A parameter without default is required, **except a nullable one**: Nelmio leaves those out of
  `required`, so a nullable property the API always sends is named in the class's
  `#[OA\Schema(required: …)]` (`AbstractElementDto::ALWAYS_SENT`, `ElementStyleDto.fillColor`).
  Limits as `#[Assert\…]`, prose in `#[OA\Schema]`/`#[OA\Property]`, no prose on a property whose
  type is another model (a `$ref`), `@param list<…>` for lists, `#[Assert\Valid]` on lists of
  models.
- **Unions:** an interface with the serializer's `#[DiscriminatorMap]`, declaring the shared
  properties (`public ?string $layerId { get; }`, so code holding the interface can read them),
  implemented in an abstract base class.
- **Processors** in `src/Core/OpenApi/` (tagged in `config/services.yaml`):
  `SchemaNameProcessor` drops the `Dto` and `Interface` suffixes (`CircleElementDto` →
  `CircleElement`, `ElementDtoInterface` → `Element`), `DiscriminatorBranchProcessor` gives each
  branch a title and its `type` as a required one-value enum, `RefSiblingProcessor` keeps prose
  next to a `$ref` via `allOf`, `GeneratedDefaultProcessor` drops object defaults,
  `UnionPropertiesProcessor` drops the interface's properties from the union (each branch
  documents them).
- `ApiDocumentationTest` checks the endpoint, the names, every union branch and the always-sent
  properties.

Editor types
------------

`npm run generate:api` (how to run it: `README.md`) writes `depts/editor/src/api/schema.d.ts`:
checked in, never edited by hand, ignored by oxlint. **A DTO change is done only once it ran and the diff of
`schema.d.ts` is committed with it.** Code uses `ApiSchema['…']` from `src/api/types.ts`, no alias
per model. openapi-typescript 7.13 declares a TypeScript 5 peer; `overrides` in `package.json`
lets it use the editor's TypeScript 6 (drop it once a release supports 6).

The editor keeps its own document model (`cad/model`); the API types meet it at `CadApiClient`,
which types the response as `ApiSchema['PlanDocument']` and still validates it with
`parseDocument`. `ApiDocumentFitsModel` there fails `tsc` when the generated types no longer fit
`CadDocument` (renamed, retyped or removed property, new enum value, changed `type`); the API's
`name: null` counts as a missing name.
