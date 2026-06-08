using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TM.Web.Infrastructure.Persistence.Migrations
{
    public partial class AddPromptRunSnapshots : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "prompt_run_snapshots",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    RunId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ProjectId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ChapterId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    WorkflowId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    StepKey = table.Column<string>(type: "TEXT", maxLength: 32, nullable: true),
                    Source = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Model = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Temperature = table.Column<float>(type: "REAL", nullable: true),
                    MaxTokens = table.Column<int>(type: "INTEGER", nullable: true),
                    ContextHash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ContextSummary = table.Column<string>(type: "TEXT", nullable: false),
                    PromptSummary = table.Column<string>(type: "TEXT", nullable: false),
                    OutputSummary = table.Column<string>(type: "TEXT", nullable: false),
                    Success = table.Column<bool>(type: "INTEGER", nullable: false),
                    Error = table.Column<string>(type: "TEXT", nullable: false),
                    ElapsedMs = table.Column<long>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table => table.PrimaryKey("PK_prompt_run_snapshots", x => x.Id));

            migrationBuilder.CreateIndex(
                name: "IX_prompt_run_snapshots_ProjectId_ChapterId_CreatedAt",
                table: "prompt_run_snapshots",
                columns: new[] { "ProjectId", "ChapterId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_prompt_run_snapshots_RunId",
                table: "prompt_run_snapshots",
                column: "RunId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "prompt_run_snapshots");
        }
    }
}
