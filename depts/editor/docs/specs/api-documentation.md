# API-Dokumentation und TypeScript-Typen aus Symfony

Wie das Backend des Email-Editors seine OpenAPI-Dokumentation erzeugt und wie das Frontend daraus
seine TypeScript-Typen generiert — als Rezept, das sich in andere Symfony-/TypeScript-Projekte
übernehmen lässt.

Stand: Symfony 8.1, PHP 8.5, `nelmio/api-doc-bundle` 5.12, `zircote/swagger-php` 6.9,
`openapi-typescript` 7.13.

---

## 1. Das Prinzip

**Die PHP-Model-Klassen sind die einzige Quelle der Wahrheit.** Niemand schreibt ein OpenAPI-Dokument
oder ein TypeScript-Interface von Hand. Die Kette:

```
 PHP-Models (Konstruktor, Typen, #[Assert\…], #[OA\…], #[DiscriminatorMap])
        │
 Controller (#[Route], #[MapRequestPayload], #[OA\Get(summary, responses)])
        │   NelmioApiDocBundle + swagger-php + eigene Prozessoren
        ▼
 OpenAPI-Dokument  ──►  GET /_doc.json   (+ Stoplight-UI unter /_doc)
        │
        │   openapi-typescript (scripts/generate-api-types.mjs)
        ▼
 frontend/src/api/schema.d.ts   ──►   ApiSchema['EmailTemplate'] im Code
```

Konsequenzen:

- Ändert sich ein Model, ändert sich die Doku automatisch — und nach `npm run generate:api` auch der
  Typ im Frontend. Ein Feld, das im Backend umbenannt wird, ist im Frontend ein Compile-Fehler.
- Validierung (`symfony/validator`) und Doku sind **dieselben Attribute**: `#[Assert\Length(max: 50)]`
  wird zu `maxLength: 50` im Schema.
- Es gibt keine zweite Vokabel: Im Frontend heisst ein Model so wie im Schema (`ApiSchema['Body']`),
  ohne Alias pro Model.

---

## 2. Backend

### 2.1 Pakete

```bash
composer require nelmio/api-doc-bundle symfony/validator symfony/serializer symfony/property-info phpdocumentor/reflection-docblock symfony/twig-bundle symfony/asset
```

Twig und Asset werden nur für die Doku-UI gebraucht, nicht für Applikationsseiten.

### 2.2 Bundle-Konfiguration

`config/packages/nelmio_api_doc.yaml`:

```yaml
nelmio_api_doc:
    documentation:
        info:
            title: 'API Documentation'
            version: ''
        # Reihenfolge und ein Satz pro Gruppe in der UI. Ein Tag, den ein Controller nennt, der hier
        # fehlt, funktioniert trotzdem — er wird nur unbeschrieben hinten angehängt.
        tags:
            - name: 'Email Template'
              description: 'The published mail: its identity, its body, …'
            - name: 'Asset'
              description: 'Uploaded files. …'
    media_types:
        - json
    areas:
        default:
            # Nur Routen, deren Controller #[Areas(['default'])] trägt, werden dokumentiert.
            with_attribute: true
            # Der Pfad wird VOR dem Attribut geprüft. Jedes Top-Level-Präfix der API gehört hierher —
            # ein neuer Endpoint unter einem fehlenden Präfix fehlt in der Doku, egal welche Attribute
            # er trägt.
            path_patterns:
                - '^/assets'
                - '^/email-templates'
                - '^/fonts'
    html_config:
        stoplight_config:
            basePath: '_doc'
    # Models, die auch ohne Endpoint im Dokument stehen sollen (z.B. für /_schema/{name} oder einen
    # JSON-Schema-Validator). Der restliche Graph wird über die Referenzen mitgezogen.
    models:
        names:
            - { alias: EmailTemplate, type: App\EmailTemplate\Model\EmailTemplate }
            - { alias: Body, type: App\ElementTree\Model\Body }

# Generierung kostet ~300 ms. In prod ist das Dokument pro Release fix → cachen.
when@prod:
    nelmio_api_doc:
        cache:
            pool: cache.app
```

Warum `path_patterns` zusätzlich zu `with_attribute`: Um das Attribut zu lesen, instanziiert Nelmio
den Controller. Liest dieser Controller selbst das OpenAPI-Dokument (bei uns der MCP-Server), entsteht
ein Zirkel. Der Pfadfilter greift vorher. Hat die API ein gemeinsames Präfix (`/api`), reicht ein
einziges Pattern.

### 2.3 Routen — nur in `dev` und `test`

`config/routes/nelmio_api_doc.yaml`:

```yaml
when@dev: &doc_routes
    app.swagger:
        path: /_doc.json
        methods: GET
        defaults: { _controller: nelmio_api_doc.controller.swagger }

    app_swagger_ui:
        path: /_doc{path}
        methods: GET
        controller: nelmio_api_doc.controller.stoplight
        requirements:
            path: '(/.*)?'

when@test: *doc_routes
```

