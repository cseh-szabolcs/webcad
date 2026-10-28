<?php

declare(strict_types=1);

namespace DoctrineMigrations\Tenant;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261028224412 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'element.props as json_document: the class name of the props under "#type"';
    }

    /**
     * Element type => class of its props. Spelled out rather than taken from the classes, so the
     * migration keeps its meaning when they move.
     */
    private const array PROPS_CLASSES = [
        'line' => 'App\Domain\ElementProps\LineProps',
        'polyline' => 'App\Domain\ElementProps\PolylineProps',
        'arc' => 'App\Domain\ElementProps\ArcProps',
        'circle' => 'App\Domain\ElementProps\CircleProps',
        'ellipse' => 'App\Domain\ElementProps\EllipseProps',
        'bezier' => 'App\Domain\ElementProps\BezierProps',
    ];

    public function up(Schema $schema): void
    {
        foreach (self::PROPS_CLASSES as $type => $class) {
            $this->addSql('UPDATE element SET props = JSON_SET(props, \'$."#type"\', ?) WHERE type = ?', [$class, $type]);
        }
    }

    public function down(Schema $schema): void
    {
        $this->addSql('UPDATE element SET props = JSON_REMOVE(props, \'$."#type"\')');
    }
}
