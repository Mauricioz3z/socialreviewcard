using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SocialReviewCard.Data;
using SocialReviewCard.Models;
using SocialReviewCard.Services;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// Stripe billing endpoints: plans (DB-managed), starting checkout, and webhooks.
/// </summary>
public static class BillingEndpoints
{
    public static RouteGroupBuilder MapBillingEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/billing").WithTags("Billing");

        // GET /api/billing/plans -> public plan list (no Stripe price ids).
        group.MapGet("/plans", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var plans = await db.BillingPlans.AsNoTracking()
                .Where(p => p.Enabled)
                .OrderBy(p => p.SortOrder)
                .Select(p => new PublicBillingPlanDto
                {
                    Id = p.Id, Name = p.Name, PriceLabel = p.PriceLabel, Kind = p.Kind, Interval = p.Interval, Featured = p.Featured,
                })
                .ToListAsync(ct);
            return Results.Ok(plans);
        }).AllowAnonymous();

        // GET /api/billing/founder-count -> claimed/limit for the lifetime plan.
        group.MapGet("/founder-count", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var lifetime = await db.BillingPlans.AsNoTracking()
                .Where(p => p.Enabled && p.Kind == "lifetime")
                .OrderBy(p => p.SortOrder)
                .FirstOrDefaultAsync(ct);
            var claimed = await db.Users.CountAsync(u => u.IsLifetime, ct);
            var limit = lifetime?.MaxRedemptions;
            return Results.Ok(new FounderCountResponse
            {
                Claimed = claimed,
                Limit = limit,
                Available = lifetime != null && (limit == null || claimed < limit),
            });
        }).AllowAnonymous();

        // POST /api/billing/checkout -> returns the hosted Stripe Checkout URL.
        group.MapPost("/checkout", async (
            [FromBody] CheckoutRequest? request,
            ClaimsPrincipal principal,
            UserManager<ApplicationUser> userManager,
            ApplicationDbContext db,
            IStripeService stripe,
            CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var user = await userManager.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            // Resolve the plan: explicit id, else the featured/first enabled plan.
            BillingPlan? plan = null;
            if (request?.PlanId is int pid)
                plan = await db.BillingPlans.FirstOrDefaultAsync(p => p.Id == pid && p.Enabled, ct);
            plan ??= await db.BillingPlans.Where(p => p.Enabled)
                .OrderByDescending(p => p.Featured).ThenBy(p => p.SortOrder)
                .FirstOrDefaultAsync(ct);

            if (plan is null)
                return Results.Problem("No billing plan is configured.", statusCode: StatusCodes.Status502BadGateway);

            var lifetime = string.Equals(plan.Kind, "lifetime", StringComparison.OrdinalIgnoreCase);
            if (lifetime && plan.MaxRedemptions is int max)
            {
                var claimed = await db.Users.CountAsync(u => u.IsLifetime, ct);
                if (claimed >= max)
                    return Results.Problem("This deal is sold out.", statusCode: StatusCodes.Status409Conflict);
            }

            try
            {
                var url = await stripe.CreateCheckoutSessionAsync(user, plan.StripePriceId, lifetime, ct);
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
                IsPro = user.IsLifetime || string.Equals(user.SubscriptionStatus, "active", StringComparison.OrdinalIgnoreCase),
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
