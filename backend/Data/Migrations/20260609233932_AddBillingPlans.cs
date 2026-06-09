using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SocialReviewCard.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBillingPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsLifetime",
                table: "AspNetUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "BillingPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    StripePriceId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PriceLabel = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Interval = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Featured = table.Column<bool>(type: "boolean", nullable: false),
                    MaxRedemptions = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingPlans", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "BillingPlans",
                columns: new[] { "Id", "Enabled", "Featured", "Interval", "Kind", "MaxRedemptions", "Name", "PriceLabel", "SortOrder", "StripePriceId" },
                values: new object[] { 1, true, true, "month", "subscription", null, "Pro Monthly", "$1.99/mo", 1, "price_1TedWRIbIKIBamh8uORORo43" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BillingPlans");

            migrationBuilder.DropColumn(
                name: "IsLifetime",
                table: "AspNetUsers");
        }
    }
}
