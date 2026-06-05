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

    /// <summary>
    /// Lifetime number of image exports (PNG generations) the user has consumed.
    /// Free accounts are capped (see UsageEndpoints); Pro accounts are unlimited.
    /// </summary>
    public int FreeExportsUsed { get; set; }

    /// <summary>
    /// Cards authored by this user.
    /// </summary>
    public ICollection<ReviewCard> ReviewCards { get; set; } = new List<ReviewCard>();
}
