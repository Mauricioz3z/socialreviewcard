namespace SocialReviewCard.Services;

/// <summary>Strongly-typed binding of the "Stripe" configuration section.</summary>
public class StripeOptions
{
    public const string SectionName = "Stripe";

    public string SecretKey { get; set; } = string.Empty;
    public string PublishableKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;

    /// <summary>The recurring price id ($1.99/month) configured in the Stripe dashboard.</summary>
    public string PriceId { get; set; } = string.Empty;

    public string SuccessUrl { get; set; } = string.Empty;
    public string CancelUrl { get; set; } = string.Empty;
}
