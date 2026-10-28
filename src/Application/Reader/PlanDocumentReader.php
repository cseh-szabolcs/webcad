<?php

namespace App\Application\Reader;

use App\Application\Model\Plan\ElementInterface;
use App\Application\Model\Plan\ElementStyle;
use App\Application\Model\Plan\Group;
use App\Application\Model\Plan\Layer;
use App\Application\Model\Plan\PlanDocument;
use App\Application\Model\Plan\Vertex;
use App\Domain\Enum\PlanUnit;
use App\Infrastructure\Doctrine\JsonDocumentType;
use Doctrine\DBAL\Connection;
use Symfony\Component\Serializer\Normalizer\DenormalizerInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;
use Symfony\Component\Uid\Uuid;

/**
 * Reads one version of a plan with all its contents into a document, as stored in the database.
 * Vertices, groups and styles have no order of their own and come in the order of their ids,
 * which for UUIDv7 is the order they were made. An element is its columns and its props (read
 * through their Doctrine type) together, built by the serializer from the props' "type".
 */
final readonly class PlanDocumentReader
{
    public function __construct(
        private Connection $connection,
        private NormalizerInterface $normalizer,
        private DenormalizerInterface $denormalizer,
    ) {
    }

    public function read(Uuid $versionId): ?PlanDocument
    {
        // UuidType stores UUIDs as BINARY(16) on MySQL
        $version = ['version' => $versionId->toBinary()];

        $plan = $this->connection->fetchAssociative(
            'SELECT p.id, p.name, v.unit FROM plan_version v JOIN plan p ON p.id = v.plan_id WHERE v.id = :version',
            $version,
        );
        if (false === $plan) {
            return null;
        }

        $vertices = array_map(
            static fn (array $r): Vertex => new Vertex(self::id($r['id']), (float) $r['x'], (float) $r['y']),
            $this->connection->fetchAllAssociative('SELECT id, x, y FROM vertex WHERE plan_version_id = :version ORDER BY id', $version),
        );
        $layers = array_map(
            static fn (array $r): Layer => new Layer(self::id($r['id']), $r['name'], (bool) $r['visible'], (bool) $r['locked']),
            $this->connection->fetchAllAssociative('SELECT id, name, visible, locked FROM layer WHERE plan_version_id = :version ORDER BY position', $version),
        );
        $groups = array_map(
            static fn (array $r): Group => new Group(self::id($r['id']), $r['name']),
            $this->connection->fetchAllAssociative('SELECT id, name FROM element_group WHERE plan_version_id = :version ORDER BY id', $version),
        );
        $styles = array_map(
            static fn (array $r): ElementStyle => new ElementStyle(
                self::id($r['id']),
                $r['name'],
                $r['stroke_color'],
                (float) $r['stroke_width'],
                array_map(floatval(...), json_decode($r['dash_pattern'], true, flags: \JSON_THROW_ON_ERROR)),
                $r['fill_color'],
            ),
            $this->connection->fetchAllAssociative('SELECT id, name, stroke_color, stroke_width, dash_pattern, fill_color FROM element_style WHERE plan_version_id = :version ORDER BY id', $version),
        );

        $polylineVertices = [];
        foreach ($this->connection->fetchAllAssociative(
            'SELECT pv.polyline_id, pv.vertex_id FROM polyline_vertex pv JOIN element e ON e.id = pv.polyline_id WHERE e.plan_version_id = :version ORDER BY pv.polyline_id, pv.position',
            $version,
        ) as $r) {
            $polylineVertices[$r['polyline_id']][] = self::id($r['vertex_id']);
        }

        $elements = array_map(
            fn (array $r): ElementInterface => $this->element($r, $polylineVertices[$r['id']] ?? []),
            $this->connection->fetchAllAssociative('SELECT * FROM element WHERE plan_version_id = :version ORDER BY position', $version),
        );

        return new PlanDocument(
            id: self::id($plan['id']),
            name: $plan['name'],
            schemaVersion: PlanDocument::SCHEMA_VERSION,
            unit: PlanUnit::from($plan['unit']),
            vertices: $vertices,
            elements: $elements,
            layers: $layers,
            groups: $groups,
            styles: $styles,
        );
    }

    /**
     * @param array<string, mixed> $r         a row of the element table
     * @param list<string>         $vertexIds the polyline's vertices in order
     */
    private function element(array $r, array $vertexIds): ElementInterface
    {
        $vertexRefs = array_filter([
            'startVertexId' => self::nullableId($r['start_vertex_id']),
            'endVertexId' => self::nullableId($r['end_vertex_id']),
            'centerVertexId' => self::nullableId($r['center_vertex_id']),
            'vertexIds' => [] === $vertexIds ? null : $vertexIds,
        ], static fn (mixed $ref): bool => null !== $ref);

        return $this->denormalizer->denormalize([
            'id' => self::id($r['id']),
            'layerId' => self::nullableId($r['layer_id']),
            'groupId' => self::nullableId($r['group_id']),
            'styleId' => self::nullableId($r['style_id']),
            'name' => $r['name'],
            ...$vertexRefs,
            // The display values, with the "type" that picks the model
            ...$this->normalizer->normalize($this->connection->convertToPHPValue($r['props'], JsonDocumentType::NAME)),
        ], ElementInterface::class);
    }

    private static function id(string $binary): string
    {
        return Uuid::fromBinary($binary)->toRfc4122();
    }

    private static function nullableId(?string $binary): ?string
    {
        return null === $binary ? null : self::id($binary);
    }
}
