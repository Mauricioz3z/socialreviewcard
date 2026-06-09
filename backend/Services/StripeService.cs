using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SocialReviewCard.Data;
using SocialReviewCard.Models;
using Stripe;
using Stripe.Checkout;

namespace SocialReviewCard.Services;

/// <summary>
/// Concrete <see cref="IStripeService"/> implementation built on Stripe.net.
/// </summary>
public class StripeService : IStripeService
{
    private readonly StripeOptions _options;
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<StripeService> _logger;

    public StripeService(
        IOptions<StripeOptions> options,
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        ILogger<StripeService> logger)
    {
        _options = options.Value;
        _db = db;
        _userManager = userManager;
        _logger = logger;

        // Stripe.net reads the secret key from the static client config.
        StripeConfiguration.ApiKey = _options.SecretKey;
    }

    public async Task<string> CreateCheckoutSessionAsync(ApplicationUser user, string priceId, bool lifetime, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(priceId))
            throw new InvalidOperationException("No Stripe price id was provided for checkout.");

        // Reuse an existing Stripe customer when we have one; otherwise let Checkout
        // create one from the supplied email (captured back via the webhook).
        var metadata = new Dictionary<string, string>
        {
            ["userId"] = user.Id,
            ["email"] = user.Email ?? string.Empty,
            ["lifetime"] = lifetime ? "true" : "false",
        };

        var sessionOptions = new SessionCreateOptions
        {
            Mode = lifetime ? "payment" : "subscription",
            ClientReferenceId = user.Id,
            SuccessUrl = _options.SuccessUrl,
            CancelUrl = _options.CancelUrl,
            LineItems = new List<SessionLineItemOptions>
            {
                new() { Price = priceId, Quantity = 1 },
            },
            Metadata = metadata,
            // Recurring plans: propagate metadata onto the subscription so the
            // customer.subscription.* webhooks reconcile to the account.
            SubscriptionData = lifetime ? null : new SessionSubscriptionDataOptions { Metadata = metadata },
        };

        if (!string.IsNullOrWhiteSpace(user.StripeCustomerId))
        {
            sessionOptions.Customer = user.StripeCustomerId;
        }
        else
        {
            sessionOptions.CustomerEmail = user.Email;
        }

