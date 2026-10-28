<?php

declare(strict_types=1);

namespace DoctrineMigrations\Tenant;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261028205335 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Plan contents: plan, layer, element_group, element_style, vertex, element (all types), polyline_vertex';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE element (id BINARY(16) NOT NULL, position INT NOT NULL, name VARCHAR(255) DEFAULT NULL, plan_id BINARY(16) NOT NULL, layer_id BINARY(16) DEFAULT NULL, group_id BINARY(16) DEFAULT NULL, style_id BINARY(16) DEFAULT NULL, type VARCHAR(16) NOT NULL, start_vertex_id BINARY(16) DEFAULT NULL, end_vertex_id BINARY(16) DEFAULT NULL, closed TINYINT DEFAULT NULL, clockwise TINYINT DEFAULT NULL, center_vertex_id BINARY(16) DEFAULT NULL, radius DOUBLE PRECISION DEFAULT NULL, radius_x DOUBLE PRECISION DEFAULT NULL, radius_y DOUBLE PRECISION DEFAULT NULL, rotation DOUBLE PRECISION DEFAULT NULL, start_control_x DOUBLE PRECISION DEFAULT NULL, start_control_y DOUBLE PRECISION DEFAULT NULL, end_control_x DOUBLE PRECISION DEFAULT NULL, end_control_y DOUBLE PRECISION DEFAULT NULL, INDEX IDX_41405E39E899029B462CE4F5 (plan_id, position), INDEX IDX_41405E39E899029B (plan_id), INDEX IDX_41405E39EA6EFDCD (layer_id), INDEX IDX_41405E39FE54D947 (group_id), INDEX IDX_41405E39BACD6074 (style_id), INDEX IDX_41405E39B86E9951 (start_vertex_id), INDEX IDX_41405E39E3765E9F (end_vertex_id), INDEX IDX_41405E39788F9E25 (center_vertex_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE element_group (id BINARY(16) NOT NULL, name VARCHAR(255) NOT NULL, plan_id BINARY(16) NOT NULL, INDEX IDX_A9E2305CE899029B (plan_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE element_style (id BINARY(16) NOT NULL, name VARCHAR(255) NOT NULL, stroke_color VARCHAR(32) NOT NULL, stroke_width DOUBLE PRECISION NOT NULL, dash_pattern JSON NOT NULL, fill_color VARCHAR(32) DEFAULT NULL, plan_id BINARY(16) NOT NULL, INDEX IDX_F79FCCF3E899029B (plan_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE layer (id BINARY(16) NOT NULL, position INT NOT NULL, name VARCHAR(255) NOT NULL, visible TINYINT NOT NULL, locked TINYINT NOT NULL, plan_id BINARY(16) NOT NULL, INDEX IDX_E4DB211AE899029B462CE4F5 (plan_id, position), INDEX IDX_E4DB211AE899029B (plan_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE plan (revision INT NOT NULL, id BINARY(16) NOT NULL, name VARCHAR(255) NOT NULL, unit VARCHAR(2) NOT NULL, project_id BINARY(16) NOT NULL, INDEX IDX_DD5A5B7D166D1F9C (project_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE polyline_vertex (position INT NOT NULL, polyline_id BINARY(16) NOT NULL, vertex_id BINARY(16) NOT NULL, INDEX IDX_D054A4306C16EED5 (polyline_id), INDEX IDX_D054A43070A6E297 (vertex_id), PRIMARY KEY (polyline_id, position)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE vertex (id BINARY(16) NOT NULL, x DOUBLE PRECISION NOT NULL, y DOUBLE PRECISION NOT NULL, plan_id BINARY(16) NOT NULL, INDEX IDX_E9F17935E899029B (plan_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT FK_41405E39E899029B FOREIGN KEY (plan_id) REFERENCES plan (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT FK_41405E39EA6EFDCD FOREIGN KEY (layer_id) REFERENCES layer (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT FK_41405E39FE54D947 FOREIGN KEY (group_id) REFERENCES element_group (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT FK_41405E39BACD6074 FOREIGN KEY (style_id) REFERENCES element_style (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT FK_41405E39B86E9951 FOREIGN KEY (start_vertex_id) REFERENCES vertex (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT FK_41405E39E3765E9F FOREIGN KEY (end_vertex_id) REFERENCES vertex (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE element ADD CONSTRAINT FK_41405E39788F9E25 FOREIGN KEY (center_vertex_id) REFERENCES vertex (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE element_group ADD CONSTRAINT FK_A9E2305CE899029B FOREIGN KEY (plan_id) REFERENCES plan (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE element_style ADD CONSTRAINT FK_F79FCCF3E899029B FOREIGN KEY (plan_id) REFERENCES plan (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE layer ADD CONSTRAINT FK_E4DB211AE899029B FOREIGN KEY (plan_id) REFERENCES plan (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE plan ADD CONSTRAINT FK_DD5A5B7D166D1F9C FOREIGN KEY (project_id) REFERENCES project (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE polyline_vertex ADD CONSTRAINT FK_D054A4306C16EED5 FOREIGN KEY (polyline_id) REFERENCES element (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE polyline_vertex ADD CONSTRAINT FK_D054A43070A6E297 FOREIGN KEY (vertex_id) REFERENCES vertex (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE vertex ADD CONSTRAINT FK_E9F17935E899029B FOREIGN KEY (plan_id) REFERENCES plan (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY FK_41405E39E899029B');
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY FK_41405E39EA6EFDCD');
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY FK_41405E39FE54D947');
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY FK_41405E39BACD6074');
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY FK_41405E39B86E9951');
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY FK_41405E39E3765E9F');
        $this->addSql('ALTER TABLE element DROP FOREIGN KEY FK_41405E39788F9E25');
        $this->addSql('ALTER TABLE element_group DROP FOREIGN KEY FK_A9E2305CE899029B');
        $this->addSql('ALTER TABLE element_style DROP FOREIGN KEY FK_F79FCCF3E899029B');
        $this->addSql('ALTER TABLE layer DROP FOREIGN KEY FK_E4DB211AE899029B');
        $this->addSql('ALTER TABLE plan DROP FOREIGN KEY FK_DD5A5B7D166D1F9C');
        $this->addSql('ALTER TABLE polyline_vertex DROP FOREIGN KEY FK_D054A4306C16EED5');
        $this->addSql('ALTER TABLE polyline_vertex DROP FOREIGN KEY FK_D054A43070A6E297');
        $this->addSql('ALTER TABLE vertex DROP FOREIGN KEY FK_E9F17935E899029B');
        $this->addSql('DROP TABLE element');
        $this->addSql('DROP TABLE element_group');
        $this->addSql('DROP TABLE element_style');
        $this->addSql('DROP TABLE layer');
        $this->addSql('DROP TABLE plan');
        $this->addSql('DROP TABLE polyline_vertex');
        $this->addSql('DROP TABLE vertex');
    }
}
