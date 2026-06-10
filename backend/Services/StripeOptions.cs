namespace SocialReviewCard.Services;

/// <summary>Strongly-typed binding of the "Stripe" configuration section.</summary>
public class StripeOptions
{
    public const string SectionName = "Stripe";

    public string SecretKey { get; set; } = string.Empty;
    public string PublishableKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;

    /// <summary>Fallback recurring price id from the Stripe dashboard (DB billing plans take precedence).</summary>
    public string PriceId { get; set; } = string.Empty;

    public string SuccessUrl { get; set; } = string.Empty;
    public string CancelUrl { get; set; } = string.Empty;
}
