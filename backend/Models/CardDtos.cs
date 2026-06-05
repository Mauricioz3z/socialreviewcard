using System.ComponentModel.DataAnnotations;

namespace SocialReviewCard.Models;

/// <summary>
/// Inbound payload for creating or updating a card. When <see cref="Id"/> is provided
/// and owned by the caller, the existing card is updated; otherwise a new one is created.
/// </summary>
public class CardUpsertRequest
{
    public Guid? Id { get; set; }

    [Required]
    [MaxLength(2000)]
    public string ReviewText { get; set; } = string.Empty;

    [Required]
    [MaxLength(120)]
    public string ReviewerName { get; set; } = string.Empty;

    [Range(1, 5)]
    public int Rating { get; set; } = 5;

    [Required]
    [MaxLength(40)]
    public string Platform { get; set; } = "Custom";

    [Required]
    public string StylesJson { get; set; } = "{}";
}

/// <summary>Outbound representation of a card.</summary>
public class CardResponse
{
    public Guid Id { get; set; }
    public string ReviewText { get; set; } = string.Empty;
    public string ReviewerName { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string Platform { get; set; } = string.Empty;
    public string StylesJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }

    public static CardResponse FromEntity(ReviewCard c) => new()
    {
        Id = c.Id,
        ReviewText = c.ReviewText,
        ReviewerName = c.ReviewerName,
        Rating = c.Rating,
        Platform = c.Platform,
        StylesJson = c.StylesJson,
        CreatedAt = c.CreatedAt,
    };
}

/// <summary>Outbound representation of a created checkout session.</summary>
public class CheckoutResponse
{
    public string Url { get; set; } = string.Empty;
}

/// <summary>Outbound representation of the caller's current subscription state.</summary>
public class BillingStatusResponse
{
    /// <summary>"free", "active", "canceled" or "past_due".</summary>
    public string Status { get; set; } = "free";

    /// <summary>End of the current paid period, when subscribed.</summary>
    public DateTime? SubscriptionEndDate { get; set; }

    /// <summary>True when the account currently has Pro access.</summary>
    public bool IsPro { get; set; }
}
