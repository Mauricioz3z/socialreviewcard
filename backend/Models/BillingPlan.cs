namespace SocialReviewCard.Models;

/// <summary>
/// A purchasable plan, managed from the admin backoffice so Stripe price ids,
/// labels and the Founder's Deal cap can change without a redeploy/restart.
/// The Stripe price id stays server-side (the SPA references plans by our Id).
/// </summary>
public class BillingPlan
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>Stripe Price id (price_...). Never exposed to the client.</summary>
    public string StripePriceId { get; set; } = string.Empty;

    /// <summary>"subscription" (recurring) or "lifetime" (one-time payment).</summary>
    public string Kind { get; set; } = "subscription";

    /// <summary>Display price, e.g. "$7/mo", "$49/yr", "$49 once".</summary>
    public string PriceLabel { get; set; } = string.Empty;

    /// <summary>Display interval hint: "month" | "year" | "once".</summary>
    public string Interval { get; set; } = "month";

    public bool Enabled { get; set; } = true;
    public int SortOrder { get; set; }

    /// <summary>The plan the in-app upgrade button uses by default.</summary>
    public bool Featured { get; set; }

    /// <summary>Optional cap (Founder's Deal): max lifetime redemptions. Null = unlimited.</summary>
    public int? MaxRedemptions { get; set; }
}
