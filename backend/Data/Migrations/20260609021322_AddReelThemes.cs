using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SocialReviewCard.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddReelThemes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReelThemes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Json = table.Column<string>(type: "jsonb", nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReelThemes", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "ReelThemes",
                columns: new[] { "Id", "Enabled", "Json", "Name", "SortOrder", "UpdatedAt" },
                values: new object[] { 1, true, "{\"themeId\":\"boho-botanical-v1\",\"name\":\"Boho Botanical\",\"totalDurationMs\":8000,\"fps\":30,\"dimensions\":{\"width\":1080,\"height\":1920},\"background\":{\"type\":\"ambient-gradient\",\"colors\":[\"#f4ebe1\",\"#e4d4c8\",\"#dfcdbe\"],\"shiftSpeedMs\":15000,\"angleDeg\":135,\"vignette\":0.16},\"foregroundAssets\":[{\"id\":\"left-eucalyptus\",\"type\":\"svg\",\"url\":\"/assets/botanical/branch_left.svg\",\"position\":{\"bottom\":-30,\"left\":-40},\"size\":{\"width\":520},\"transformOrigin\":\"bottom-left\",\"opacity\":0.95,\"animation\":{\"type\":\"sway\",\"maxRotationDeg\":2.2,\"frequencyHz\":0.22},\"layer\":\"front-card\"},{\"id\":\"right-eucalyptus\",\"type\":\"svg\",\"url\":\"/assets/botanical/branch_left.svg\",\"position\":{\"top\":-40,\"right\":-60},\"size\":{\"width\":440},\"transformOrigin\":\"top-right\",\"opacity\":0.9,\"animation\":{\"type\":\"sway\",\"maxRotationDeg\":2,\"frequencyHz\":0.18,\"phase\":1.4},\"layer\":\"front-card\"},{\"id\":\"top-cloud\",\"type\":\"svg\",\"url\":\"/assets/botanical/cloud_doodle.svg\",\"position\":{\"top\":150,\"left\":90},\"size\":{\"width\":260},\"transformOrigin\":\"center\",\"opacity\":0.5,\"animation\":{\"type\":\"float\",\"amplitudePx\":12,\"frequencyHz\":0.2},\"layer\":\"behind-card\"}],\"cardContainer\":{\"entranceDelayMs\":500,\"entranceDurationMs\":750,\"entranceAnimation\":\"scale-up-bounce\",\"fitScale\":0.78,\"shadow\":true,\"continuousAnimation\":{\"type\":\"slow-parallax-zoom\",\"maxScale\":1.05}},\"contentTimeline\":{\"starsReveal\":{\"delayMs\":1200,\"staggerMs\":150},\"textReveal\":{\"delayMs\":2000,\"type\":\"fade-up-word\",\"staggerMs\":100}}}", "Boho Botanical", 1, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReelThemes");
        }
    }
}