Die Routen sind öffentlich (die UI schickt keinen Bearer-Token), deshalb nie in Produktion. Das Bundle
selbst bleibt überall konfiguriert, falls Code das Dokument in-process liest
(`@nelmio_api_doc.generator`).

Die Firewall muss `/_doc` und `/_doc.json` ohne Authentifizierung durchlassen, sonst kann der
TypeScript-Generator das Dokument nicht holen. In `security.yaml` reicht eine Zeile — in Produktion
gibt es die Routen ohnehin nicht:

```yaml
access_control:
    - { path: '^/_(doc|schema/)', roles: PUBLIC_ACCESS }
```

### 2.4 Ein Controller

Regel: **Das `#[OA\…]`-Attribut enthält nur `summary` und `responses`.** Alles andere leitet Nelmio
aus der Signatur ab:

| Quelle in der Signatur                       | wird im Dokument zu                        |
| -------------------------------------------- | ------------------------------------------ |
| `#[MapRequestPayload] Foo $foo`              | `requestBody` mit `$ref` auf `Foo`         |
| `#[MapQueryParameter]` / `#[MapQueryString]` | Query-Parameter (inkl. `required`)         |
| `{id}` im `#[Route]`-Pfad                    | Path-Parameter                             |
| `#[MapUploadedFile]`                         | `multipart/form-data`-Body                 |

Ein handgeschriebener `requestBody` **gewinnt** gegen den abgeleiteten — er ist dann eine zweite Kopie,
die auseinanderläuft. Nur Uploads, die die Datei selbst vom `Request` lesen, brauchen noch einen.

Die **Response** leitet dagegen niemand ab (weder Return-Type noch `#[Serialize]` werden gelesen). Das
`content` der Erfolgsantwort ist die einzige Stelle, die das Antwort-Schema nennt — und genau daraus
entsteht später der TypeScript-Typ. Ohne `content` gibt es im Frontend keinen Typ für die Antwort.

```php
#[AsController]
final readonly class ShowEmailTemplateController
{
    #[Route(
        path: '/email-templates/{id}',
        name: 'api_email_template_show',
        requirements: ['id' => Requirement::UUID],
        methods: ['GET'],
    )]
    #[Areas(['default'])]                      // sonst nicht dokumentiert
    #[Tag(name: 'Email Template')]             // Gruppe in der UI
    #[OA\Get(
        summary: 'Returns one email template.',
        responses: [
            new OA\Response(
                response: 200,
                description: 'The email template.',
                content: new OA\JsonContent(ref: new Model(type: EmailTemplate::class)),
            ),
            new OA\Response(response: 404, description: 'Unknown template.'),
        ],
    )]
    #[Serialize]
    public function __invoke(#[MapEntity] EmailTemplateEntity $entity): EmailTemplate
    {
        // …
    }
}
```

Mit Request-Body:

```php
#[Route(path: '/email-templates/{id}/name', methods: ['PUT'])]
#[Areas(['default'])]
#[Tag(name: 'Email Template')]
#[OA\Put(
    summary: 'Replaces the internal name of a stored email template.',
    responses: [
        new OA\Response(response: 204, description: 'The template carries that name now.'),
        new OA\Response(response: 422, description: 'Invalid name.'),
    ],
)]
public function __invoke(
    #[MapEntity] EmailTemplateEntity $template,
    #[MapRequestPayload] EmailTemplateName $name,   // → requestBody, automatisch
): Response
```

Prosa zum _Warum_ gehört in den Docblock der Klasse, nicht in `description:` der Operation.

### 2.5 Models schreiben

Ein Model ist eine `final readonly` Klasse mit Constructor Property Promotion. Daraus liest Nelmio:

- **Typ** — aus dem PHP-Typ bzw. `@var`/`@param` für Listen (`list<Container>`).
- **`required`** — jeder Konstruktor-Parameter **ohne Default**. Ein Parameter mit Default wird im
  TypeScript-Typ optional (`id?: string`).
- **Constraints** — aus `#[Assert\…]`: `minimum`/`maximum`/`minItems`/`minLength`/`maxLength`/`pattern`.
- **Prosa** — `#[OA\Schema(description:)]` auf der Klasse, `#[OA\Property(description:, example:)]`
  auf dem Parameter. (Ein Docblock auf einer promoteten Property landet in `title`, nicht in
  `description`.)

```php
#[OA\Schema(description: 'The internal name of an email template — what every list shows.')]
final readonly class EmailTemplateName
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Length(max: EmailTemplate::NAME_MAX_LENGTH)]
        #[OA\Property(description: 'Internal name of the email.', example: 'Newsletter September')]
        public string $name,
    ) {}
}
```

Ergibt im Frontend:

```ts
EmailTemplateName: {
  /** @description Internal name of the email. … @example Newsletter September */
  name: string
}
```

**Regeln, die man sonst teuer lernt:**

- **Pflichtfeld machen = Default entfernen _und_ den Parameter vor alle optionalen schieben.** Sonst
  behandelt PHP jeden optionalen Parameter davor implizit als Pflicht.
