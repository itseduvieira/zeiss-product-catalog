using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ProductCatalog.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 400, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IdSequences",
                columns: table => new
                {
                    Name = table.Column<string>(type: "TEXT", maxLength: 40, nullable: false),
                    LastValue = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IdSequences", x => x.Name);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    PriceMinorUnits = table.Column<long>(type: "INTEGER", nullable: false),
                    Stock = table.Column<int>(type: "INTEGER", nullable: false),
                    CategoryId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Products_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "Categories",
                columns: new[] { "Id", "Description", "Name" },
                values: new object[,]
                {
                    { 1, "Upright and stereo microscopes", "Microscopes" },
                    { 2, "Objectives, eyepieces and cameras", "Optics" },
                    { 3, "Illumination, covers and calibration", "Accessories" }
                });

            migrationBuilder.InsertData(
                table: "IdSequences",
                columns: new[] { "Name", "LastValue" },
                values: new object[] { "Product", 100008 });

            migrationBuilder.InsertData(
                table: "Products",
                columns: new[] { "Id", "CategoryId", "CreatedAt", "Description", "Name", "PriceMinorUnits", "Stock", "UpdatedAt" },
                values: new object[,]
                {
                    { 100001, 1, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc), "Upright microscope used in teaching labs.", "Primo Star", 245000L, 6, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc) },
                    { 100002, 1, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc), "Compact stereo microscope with an integrated camera.", "Stemi 305", 189000L, 4, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc) },
                    { 100003, 2, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc), "Microscope camera for routine color imaging.", "Axiocam 208 color", 320000L, 2, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc) },
                    { 100004, 2, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc), "High-resolution objective.", "Plan-Apochromat 20x", 410050L, 8, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc) },
                    { 100005, 3, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc), "Calibration slide, 1 mm scale.", "Stage micrometer", 8500L, 40, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc) },
                    { 100006, 3, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc), "Soft cover for an upright stand.", "Dust cover", 2990L, 15, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc) },
                    { 100007, 3, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc), "Replacement transmitted-light source.", "LED illuminator", 21000L, 0, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc) },
                    { 100008, 2, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc), "Widefield eyepiece.", "Eyepiece 10x/23", 16000L, 12, new DateTime(2024, 6, 1, 8, 0, 0, 0, DateTimeKind.Utc) }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name",
                table: "Categories",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Products_CategoryId",
                table: "Products",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Name",
                table: "Products",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Products_PriceMinorUnits",
                table: "Products",
                column: "PriceMinorUnits");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Stock",
                table: "Products",
                column: "Stock");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IdSequences");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "Categories");
        }
    }
}
