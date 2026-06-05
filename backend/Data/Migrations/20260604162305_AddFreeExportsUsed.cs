using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SocialReviewCard.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFreeExportsUsed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FreeExportsUsed",
                table: "AspNetUsers",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FreeExportsUsed",
                table: "AspNetUsers");
        }
    }
}