- **Verschachtelte Models validieren:** `#[Assert\Cascade]` auf die Klasse, sonst prüft
  `validate($body)` nur die oberste Ebene. **`Cascade` überspringt interface-typisierte Properties
  stillschweigend** — dort explizit `#[Assert\Valid]` daneben.
- **`#[Assert\Regex]` immer mit `htmlPattern`:** Nelmio liest `getHtmlPattern()`, das die Anker
  entfernt, und ein ungeankertes JSON-Schema-`pattern` matcht Teilstrings.
- **Kein `description` neben einem `$ref`** (also auf einer Property, deren Typ ein anderes Model ist).
  Das wird zu einem `allOf`, und ein Generator, der das liest, verliert bei Unions das
  diskriminierende `type`. Prosa auf die Klasse des referenzierten Models.
- `#[Assert\Unique]` und `#[Assert\All]` liest Nelmio nicht — `uniqueItems` bzw. ein Item-`pattern`
  muss in `#[OA\Property]` von Hand stehen.
- Methoden, die keine Properties sein sollen (Getter wie `forLocale()`), mit `#[Ignore]` markieren.

### 2.6 Unions (polymorphe Typen)

Eine Union ist ein **Interface mit `#[DiscriminatorMap]`**. Der Serializer liest damit das
`type`-Feld, Nelmio erzeugt daraus ein `oneOf` mit `discriminator`, und `openapi-typescript` macht
daraus eine echte TypeScript-Union mit Literal-Typen.

```php
#[DiscriminatorMap('type', [
    SystemFont::TYPE => SystemFont::class,
    GoogleFont::TYPE => GoogleFont::class,
    CustomFont::TYPE => CustomFont::class,
])]
#[OA\Schema(description: 'A font a text style may name.')]
interface FontInterface {}
```

```ts
// generiert:
Font: SystemFont | GoogleFont | CustomFont
SystemFont: { type: 'system'; family: SystemFontFamily }
```

- Das Schema heisst `Font`, nicht `FontInterface` — das erledigt der `SchemaNameProcessor` (2.8).
  Deshalb darf kein Interface mit `Interface`-Suffix so heissen wie eine existierende Klasse.
- Die Union ist ein **Interface, keine abstrakte Klasse**: ein Discriminator auf einer Klasse
  publiziert deren Properties neben dem `oneOf`. Gemeinsame Properties gehören in eine abstrakte
  Basisklasse, die die Branches erweitern.
- **Auch eine Liste mit nur einem möglichen Typ als Union „von eins“ modellieren**, wenn das `type`
  im Payload Pflicht sein soll. Als einfache Klasse typisiert würde ein Knoten ohne `type` gelesen.
- Einen Branch aus einer Union zu entfernen braucht eine **Datenmigration**: gespeicherte Daten mit dem
  alten `type` sind sonst nicht mehr deserialisierbar.

### 2.7 Eigene Schema-Typen für Skalare

Für einen Skalar, der einen eigenen, benannten Schema-Eintrag verdient (Farbe, Locale, …), ein
Value-Object mit `SelfDescribingModelInterface`. Elf Farb-Properties werden so zu elf `$ref`s auf ein
einziges `HexColor`-Schema statt elf Kopien desselben Patterns.

```php
final readonly class HexColor implements SelfDescribingModelInterface, Stringable
{
    public const string PATTERN = '^#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$';

    public function __construct(public string $value = '#000000') {}

    // Klassen-Callback statt #[Assert\Regex] auf $value: sonst lautet der Fehlerpfad
    // "…backgroundColor.value", den es im JSON nicht gibt.
    #[Assert\Callback]
    public function validate(ExecutionContextInterface $context): void { /* preg_match … */ }

    public static function describe(Schema $schema, Model $model): void
    {
        $schema->type = 'string';
        $schema->pattern = self::PATTERN;
        $schema->description = 'A hexadecimal RGB or RGBA colour.';
        $schema->example = '#2563EB';
    }
}
```

Dazu gehört ein **Normalizer**, der das Objekt auf dem Draht als nackten String schreibt und liest
(`HexColorNormalizer`). Wichtig: Gibt es einen benannten Serializer für `#[MapRequestPayload]`, muss
der Normalizer **für beide** getaggt werden, sonst wird der Wert im Request als Objekt erwartet:

```yaml
App\Serializer\HexColorNormalizer:
    tags:
        - { name: serializer.normalizer, serializer: default }
        - { name: serializer.normalizer, serializer: request_payload }
```

Im TypeScript wird daraus `HexColor: string`.

### 2.8 Eigene swagger-php-Prozessoren

Vier Prozessoren korrigieren, was Nelmio/swagger-php von sich aus falsch oder unschön erzeugen. Sie
sind generisch und lassen sich unverändert übernehmen (Code im Anhang).

