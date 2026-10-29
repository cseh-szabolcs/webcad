<?php

declare(strict_types=1);

namespace DoctrineMigrations\Tenant;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261029220621 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'element.props: the props classes moved from App\Domain\ElementProps to App\Plan\Props';
    }

    /**
     * Element type => class of its props before and after the move. Spelled out rather than taken
     * from the classes, so the migration keeps its meaning when they move again.
     */
    private const array PROPS_CLASSES = [
        'line' => ['App\Domain\ElementProps\LineProps', 'App\Plan\Props\LineProps'],
        'polyline' => ['App\Domain\ElementProps\PolylineProps', 'App\Plan\Props\PolylineProps'],
        'arc' => ['App\Domain\ElementProps\ArcProps', 'App\Plan\Props\ArcProps'],
        'circle' => ['App\Domain\ElementProps\CircleProps', 'App\Plan\Props\CircleProps'],
        'ellipse' => ['App\Domain\ElementProps\EllipseProps', 'App\Plan\Props\EllipseProps'],
        'bezier' => ['App\Domain\ElementProps\BezierProps', 'App\Plan\Props\BezierProps'],
    ];

    public function up(Schema $schema): void
    {
        foreach (self::PROPS_CLASSES as $type => [$old, $new]) {
            $this->setClass($type, $old, $new);
        }
    }

    public function down(Schema $schema): void
    {
        foreach (self::PROPS_CLASSES as $type => [$old, $new]) {
            $this->setClass($type, $new, $old);
        }
    }

    private function setClass(string $type, string $from, string $to): void
    {
        $this->addSql(
            'UPDATE element SET props = JSON_SET(props, \'$."#type"\', ?) WHERE type = ? AND JSON_UNQUOTE(JSON_EXTRACT(props, \'$."#type"\')) = ?',
            [$to, $type, $from],
        );
    }
}
