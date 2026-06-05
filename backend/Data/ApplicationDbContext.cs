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
    }
}