| Prozessor                      | Problem                                                                                                                                         | Lösung                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `SchemaNameProcessor`          | Ein Interface heisst im Schema `ImageSrcInterface`.                                                                                             | Entfernt das Suffix `Interface` bei echten Interfaces und schreibt alle `$ref`s und Discriminator-Mappings um. Nie bei Namenskonflikt. |
| `RefSiblingProcessor`          | OpenAPI 3.0 verbietet Geschwister neben `$ref`; swagger-php verwirft die `description` still.                                                   | Packt den `$ref` in ein `allOf`, damit `title`/`description`/`x-*` erhalten bleiben.                                                 |
| `GeneratedDefaultProcessor`    | `public Uuid $id = new UuidV7()` wird zum `default` — das Dokument ist bei jedem Request anders.                                                 | Entfernt Objekt-Defaults (Backed Enums bleiben, sie sind stabil).                                                                     |
| `DiscriminatorBranchProcessor` | Ein `oneOf` aus nackten `$ref`s: die Branches tragen weder Namen noch das `type`-Feld, die UI zeigt namenlose Varianten, TS bekommt kein Literal. | Gibt jedem Branch einen `title` und setzt die Discriminator-Property als einwertiges `enum` an erste Stelle und in `required`.        |

Alle vier nutzen einen `AnnotationTraverser`, weil swagger-php nur die Annotationen kennt, die beim
Aufbau der Analyse existierten — Nelmio fügt danach weitere Schemas hinzu, der Prozessor muss also den
ganzen Baum selbst ablaufen.

Registrierung in `config/services.yaml`:

```yaml
App\OpenApi\SchemaNameProcessor:
    tags: [{ name: nelmio_api_doc.swagger.processor }]

App\OpenApi\RefSiblingProcessor:
    tags: [{ name: nelmio_api_doc.swagger.processor }]

App\OpenApi\GeneratedDefaultProcessor:
    tags: [{ name: nelmio_api_doc.swagger.processor }]

# Läuft zuletzt, damit es mit den Namen arbeitet, die SchemaNameProcessor festgelegt hat.
App\OpenApi\DiscriminatorBranchProcessor:
    tags: [{ name: nelmio_api_doc.swagger.processor, priority: -10 }]
```

Ein Test, der jeden Branch jeder Union auf `title` und gepinntes `type` prüft
(`DiscriminatorBranchTest`), lohnt sich: er fällt sofort auf, wenn jemand eine Union falsch baut.

### 2.9 Serializer-Einstellungen, die das Schema ehrlich halten

```yaml
# config/packages/framework.yaml
framework:
    serializer:
        default_context:
            # ERSETZT den Default statt ihn zu ergänzen. Ohne PRESERVE_ZERO_FRACTION wird 0.0 zu 0.
            json_encode_options: !php/const App\Serializer\JsonEncoding::OPTIONS
        named_serializers:
            request_payload:
                default_context:
                    # Unbekannte Felder → 422 statt stillschweigend ignoriert.
                    allow_extra_attributes: false
                    collect_extra_attributes_errors: true
```

Damit `#[MapRequestPayload]` den benannten Serializer benutzt, braucht es einen **Compiler-Pass**
(registriert in `Kernel::build()`). Nicht über `services.yaml`: `argument_resolver.request_payload`
dort neu zu deklarieren ersetzt die ganze Definition des FrameworkBundle, Autoconfigure taggt sie um,
und danach antwortet jeder `#[MapRequestPayload]`-Controller mit 500.

```php
final class RequestPayloadSerializerPass implements CompilerPassInterface
{
    public function process(ContainerBuilder $container): void
    {
        if (!$container->hasDefinition('argument_resolver.request_payload')) {
            return;
        }

        $container->getDefinition('argument_resolver.request_payload')
            ->setArgument('$serializer', new Reference('serializer.request_payload'));
    }
}

// src/Kernel.php
protected function build(ContainerBuilder $container): void
{
    $container->addCompilerPass(new RequestPayloadSerializerPass());
}
```

Den Kontext **nicht** auf das `#[MapRequestPayload]`-Attribut setzen: Nelmio schlüsselt ein Model nach
Klasse _und_ Serialisierungskontext und würde das Payload-Model ein zweites Mal unter anderem Namen
registrieren.

**Leere Maps:** PHP kann `{}` nicht von `[]` unterscheiden. Jede Property, die im Schema ein Objekt
mit freien Keys ist (z.B. `translations: array<string, …>`), bekommt
`#[Context([Serializer::EMPTY_ARRAY_AS_OBJECT => true])]`, sonst geht eine leere Map als `[]` raus und
verletzt das eigene Schema.

### 2.10 Nebenprodukt: JSON Schema und Validierung

Weil das OpenAPI-Dokument vollständig ist, lässt es sich weiterverwenden. Im Editor leitet ein
`JsonSchemaProvider` (Argument `@nelmio_api_doc.generator`) daraus pro Model ein JSON Schema (Draft
2020-12) ab — `GET /_schema/{name}` in `dev`, und in-process für Payload-Validierung und die
MCP-Tool-Schemas. Er inlined alle referenzierten Schemas nach `$defs`, übersetzt `nullable` in einen
`"null"`-Typ, `example` in `examples`, ersetzt den `discriminator` durch `const` auf jedem Branch und
schliesst Objekte mit `additionalProperties: false`. Optional, aber nützlich, sobald externe Clients
(oder ein LLM) Payloads gegen dieselbe Wahrheit prüfen sollen.

