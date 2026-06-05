using SocialReviewCard.Models;

namespace SocialReviewCard.Services;

/// <summary>
/// Encapsulates all interaction with Stripe: creating subscription checkout
/// sessions and processing inbound webhook events.
/// </summary>
public interface IStripeService
{
    /// <summary>
    /// Creates a Stripe Checkout Session for the $1.99/month recurring subscription.
    /// The user's email and id are attached to the session (and the resulting
    /// subscription) metadata so webhooks can be reconciled back to the account.
    /// </summary>
    /// <returns>The hosted Checkout URL to redirect the browser to.</returns>
    Task<string> CreateCheckoutSessionAsync(ApplicationUser user, CancellationToken cancellationToken = default);

    /// <summary>
    /// Verifies the <c>Stripe-Signature</c> header against the configured webhook
    /// secret and processes supported subscription lifecycle events, updating the
    /// owning user's billing state.
    /// </summary>
    Task HandleWebhookAsync(string requestBody, string signatureHeader, CancellationToken cancellationToken = default);
}
