using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TM.Web.Infrastructure.Persistence.Migrations
{
    public partial class AddLocalAuth : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "app_users",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Username = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    PasswordSalt = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_app_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "app_sessions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    UserId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    TokenHash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastSeenAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_app_sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_app_sessions_app_users_UserId",
                        column: x => x.UserId,
                        principalTable: "app_users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_app_sessions_TokenHash",
                table: "app_sessions",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_app_sessions_UserId_ExpiresAt",
                table: "app_sessions",
                columns: new[] { "UserId", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_app_users_Username",
                table: "app_users",
                column: "Username",
                unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "app_sessions");
            migrationBuilder.DropTable(name: "app_users");
        }
    }
}

