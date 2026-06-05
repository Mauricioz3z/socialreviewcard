using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using SocialReviewCard.Models;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// Server-side enforcement of the free export quota. Each PNG export the SPA
/// performs must first claim a slot here; free accounts get a lifetime cap,
/// Pro (active subscription) accounts are unlimited.
/// </summary>
public static class UsageEndpoints
{
    /// <summary>Lifetime free export allowance for non-Pro accounts.</summary>
    public const int FreeExportLimit = 3;

    public static RouteGroupBuilder MapUsageEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/usage")
            .RequireAuthorization()
            .WithTags("Usage");

        // GET /api/usage -> current quota snapshot (no mutation).
        group.MapGet("/", async (ClaimsPrincipal principal, UserManager<ApplicationUser> userManager) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var user = await userManager.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            return Results.Ok(Snapshot(user, allowed: IsPro(user) || user.FreeExportsUsed < FreeExportLimit));
        });

        // POST /api/usage/export -> claim one export. 402 when the free quota is exhausted.
        group.MapPost("/export", async (ClaimsPrincipal principal, UserManager<ApplicationUser> userManager) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var user = await userManager.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            if (IsPro(user))
            {
                // Unlimited; we don't increment the free counter for Pro users.
                return Results.Ok(Snapshot(user, allowed: true));
            }

            if (user.FreeExportsUsed >= FreeExportLimit)
            {
                return Results.Json(Snapshot(user, allowed: false), statusCode: StatusCodes.Status402PaymentRequired);
            }

            user.FreeExportsUsed += 1;
            var update = await userManager.UpdateAsync(user);
            if (!update.Succeeded)
                return Results.Problem("Could not record export.", statusCode: StatusCodes.Status500InternalServerError);

            return Results.Ok(Snapshot(user, allowed: true));
        });

        return group;
    }

    private static bool IsPro(ApplicationUser user) =>
        string.Equals(user.SubscriptionStatus, "active", StringComparison.OrdinalIgnoreCase);

    private static UsageResponse Snapshot(ApplicationUser user, bool allowed)
    {
        var pro = IsPro(user);
        return new UsageResponse
        {
            IsPro = pro,
            FreeLimit = FreeExportLimit,
            ExportsUsed = user.FreeExportsUsed,
            Remaining = pro ? null : Math.Max(0, FreeExportLimit - user.FreeExportsUsed),
            Allowed = allowed,
        };
    }
}