---

## 3. Frontend: TypeScript-Typen generieren

### 3.1 Paket und Skript

```bash
npm install --save-dev openapi-typescript
```

`package.json`:

```json
{
  "scripts": {
    "generate:api": "node --use-system-ca --env-file-if-exists=.env.local scripts/generate-api-types.mjs api"
  }
}
```

`scripts/generate-api-types.mjs` (gekürzt auf ein Ziel; im Editor gibt es ein zweites für die
mailxpert-API):

```js
#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import openapiTS, { astToString } from 'openapi-typescript'

const url = process.env.API_DOC_URL?.trim()

if (!url) {
  console.error('Missing API_DOC_URL. Add it to .env.local, e.g.:\n\n  API_DOC_URL=http://127.0.0.1:8000/_doc.json\n')
  process.exit(1)
}

const outFile = resolve(import.meta.dirname, '../src/api/schema.d.ts')

const ast = await openapiTS(new URL(url), {
  // Schemas ohne `required`-Liste kommen sonst komplett optional an.
  propertiesRequiredByDefault: true,
})

await mkdir(dirname(outFile), { recursive: true })
await writeFile(
  outFile,
  `/* Generated by \`npm run generate:api\` from ${url}. Do not edit by hand. */\n\n${astToString(ast)}`,
)

console.log(`Wrote ${relative(process.cwd(), outFile)}`)
```

`.env.local` (nicht eingecheckt, eine `.env.local.example` schon):

```dotenv
API_DOC_URL=https://api.example.test/_doc.json
```

- Im Docker-Container ist `API_DOC_URL` ein Plain-HTTP-Alias im Projektnetz
  (`http://api.email-editor.test/_doc.json` in `compose.yaml`), da braucht es nichts weiter.
- Auf dem Host mit lokalem HTTPS (mkcert) vertraut Node dem Zertifikat nicht — dafür
  `--use-system-ca` (Node ≥ 22.15). Auf älterem Node:
  `NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"`. **Nicht** `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Das Backend muss beim Generieren laufen.

**Zur Option `propertiesRequiredByDefault`:** Nelmio schreibt eine `required`-Liste, wo Konstruktor-
Parameter ohne Default existieren. Für Schemas ganz ohne `required`-Liste würde `openapi-typescript`
sonst alles optional machen; die Option macht dort alles verpflichtend. Liest man ein fremdes
Dokument, das seine `required`-Listen ernst meint, lässt man sie weg (und setzt ggf.
`defaultNonNullable: false`, damit ein Feld mit `default` nicht wieder Pflicht wird).

### 3.2 Die generierte Datei

- `src/api/schema.d.ts` wird **eingecheckt** und **nie von Hand editiert**.
- Vom Linter ausnehmen (`ignorePatterns` in `.oxlintrc.json` bzw. `.eslintignore`) und von Prettier
  (`.prettierignore`).
- Ein Model-Change im Backend ist erst fertig, wenn `npm run generate:api` gelaufen ist und der Diff
  der `schema.d.ts` mit committed wird. Danach `npm run typecheck` — er zeigt jede Stelle, die
  angepasst werden muss.

### 3.3 Verwendung

Ein einziger exportierter Name, `src/api/types.ts`:

```ts
import type { components } from './schema'

/**
 * Every model of the generated API schema, named by its schema name — `ApiSchema['Asset']`
 * rather than an alias per model, so the name in the code is the name in the published schema.
 */
export type ApiSchema = components['schemas']
```

Im Client:

```ts
load: async (templateId: string): Promise<ApiSchema['EmailTemplate']> => {
  const response = await request(`/email-templates/${templateId}`)
  return (await response.json()) as ApiSchema['EmailTemplate']
},
```

- **Kein Alias pro Model** (`type Template = ApiSchema['EmailTemplate']` ist verboten) — sonst gibt
  es zwei Vokabulare. Abgeleitete Typen (`Partial<…>`, `Stored<…>`, eine Union, die das Schema nicht
  benennt) sind in Ordnung.
- Eine Union wird über ihr `type` genarrowt — dank `DiscriminatorBranchProcessor` ist das ein
  Literal-Typ:

  ```ts
  function fontLabel(font: ApiSchema['Font']): string {
    switch (font.type) {
      case 'system': return font.family
      case 'google': return font.family
      case 'custom': return font.name
    }
  }
  ```

- Der Editor nutzt einen eigenen dünnen `fetch`-Client mit `as`-Cast. Wer auch Pfade und
  Statuscodes typisiert haben will, kann auf derselben `schema.d.ts` `openapi-fetch` einsetzen
  (`createClient<paths>()`); das Rezept bleibt dasselbe.

**Stolperstein `Omit` über Unions:** Erzeugt das Schema `Omit<Union, 'type'>` (z.B. für einen
Payload, der ein Element ohne `type` beschreibt), verteilt TypeScript das `Omit` **nicht** über die
Union-Glieder — übrig bleiben nur die gemeinsamen Properties. Abhilfe: an einer Stelle mit der
präzisen Union und einem distributiven Helfer arbeiten und Payloads über Builder-Funktionen bauen
statt von Hand.

**Werte stehen nicht im Typ:** Ein `maxLength: 50` landet nur als Kommentar in `schema.d.ts`. Braucht
das Frontend die Zahl (z.B. für ein Eingabefeld), wird sie dort als Konstante wiederholt
(`TEMPLATE_NAME_MAX_LENGTH`) — mit Verweis auf die Backend-Konstante.

---

## 4. Checklisten

### Neuer Endpoint

1. Invokable Controller mit `#[Route]`, `#[Areas(['default'])]`, `#[Tag(name: …)]`.
2. `#[OA\Get/Post/…]` mit **nur** `summary` und `responses`; die Erfolgsantwort mit
   `content: new OA\JsonContent(ref: new Model(type: Foo::class))` (für Listen
   `new OA\JsonContent(type: 'array', items: new OA\Items(ref: new Model(type: Foo::class)))`).
