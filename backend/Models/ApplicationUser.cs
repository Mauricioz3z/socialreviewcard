using Microsoft.AspNetCore.Identity;

namespace SocialReviewCard.Models;

/// <summary>
/// Application user backed by ASP.NET Core Identity, extended with the
/// Stripe billing fields required to manage a recurring subscription.
/// </summary>
public class ApplicationUser : IdentityUser
{
    /// <summary>
    /// The Stripe customer id (cus_...) created the first time a user starts
    /// a checkout session. Null until the user has interacted with billing.
    /// </summary>
    public string? StripeCustomerId { get; set; }

    /// <summary>
    /// Current subscription state. One of: "free", "active", "canceled", "past_due".
    /// </summary>
    public string SubscriptionStatus { get; set; } = "free";

    /// <summary>
    /// When the current paid period ends (renewal/expiry). Null while on the free plan.
    /// </summary>
    public DateTime? SubscriptionEndDate { get; set; }

    /// <summary>True for a one-time "lifetime" purchase — Pro forever, never expires.</summary>
    public bool IsLifetime { get; set; }

    /// <summary>
    /// Free-quota image exports consumed in the current monthly period (see
    /// UsageEndpoints). Resets to 0 at the start of a new calendar month.
    /// </summary>
    public int FreeExportsUsed { get; set; }

    /// <summary>Start of the period the <see cref="FreeExportsUsed"/> counter belongs to.</summary>
    public DateTime? FreeExportsPeriodStart { get; set; }

    /// <summary>
    /// Lifetime number of image exports across all plans (free + Pro), used for
    /// admin/dashboard metrics. Incremented on every successful export.
    /// </summary>
    public int TotalExports { get; set; }

    /// <summary>When the account was created (used for signup metrics).</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Cards authored by this user.
    /// </summary>
    public ICollection<ReviewCard> ReviewCards { get; set; } = new List<ReviewCard>();
}