        var service = new SessionService();
        try
        {
            var session = await service.CreateAsync(sessionOptions, cancellationToken: cancellationToken);
            _logger.LogInformation("Created Stripe checkout session {SessionId} for user {UserId}", session.Id, user.Id);
            return session.Url;
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe rejected checkout session creation for user {UserId}", user.Id);
            throw;
        }
    }

    public async Task HandleWebhookAsync(string requestBody, string signatureHeader, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.WebhookSecret))
            throw new InvalidOperationException("Stripe WebhookSecret is not configured.");

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(
                requestBody,
                signatureHeader,
                _options.WebhookSecret,
                throwOnApiVersionMismatch: false);
        }
        catch (StripeException ex)
        {
            // Signature verification failed — reject as untrusted.
            _logger.LogWarning(ex, "Rejected Stripe webhook with invalid signature.");
            throw;
        }

        switch (stripeEvent.Type)
        {
            case "checkout.session.completed":
                await HandleCheckoutCompletedAsync(stripeEvent, cancellationToken);
                break;

            case "customer.subscription.updated":
                await HandleSubscriptionChangedAsync(stripeEvent, cancellationToken);
                break;

            case "customer.subscription.deleted":
                await HandleSubscriptionDeletedAsync(stripeEvent, cancellationToken);
                break;

            default:
                _logger.LogDebug("Ignoring unhandled Stripe event type {EventType}", stripeEvent.Type);
                break;
        }
    }

    private async Task HandleCheckoutCompletedAsync(Event stripeEvent, CancellationToken cancellationToken)
    {
        if (stripeEvent.Data.Object is not Session session)
        {
            _logger.LogWarning("checkout.session.completed payload was not a Session.");
            return;
        }

        var userId = session.ClientReferenceId
                     ?? (session.Metadata != null && session.Metadata.TryGetValue("userId", out var id) ? id : null);

        var user = await ResolveUserAsync(userId, session.CustomerId, cancellationToken);
        if (user is null)
        {
            _logger.LogWarning("No user matched checkout session {SessionId} (userId={UserId}, customer={CustomerId})",
                session.Id, userId, session.CustomerId);
            return;
        }

        if (!string.IsNullOrWhiteSpace(session.CustomerId))
            user.StripeCustomerId = session.CustomerId;

        user.SubscriptionStatus = "active";

        // One-time (lifetime) purchase: mark Pro forever; there's no subscription.
        var isLifetime = string.Equals(session.Mode, "payment", StringComparison.OrdinalIgnoreCase)
            || (session.Metadata != null && session.Metadata.TryGetValue("lifetime", out var lt) && lt == "true");
        if (isLifetime)
        {
            user.IsLifetime = true;
            user.SubscriptionEndDate = null;
        }
        else if (!string.IsNullOrWhiteSpace(session.SubscriptionId))
        {
            // Recurring: pull the subscription to record the period end date.
            var sub = await new SubscriptionService().GetAsync(session.SubscriptionId, cancellationToken: cancellationToken);
            ApplySubscriptionState(user, sub);
        }

        await _db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Activated {Kind} for user {UserId} via session {SessionId}",
            isLifetime ? "lifetime" : "subscription", user.Id, session.Id);
    }

    private async Task HandleSubscriptionChangedAsync(Event stripeEvent, CancellationToken cancellationToken)
    {
        if (stripeEvent.Data.Object is not Subscription sub)
        {
            _logger.LogWarning("customer.subscription.updated payload was not a Subscription.");
            return;
        }

        var userId = sub.Metadata != null && sub.Metadata.TryGetValue("userId", out var id) ? id : null;
        var user = await ResolveUserAsync(userId, sub.CustomerId, cancellationToken);
        if (user is null)
        {
            _logger.LogWarning("No user matched subscription {SubscriptionId} (customer={CustomerId})", sub.Id, sub.CustomerId);
            return;
        }

        if (!string.IsNullOrWhiteSpace(sub.CustomerId))
            user.StripeCustomerId = sub.CustomerId;

        ApplySubscriptionState(user, sub);

        await _db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Updated subscription state for user {UserId} -> {Status}", user.Id, user.SubscriptionStatus);
    }

    private async Task HandleSubscriptionDeletedAsync(Event stripeEvent, CancellationToken cancellationToken)
    {
        if (stripeEvent.Data.Object is not Subscription sub)
        {
            _logger.LogWarning("customer.subscription.deleted payload was not a Subscription.");
            return;
        }

        var userId = sub.Metadata != null && sub.Metadata.TryGetValue("userId", out var id) ? id : null;
        var user = await ResolveUserAsync(userId, sub.CustomerId, cancellationToken);
        if (user is null)
        {
            _logger.LogWarning("No user matched canceled subscription {SubscriptionId} (customer={CustomerId})", sub.Id, sub.CustomerId);
            return;
        }

        user.SubscriptionStatus = "canceled";
        user.SubscriptionEndDate = sub.EndedAt ?? sub.CurrentPeriodEnd;

        await _db.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Canceled subscription for user {UserId}", user.Id);
    }

    /// <summary>Maps Stripe subscription status onto our local fields.</summary>
    private static void ApplySubscriptionState(ApplicationUser user, Subscription sub)
    {
        user.SubscriptionStatus = sub.Status switch
        {
            "active" or "trialing" => "active",
            "past_due" or "unpaid" => "past_due",
            "canceled" or "incomplete_expired" => "canceled",
            _ => user.SubscriptionStatus,
        };
        user.SubscriptionEndDate = sub.CurrentPeriodEnd;
    }

    /// <summary>
    /// Finds the local user either by the id we stamped into metadata or by the
    /// Stripe customer id we previously stored.
    /// </summary>
    private async Task<ApplicationUser?> ResolveUserAsync(string? userId, string? customerId, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(userId))
        {
            var byId = await _userManager.FindByIdAsync(userId);
            if (byId is not null)
                return byId;
        }

        if (!string.IsNullOrWhiteSpace(customerId))
        {
            return await _db.Users
                .FirstOrDefaultAsync(u => u.StripeCustomerId == customerId, cancellationToken);
        }

        return null;
    }
}
