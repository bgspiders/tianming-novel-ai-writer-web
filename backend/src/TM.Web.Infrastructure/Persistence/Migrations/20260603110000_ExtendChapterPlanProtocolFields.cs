using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TM.Web.Infrastructure.Persistence.Migrations
{
    public partial class ExtendChapterPlanProtocolFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MacroPhase",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TacticalArcId",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TacticalArcTitle",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ChapterType",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ConflictScore",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CoreEvent",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AllowedEntities",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "StatusMarkers",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TemporalAnchor",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SpatialAnchor",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TimelineCoordinate",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsSingularityEvent",
                table: "chapter_plans",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "BufferRole",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ForeshadowingTier",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ForeshadowingRole",
                table: "chapter_plans",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "MacroPhase", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "TacticalArcId", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "TacticalArcTitle", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "ChapterType", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "ConflictScore", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "CoreEvent", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "AllowedEntities", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "StatusMarkers", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "TemporalAnchor", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "SpatialAnchor", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "TimelineCoordinate", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "IsSingularityEvent", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "BufferRole", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "ForeshadowingTier", table: "chapter_plans");
            migrationBuilder.DropColumn(name: "ForeshadowingRole", table: "chapter_plans");
        }
    }
}
