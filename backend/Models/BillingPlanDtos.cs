namespace SocialReviewCard.Models;

/// <summary>Admin view of a plan (includes the Stripe price id).</summary>
public class BillingPlanDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string StripePriceId { get; set; } = "";
    public string Kind { get; set; } = "subscription";
    public string PriceLabel { get; set; } = "";
    public string Interval { get; set; } = "month";
    public bool Enabled { get; set; }
    public int SortOrder { get; set; }
    public bool Featured { get; set; }
    public int? MaxRedemptions { get; set; }
}

public class BillingPlanUpsertRequest
{
    public string Name { get; set; } = "";
    public string StripePriceId { get; set; } = "";
    public string Kind { get; set; } = "subscription";
    public string PriceLabel { get; set; } = "";
    public string Interval { get; set; } = "month";
    public bool Enabled { get; set; } = true;
    public int SortOrder { get; set; }
    public bool Featured { get; set; }
    public int? MaxRedemptions { get; set; }
}

/// <summary>Public plan info for the pricing UI (no Stripe price id).</summary>
public class PublicBillingPlanDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string PriceLabel { get; set; } = "";
    public string Kind { get; set; } = "subscription";
    public string Interval { get; set; } = "month";
    public bool Featured { get; set; }
}

public class FounderCountResponse
{
    public int Claimed { get; set; }
    public int? Limit { get; set; }
    public bool Available { get; set; }
}

/// <summary>Optional plan selection on checkout (defaults to the featured plan).</summary>
public class CheckoutRequest
{
    public int? PlanId { get; set; }
}