3. Request-Body über `#[MapRequestPayload]`, Query über `#[MapQueryParameter]`/`#[MapQueryString]`.
4. Liegt der Pfad unter einem neuen Top-Level-Präfix → in `path_patterns` eintragen.
5. Neuer Tag → unter `documentation.tags` mit einem Satz ergänzen.
6. `/_doc` öffnen und prüfen, dann `npm run generate:api`, `npm run typecheck`.

### Neues Model / geändertes Model

1. Konstruktor: Pflichtfelder ohne Default **vor** den optionalen.
2. Constraints als `#[Assert\…]`, Prosa als `#[OA\Schema]`/`#[OA\Property]`, keine Prosa neben `$ref`.
3. Hält es andere Models: `#[Assert\Cascade]` auf die Klasse, `#[Assert\Valid]` an Interface-Properties.
4. Union: Interface mit `#[DiscriminatorMap]`, Name ohne Konflikt nach Abschneiden von `Interface`.
5. Map-Property: `EMPTY_ARRAY_AS_OBJECT`.
6. `npm run generate:api`, Diff von `schema.d.ts` anschauen, committen.

### In ein neues Projekt übernehmen

1. Pakete aus 2.1 installieren, `nelmio_api_doc.yaml` und Routen aus 2.2/2.3 anlegen.
2. Firewall: `/_doc`, `/_doc.json` in `dev` ohne Auth.
3. `src/OpenApi/` aus dem Anhang kopieren, Namespace anpassen, in `services.yaml` taggen.
4. Serializer-Kontext und Compiler-Pass aus 2.9 (`allow_extra_attributes: false`,
   Encoding-Optionen).
5. Frontend: `openapi-typescript`, Skript aus 3.1, `.env.local.example`, Ignore-Einträge für Linter
   und Prettier, `ApiSchema` aus 3.3.
6. Ersten Endpoint nach Checkliste bauen, `npm run generate:api`, Typ im Code verwenden.

---

## Anhang: Prozessor-Code

Alle Dateien unter `src/OpenApi/`, Namespace `App\OpenApi`.

### AnnotationTraverser.php

```php
<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Annotations as OA;
use SplObjectStorage;

use function is_array;

/**
 * swagger-php only exposes the annotations that existed when the Analysis was built, while
 * NelmioApiDoc keeps adding schemas afterwards — so a processor has to walk the document itself.
 */
final class AnnotationTraverser
{
    /**
     * @param callable(OA\AbstractAnnotation): void $visitor
     */
    public function walk(OA\AbstractAnnotation $root, callable $visitor): void
    {
        /** @var SplObjectStorage<OA\AbstractAnnotation, null> $visited */
        $visited = new SplObjectStorage();

        $this->visit($root, $visitor, $visited);
    }

    /**
     * @param callable(OA\AbstractAnnotation): void         $visitor
     * @param SplObjectStorage<OA\AbstractAnnotation, null> $visited
     */
    private function visit(OA\AbstractAnnotation $annotation, callable $visitor, SplObjectStorage $visited): void
    {
        if ($visited->offsetExists($annotation)) {
            return;
        }
        $visited->offsetSet($annotation);

        $visitor($annotation);

        foreach (get_object_vars($annotation) as $property => $value) {
            if ('_context' === $property) {
                continue;
            }

            $this->visitValue($value, $visitor, $visited);
        }
    }

    /**
     * @param callable(OA\AbstractAnnotation): void         $visitor
     * @param SplObjectStorage<OA\AbstractAnnotation, null> $visited
     */
    private function visitValue(mixed $value, callable $visitor, SplObjectStorage $visited): void
    {
        if ($value instanceof OA\AbstractAnnotation) {
            $this->visit($value, $visitor, $visited);

            return;
        }

        if (is_array($value)) {
            foreach ($value as $item) {
                $this->visitValue($item, $visitor, $visited);
            }
        }
    }
}
```

### SchemaNameProcessor.php

