using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using SocialReviewCard.Models;
using SocialReviewCard.Services;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// Stripe billing endpoints: starting a checkout session and receiving webhooks.
/// </summary>
public static class BillingEndpoints
{
    public static RouteGroupBuilder MapBillingEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/billing").WithTags("Billing");

        // POST /api/billing/checkout -> returns the hosted Stripe Checkout URL.
        group.MapPost("/checkout", async (
            ClaimsPrincipal principal,
            UserManager<ApplicationUser> userManager,
            IStripeService stripe,
            CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var user = await userManager.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            try
            {
                var url = await stripe.CreateCheckoutSessionAsync(user, ct);
                return Results.Ok(new CheckoutResponse { Url = url });
            }
            catch (Exception ex) when (ex is InvalidOperationException or Stripe.StripeException)
            {
                return Results.Problem(
                    title: "Unable to start checkout",
                    detail: ex.Message,
                    statusCode: StatusCodes.Status502BadGateway);
            }
        })
        .RequireAuthorization();

        // GET /api/billing/status -> the caller's current subscription state.
        group.MapGet("/status", async (
            ClaimsPrincipal principal,
            UserManager<ApplicationUser> userManager) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var user = await userManager.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            return Results.Ok(new BillingStatusResponse
            {
                Status = user.SubscriptionStatus,
                SubscriptionEndDate = user.SubscriptionEndDate,
                IsPro = string.Equals(user.SubscriptionStatus, "active", StringComparison.OrdinalIgnoreCase),
            });
        })
        .RequireAuthorization();

        // POST /api/billing/webhook -> verifies signature and processes events.
        group.MapPost("/webhook", async (
            HttpRequest request,
            IStripeService stripe,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            var logger = loggerFactory.CreateLogger("BillingWebhook");

            using var reader = new StreamReader(request.Body);
            var json = await reader.ReadToEndAsync(ct);

            var signature = request.Headers["Stripe-Signature"].ToString();
            if (string.IsNullOrWhiteSpace(signature))
                return Results.BadRequest(new { error = "Missing Stripe-Signature header." });

            try
            {
                await stripe.HandleWebhookAsync(json, signature, ct);
                return Results.Ok();
            }
            catch (Stripe.StripeException ex)
            {
                // Invalid signature or malformed payload — do not retry.
                logger.LogWarning(ex, "Rejected Stripe webhook.");
                return Results.BadRequest(new { error = "Invalid webhook signature or payload." });
            }
            catch (Exception ex)
            {
                // Processing failure — return 500 so Stripe retries delivery.
                logger.LogError(ex, "Failed to process Stripe webhook.");
                return Results.Problem("Failed to process webhook.", statusCode: StatusCodes.Status500InternalServerError);
            }
        })
        .AllowAnonymous();

        return group;
    }
}
