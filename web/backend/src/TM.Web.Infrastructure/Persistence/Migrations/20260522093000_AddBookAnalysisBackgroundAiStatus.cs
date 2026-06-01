using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TM.Web.Infrastructure.Persistence.Migrations
{
    public partial class AddBookAnalysisBackgroundAiStatus : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "BackgroundAiFinishedAt",
                table: "book_analyses",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundAiJobId",
                table: "book_analyses",
                type: "TEXT",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundAiMessage",
                table: "book_analyses",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "BackgroundAiRequestedAt",
                table: "book_analyses",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BackgroundAiStatus",
                table: "book_analyses",
                type: "TEXT",
                maxLength: 32,
                nullable: false,
                defaultValue: "idle");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BackgroundAiFinishedAt",
                table: "book_analyses");

            migrationBuilder.DropColumn(
                name: "BackgroundAiJobId",
                table: "book_analyses");

            migrationBuilder.DropColumn(
                name: "BackgroundAiMessage",
                table: "book_analyses");

            migrationBuilder.DropColumn(
                name: "BackgroundAiRequestedAt",
                table: "book_analyses");

            migrationBuilder.DropColumn(
                name: "BackgroundAiStatus",
                table: "book_analyses");
        }
    }
}