```php
<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Analysis;
use OpenApi\Annotations as OA;
use OpenApi\Undefined;

use function is_array;
use function is_string;
use function mb_strlen;

/**
 * Runs as a swagger-php processor, i.e. after the whole model graph has been registered — so
 * `ImageSrcInterface` is documented as "ImageSrc" and every `$ref` at it is rewritten.
 */
final readonly class SchemaNameProcessor
{
    private const string INTERFACE_SUFFIX = 'Interface';

    public function __construct(
        private AnnotationTraverser $traverser,
    ) {}

    public function __invoke(Analysis $analysis): void
    {
        $openApi = $analysis->openapi;

        if (!$openApi instanceof OA\OpenApi
            || !$openApi->components instanceof OA\Components
            || !is_array($openApi->components->schemas)
        ) {
            return;
        }

        $renames = $this->collectRenames($openApi->components->schemas);

        if ([] === $renames) {
            return;
        }

        $this->traverser->walk($openApi, function (OA\AbstractAnnotation $annotation) use ($renames): void {
            $this->rewriteAnnotation($annotation, $renames);
        });
    }

    /**
     * @param array<OA\Schema> $schemas
     *
     * @return array<string, string> old schema name => new schema name
     */
    private function collectRenames(array $schemas): array
    {
        $taken = [];
        foreach ($schemas as $schema) {
            if (null !== $name = $this->schemaName($schema)) {
                $taken[$name] = true;
            }
        }

        $renames = [];
        foreach ($schemas as $schema) {
            if (null === $current = $this->schemaName($schema)) {
                continue;
            }

            $new = $this->resolveName($schema, $current);

            // Never silently merge two schemas into one name.
            if (null === $new || isset($taken[$new])) {
                continue;
            }

            $renames[$current] = $new;
            unset($taken[$current]);
            $taken[$new] = true;
        }

        return $renames;
    }

    private function schemaName(OA\Schema $schema): ?string
    {
        return is_string($schema->schema) && Undefined::UNDEFINED !== $schema->schema
            ? $schema->schema
            : null;
    }

    private function resolveName(OA\Schema $schema, string $current): ?string
    {
        $name = $this->withoutInterfaceSuffix($schema, $current);

        return '' !== $name && $name !== $current ? $name : null;
    }

    /**
     * Only an interface loses the suffix: a class that happens to end in "Interface" is named
     * what it is called.
     */
    private function withoutInterfaceSuffix(OA\Schema $schema, string $current): string
    {
        $class = get_object_vars($schema->_context)['class'] ?? null;

        if (!is_string($class) || !interface_exists($class) || !str_ends_with($current, self::INTERFACE_SUFFIX)) {
            return $current;
        }

        return mb_substr($current, 0, -mb_strlen(self::INTERFACE_SUFFIX));
    }

    /**
     * @param array<string, string> $renames
     */
    private function rewriteAnnotation(OA\AbstractAnnotation $annotation, array $renames): void
    {
        if ($annotation instanceof OA\Schema
            && null !== $name = $this->schemaName($annotation)
        ) {
            $annotation->schema = $renames[$name] ?? $name;
        }

        if (property_exists($annotation, 'ref') && is_string($annotation->ref)) {
            $annotation->ref = $this->rewriteRef($annotation->ref, $renames);
        }

        if ($annotation instanceof OA\Discriminator && is_array($annotation->mapping)) {
            foreach ($annotation->mapping as $value => $ref) {
                if (is_string($ref)) {
                    $annotation->mapping[$value] = $this->rewriteRef($ref, $renames);
                }
            }
        }
    }

    /**
     * @param array<string, string> $renames
     */
    private function rewriteRef(string $ref, array $renames): string
    {
        if (!str_starts_with($ref, OA\Components::SCHEMA_REF)) {
            return $ref;
        }

        $name = mb_substr($ref, mb_strlen(OA\Components::SCHEMA_REF));

        return isset($renames[$name]) ? OA\Components::SCHEMA_REF.$renames[$name] : $ref;
    }
}
```

### RefSiblingProcessor.php

```php
<?php

declare(strict_types=1);

namespace App\OpenApi;

use Nelmio\ApiDocBundle\OpenApiPhp\Util;
use OpenApi\Analysis;
use OpenApi\Annotations as OA;
use OpenApi\Undefined;

use function is_string;

/**
 * OpenAPI 3.0 forbids anything next to a `$ref`, so swagger-php drops the description an
 * `#[OA\Property]` put there. Wrapping the ref in an allOf is the documented way around it.
 */
final readonly class RefSiblingProcessor
{
    private const array SIBLINGS = ['title', 'description', 'x'];

    public function __construct(
        private AnnotationTraverser $traverser,
    ) {}

    public function __invoke(Analysis $analysis): void
    {
        if (!$analysis->openapi instanceof OA\OpenApi) {
            return;
        }

        $this->traverser->walk($analysis->openapi, static function (OA\AbstractAnnotation $annotation): void {
            if (!$annotation instanceof OA\Schema
                || Undefined::UNDEFINED === $annotation->ref
                || !is_string($annotation->ref)
                || Undefined::UNDEFINED !== $annotation->allOf
            ) {
                return;
            }

            foreach (self::SIBLINGS as $sibling) {
                if (Undefined::UNDEFINED === $annotation->{$sibling}) {
                    continue;
                }

                $annotation->allOf = [new OA\Schema([
                    'ref' => $annotation->ref,
                    '_context' => Util::createWeakContext($annotation->_context),
                ])];
                $annotation->ref = Undefined::UNDEFINED;

                return;
            }
        });
    }
}
```

### GeneratedDefaultProcessor.php

```php
<?php

