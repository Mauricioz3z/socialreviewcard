using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using SocialReviewCard.Data;
using SocialReviewCard.Models;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// Server-side enforcement of the free export quota. Each PNG export the SPA
/// performs must first claim a slot here; free accounts get a lifetime cap
/// (configurable via <see cref="PlatformSettings.FreeExportLimit"/>), Pro
/// (active subscription) accounts are unlimited.
/// </summary>
public static class UsageEndpoints
{
    /// <summary>Fallback cap used only if the settings row is missing.</summary>
    public const int DefaultFreeExportLimit = 3;

    public static RouteGroupBuilder MapUsageEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/usage")
            .RequireAuthorization()
            .WithTags("Usage");

        // GET /api/usage -> current quota snapshot (no mutation).
        group.MapGet("/", async (ClaimsPrincipal principal, UserManager<ApplicationUser> userManager, ApplicationDbContext db, CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var user = await userManager.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            var limit = await FreeLimitAsync(db, ct);
            return Results.Ok(Snapshot(user, limit, allowed: IsPro(user) || user.FreeExportsUsed < limit));
        });

        // POST /api/usage/export -> claim one export. 402 when the free quota is exhausted.
        group.MapPost("/export", async (ClaimsPrincipal principal, UserManager<ApplicationUser> userManager, ApplicationDbContext db, CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var user = await userManager.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            var limit = await FreeLimitAsync(db, ct);

            if (IsPro(user))
            {
                // Unlimited; count toward lifetime metrics but not the free quota.
                user.TotalExports += 1;
                await userManager.UpdateAsync(user);
                return Results.Ok(Snapshot(user, limit, allowed: true));
            }

            if (user.FreeExportsUsed >= limit)
            {
                return Results.Json(Snapshot(user, limit, allowed: false), statusCode: StatusCodes.Status402PaymentRequired);
            }

            user.FreeExportsUsed += 1;
            user.TotalExports += 1;
            var update = await userManager.UpdateAsync(user);
            if (!update.Succeeded)
                return Results.Problem("Could not record export.", statusCode: StatusCodes.Status500InternalServerError);

            return Results.Ok(Snapshot(user, limit, allowed: true));
        });

        return group;
    }

    private static async Task<int> FreeLimitAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var s = await db.PlatformSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == PlatformSettings.SingletonId, ct);
        return s?.FreeExportLimit ?? DefaultFreeExportLimit;
    }

    private static bool IsPro(ApplicationUser user) =>
        string.Equals(user.SubscriptionStatus, "active", StringComparison.OrdinalIgnoreCase);

    private static UsageResponse Snapshot(ApplicationUser user, int limit, bool allowed)
    {
        var pro = IsPro(user);
        return new UsageResponse
        {
            IsPro = pro,
            FreeLimit = limit,
            ExportsUsed = user.FreeExportsUsed,
            Remaining = pro ? null : Math.Max(0, limit - user.FreeExportsUsed),
            Allowed = allowed,
        };
    }
}
