using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SocialReviewCard.Models;

namespace SocialReviewCard.Data;

/// <summary>
/// EF Core context wiring up ASP.NET Core Identity (against PostgreSQL) and the
/// application's <see cref="ReviewCard"/> table.
/// </summary>
public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<ReviewCard> ReviewCards => Set<ReviewCard>();
    public DbSet<PlatformSettings> PlatformSettings => Set<PlatformSettings>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Configures the Identity tables (AspNetUsers, AspNetRoles, ...).
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(u => u.StripeCustomerId).HasMaxLength(255);
            entity.Property(u => u.SubscriptionStatus).HasMaxLength(20).HasDefaultValue("free");

            // Fast lookup when resolving a user from a Stripe webhook.
            entity.HasIndex(u => u.StripeCustomerId);
        });

        builder.Entity<ReviewCard>(entity =>
        {
            entity.HasKey(c => c.Id);

            entity.Property(c => c.ReviewText).IsRequired().HasMaxLength(2000);
            entity.Property(c => c.ReviewerName).IsRequired().HasMaxLength(120);
            entity.Property(c => c.Platform).IsRequired().HasMaxLength(40);
            entity.Property(c => c.StylesJson).IsRequired().HasColumnType("jsonb");
            entity.Property(c => c.CreatedAt).IsRequired();

            entity.HasIndex(c => c.UserId);

            entity.HasOne(c => c.User)
                  .WithMany(u => u.ReviewCards)
                  .HasForeignKey(c => c.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<PlatformSettings>(entity =>
        {
            entity.Property(s => s.ProPriceLabel).HasMaxLength(60);
            entity.Property(s => s.WatermarkText).HasMaxLength(120);
            entity.Property(s => s.UpgradeTitle).HasMaxLength(200);
            entity.Property(s => s.UpgradeSubtitle).HasMaxLength(300);

            // Seed the single configuration row. Uses a static timestamp because
            // EF Core requires seed values to be deterministic.
            entity.HasData(new PlatformSettings
            {
                Id = Models.PlatformSettings.SingletonId,
                FreeExportLimit = 3,
                ProPriceLabel = "$1.99/mo",
                ProFeaturesJson =
                    "[\"Unlimited high-resolution exports\",\"No watermark on your cards\",\"Every premium template & background\"]",
                UpgradeTitle = "You're out of free exports",
                UpgradeSubtitle = "Upgrade to ReviewCraft Pro to keep exporting",
                WatermarkEnabled = true,
                WatermarkText = "SocialReviewCard.com",
                HeadScripts = "",
                BodyScripts = "",
                UpdatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            });
        });

        builder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.ActorEmail).IsRequired().HasMaxLength(256);
            entity.Property(a => a.Action).IsRequired().HasMaxLength(80);
            entity.Property(a => a.IpAddress).HasMaxLength(64);
            entity.HasIndex(a => a.TimestampUtc);
        });
    }
}