declare(strict_types=1);

namespace App\OpenApi;

use BackedEnum;
use OpenApi\Analysis;
use OpenApi\Annotations as OA;
use OpenApi\Undefined;

use function is_object;

/**
 * NelmioApiDoc reads defaults off the constructor, so `public Uuid $id = new UuidV7()` makes the
 * spec differ on every request. Backed enums are kept: they serialise to a stable value.
 */
final readonly class GeneratedDefaultProcessor
{
    public function __construct(
        private AnnotationTraverser $traverser,
    ) {}

    public function __invoke(Analysis $analysis): void
    {
        if (!$analysis->openapi instanceof OA\OpenApi) {
            return;
        }

        $this->traverser->walk($analysis->openapi, static function (OA\AbstractAnnotation $annotation): void {
            if (!$annotation instanceof OA\Schema) {
                return;
            }

            if (is_object($annotation->default) && !$annotation->default instanceof BackedEnum) {
                $annotation->default = Undefined::UNDEFINED;
            }
        });
    }
}
```

### DiscriminatorBranchProcessor.php

```php
<?php

declare(strict_types=1);

namespace App\OpenApi;

use Nelmio\ApiDocBundle\OpenApiPhp\Util;
use OpenApi\Analysis;
use OpenApi\Annotations as OA;
use OpenApi\Undefined;

use function is_array;
use function is_string;
use function mb_strlen;

/**
 * The doc UI resolves a `$ref` before rendering, so a schema title is what survives to name a
 * branch. The discriminating property is no model's, so it is pinned here as a one-value enum.
 */
final readonly class DiscriminatorBranchProcessor
{
    public function __construct(
        private AnnotationTraverser $traverser,
    ) {}

    public function __invoke(Analysis $analysis): void
    {
        $openApi = $analysis->openapi;

        if (!$openApi instanceof OA\OpenApi
            || !$openApi->components instanceof OA\Components
            || !is_array($openApi->components->schemas)
        ) {
            return;
        }

        $schemas = $this->byName($openApi->components->schemas);

        foreach ($this->collectTags($openApi) as $name => $tag) {
            if (!isset($schemas[$name])) {
                continue;
            }

            $this->describe($schemas[$name], $name, $tag['property'], $tag['value']);
        }
    }

    /**
     * @param array<OA\Schema> $schemas
     *
     * @return array<string, OA\Schema>
     */
    private function byName(array $schemas): array
    {
        $byName = [];
        foreach ($schemas as $schema) {
            if (is_string($schema->schema) && Undefined::UNDEFINED !== $schema->schema) {
                $byName[$schema->schema] = $schema;
            }
        }

        return $byName;
    }

    /**
     * @return array<string, array{property: string, value: string}> schema name => its discriminator
     */
    private function collectTags(OA\OpenApi $openApi): array
    {
        $tags = [];
        $conflicting = [];

        $this->traverser->walk($openApi, static function (OA\AbstractAnnotation $annotation) use (&$tags, &$conflicting): void {
            if (!$annotation instanceof OA\Discriminator
                || !is_string($annotation->propertyName)
                || Undefined::UNDEFINED === $annotation->propertyName
                || !is_array($annotation->mapping)
            ) {
                return;
            }

            foreach ($annotation->mapping as $value => $ref) {
                if (!is_string($ref) || !str_starts_with($ref, OA\Components::SCHEMA_REF)) {
                    continue;
                }

                $name = mb_substr($ref, mb_strlen(OA\Components::SCHEMA_REF));
                $tag = ['property' => $annotation->propertyName, 'value' => (string) $value];

                if (isset($tags[$name]) && $tags[$name] !== $tag) {
                    $conflicting[$name] = true;
                }

                $tags[$name] = $tag;
            }
        });

        return array_diff_key($tags, $conflicting);
    }

    private function describe(OA\Schema $schema, string $name, string $property, string $value): void
    {
        if (Undefined::UNDEFINED === $schema->title) {
            $schema->title = $name;
        }

        $properties = is_array($schema->properties) ? $schema->properties : [];

        foreach ($properties as $existing) {
            if ($existing->property === $property) {
                return;
            }
        }

        $schema->properties = [
            new OA\Property([
                'property' => $property,
                'type' => 'string',
                'enum' => [$value],
                'description' => 'Names this variant of the union.',
                '_context' => Util::createWeakContext($schema->_context),
            ]),
            ...$properties,
        ];

        $required = is_array($schema->required) ? $schema->required : [];
        $schema->required = [$property, ...$required];
    }
}
```
