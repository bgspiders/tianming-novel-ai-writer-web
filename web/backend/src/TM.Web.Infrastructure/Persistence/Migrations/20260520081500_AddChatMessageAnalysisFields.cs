using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TM.Web.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddChatMessageAnalysisFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AnalysisBlocksJson",
                table: "chat_messages",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Summary",
                table: "chat_messages",
                type: "TEXT",
                maxLength: 512,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnalysisBlocksJson",
                table: "chat_messages");

            migrationBuilder.DropColumn(
                name: "Summary",
                table: "chat_messages");
        }
    }
}
