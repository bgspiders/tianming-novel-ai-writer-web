using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TM.Web.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddValidationRunIds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RunId",
                table: "validation_reports",
                type: "TEXT",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LastRunId",
                table: "validation_summaries",
                type: "TEXT",
                maxLength: 64,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_validation_reports_ProjectId_RunId",
                table: "validation_reports",
                columns: new[] { "ProjectId", "RunId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_validation_reports_ProjectId_RunId",
                table: "validation_reports");

            migrationBuilder.DropColumn(
                name: "RunId",
                table: "validation_reports");

            migrationBuilder.DropColumn(
                name: "LastRunId",
                table: "validation_summaries");
        }
    }
}
