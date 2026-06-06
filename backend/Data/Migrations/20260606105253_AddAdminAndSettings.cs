using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SocialReviewCard.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminAndSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "AspNetUsers",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "TotalExports",
                table: "AspNetUsers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TimestampUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ActorEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Action = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Details = table.Column<string>(type: "text", nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlatformSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FreeExportLimit = table.Column<int>(type: "integer", nullable: false),
                    ProPriceLabel = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    ProFeaturesJson = table.Column<string>(type: "text", nullable: false),
                    UpgradeTitle = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    UpgradeSubtitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    WatermarkEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    WatermarkText = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    HeadScripts = table.Column<string>(type: "text", nullable: false),
                    BodyScripts = table.Column<string>(type: "text", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformSettings", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "PlatformSettings",
                columns: new[] { "Id", "BodyScripts", "FreeExportLimit", "HeadScripts", "ProFeaturesJson", "ProPriceLabel", "UpdatedAt", "UpgradeSubtitle", "UpgradeTitle", "WatermarkEnabled", "WatermarkText" },
                values: new object[] { 1, "", 3, "", "[\"Unlimited high-resolution exports\",\"No watermark on your cards\",\"Every premium template & background\"]", "$1.99/mo", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Upgrade to ReviewCraft Pro to keep exporting", "You're out of free exports", true, "SocialReviewCard.com" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TimestampUtc",
                table: "AuditLogs",
                column: "TimestampUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "PlatformSettings");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "TotalExports",
                table: "AspNetUsers");
        }
    }
}
