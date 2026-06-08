using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TM.Web.Infrastructure.Persistence.Migrations
{
    public partial class AddGenerationWorkflowOptimizationTables : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "generation_preflight_reports",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    VolumeId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    Passed = table.Column<bool>(type: "INTEGER", nullable: false),
                    FatalCount = table.Column<int>(type: "INTEGER", nullable: false),
                    WarningCount = table.Column<int>(type: "INTEGER", nullable: false),
                    ItemsJson = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_generation_preflight_reports", x => x.Id));

            migrationBuilder.CreateTable(
                name: "scene_generation_records",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    RunId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SceneNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    SceneTitle = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    Model = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    PromptSnapshot = table.Column<string>(type: "TEXT", nullable: false),
                    Content = table.Column<string>(type: "TEXT", nullable: false),
                    Success = table.Column<bool>(type: "INTEGER", nullable: false),
                    Error = table.Column<string>(type: "TEXT", nullable: false),
                    CharCount = table.Column<int>(type: "INTEGER", nullable: false),
                    ElapsedMs = table.Column<long>(type: "INTEGER", nullable: false),
                    FinishReason = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_scene_generation_records", x => x.Id));

            migrationBuilder.CreateTable(
                name: "chapter_analysis_reports",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Passed = table.Column<bool>(type: "INTEGER", nullable: false),
                    ShouldPauseBatch = table.Column<bool>(type: "INTEGER", nullable: false),
                    WordCount = table.Column<int>(type: "INTEGER", nullable: false),
                    CoherenceScore = table.Column<int>(type: "INTEGER", nullable: false),
                    QualityScore = table.Column<int>(type: "INTEGER", nullable: false),
                    Summary = table.Column<string>(type: "TEXT", nullable: false),
                    ItemsJson = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_chapter_analysis_reports", x => x.Id));

            migrationBuilder.CreateIndex(
                name: "IX_generation_preflight_reports_ProjectId_ChapterId_CreatedAt",
                table: "generation_preflight_reports",
                columns: new[] { "ProjectId", "ChapterId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_scene_generation_records_ProjectId_ChapterId_SceneNumber_CreatedAt",
                table: "scene_generation_records",
                columns: new[] { "ProjectId", "ChapterId", "SceneNumber", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_chapter_analysis_reports_ProjectId_ChapterId_CreatedAt",
                table: "chapter_analysis_reports",
                columns: new[] { "ProjectId", "ChapterId", "CreatedAt" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "chapter_analysis_reports");
            migrationBuilder.DropTable(name: "generation_preflight_reports");
            migrationBuilder.DropTable(name: "scene_generation_records");
        }
    }
}
