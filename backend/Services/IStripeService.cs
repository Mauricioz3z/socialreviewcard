using SocialReviewCard.Models;

namespace SocialReviewCard.Services;

/// <summary>
/// Encapsulates all interaction with Stripe: creating subscription checkout
/// sessions and processing inbound webhook events.
/// </summary>
public interface IStripeService
{
    /// <summary>
    /// Creates a Stripe Checkout Session for the given price. <paramref name="lifetime"/>
    /// switches it to a one-time payment (Mode=payment) instead of a subscription.
    /// The user's email and id are attached to the metadata so webhooks can be
    /// reconciled back to the account.
    /// </summary>
    /// <returns>The hosted Checkout URL to redirect the browser to.</returns>
    Task<string> CreateCheckoutSessionAsync(ApplicationUser user, string priceId, bool lifetime, CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifies the <c>Stripe-Signature</c> header against the configured webhook
    /// secret and processes supported subscription lifecycle events, updating the
    /// owning user's billing state.
    /// </summary>
    Task HandleWebhookAsync(string requestBody, string signatureHeader, CancellationToken cancellationToken = default);
}
