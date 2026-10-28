<?php

namespace App\Tests\OpenApi;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * The document the editor's TypeScript types are generated from.
 */
final class ApiDocumentationTest extends WebTestCase
{
    private const string SCHEMA_REF = '#/components/schemas/';

    public function testPlanDocumentEndpointIsDocumented(): void
    {
        $doc = $this->document();

        $get = $doc['paths']['/api/plans/{id}/document']['get'];
        self::assertSame(['Plan'], $get['tags']);
        self::assertSame(self::SCHEMA_REF.'PlanDocument', $get['responses']['200']['content']['application/json']['schema']['$ref']);
        self::assertSame([200, 304, 404], array_keys($get['responses']));
    }

    public function testInterfacesAreNamedWithoutSuffix(): void
    {
        $schemas = $this->document()['components']['schemas'];

        self::assertArrayHasKey('Element', $schemas);
        self::assertArrayNotHasKey('ElementInterface', $schemas);
        self::assertSame(self::SCHEMA_REF.'Element', $schemas['PlanDocument']['properties']['elements']['items']['$ref']);
    }

    /**
     * Every branch of every union carries a title and its discriminator as a required one-value
     * enum, which openapi-typescript turns into a literal type.
     */
    public function testUnionBranchesNameTheirType(): void
    {
        $schemas = $this->document()['components']['schemas'];

        $unions = array_filter($schemas, static fn (array $schema): bool => isset($schema['discriminator']));
        self::assertNotEmpty($unions);

        foreach ($unions as $union) {
            $property = $union['discriminator']['propertyName'];
            self::assertCount(\count($union['discriminator']['mapping']), $union['oneOf']);

            foreach ($union['discriminator']['mapping'] as $value => $ref) {
                $name = substr($ref, \strlen(self::SCHEMA_REF));
                $branch = $schemas[$name];

                self::assertSame($name, $branch['title'] ?? null, $name);
                self::assertSame([$value], $branch['properties'][$property]['enum'] ?? null, $name);
                self::assertSame($property, $branch['required'][0], $name);
            }
        }
    }

    public function testNullablePropertiesThatAreAlwaysSentAreRequired(): void
    {
        $schemas = $this->document()['components']['schemas'];

        foreach (['LineElement', 'PolylineElement', 'ArcElement', 'CircleElement', 'EllipseElement', 'BezierElement'] as $name) {
            foreach (['layerId', 'groupId', 'styleId'] as $property) {
                self::assertContains($property, $schemas[$name]['required'], $name);
                self::assertTrue($schemas[$name]['properties'][$property]['nullable'], $name);
            }
            self::assertNotContains('name', $schemas[$name]['required'], $name);
        }
        self::assertContains('fillColor', $schemas['ElementStyle']['required']);
    }

    public function testDocumentationUiIsServed(): void
    {
        $client = static::createClient();
        $client->request('GET', '/_doc');

        self::assertResponseIsSuccessful();
        self::assertStringContainsString('WebCAD API', $client->getResponse()->getContent());
    }

    /**
     * @return array<string, mixed>
     */
    private function document(): array
    {
        $client = static::createClient();
        $client->request('GET', '/_doc.json');
        self::assertResponseIsSuccessful();

        return json_decode($client->getResponse()->getContent(), true, flags: \JSON_THROW_ON_ERROR);
    }
}
