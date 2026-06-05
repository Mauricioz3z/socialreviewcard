namespace SocialReviewCard.Models;

/// <summary>Snapshot of a user's export quota.</summary>
public class UsageResponse
{
    /// <summary>True when the user has an active subscription (unlimited exports).</summary>
    public bool IsPro { get; set; }

    /// <summary>Lifetime free export allowance for non-Pro accounts.</summary>
    public int FreeLimit { get; set; }

    /// <summary>How many exports the user has consumed.</summary>
    public int ExportsUsed { get; set; }

    /// <summary>Free exports left; null when Pro (unlimited).</summary>
    public int? Remaining { get; set; }

    /// <summary>Whether the most recent export request was permitted.</summary>
    public bool Allowed { get; set; }
}
