using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using SocialReviewCard.Data;
using SocialReviewCard.Models;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// Server-side enforcement of the free export quota. Free accounts get a
/// <b>monthly</b> allowance (configurable via <see cref="PlatformSettings.FreeExportLimit"/>)
/// that resets at the start of each calendar month; Pro accounts are unlimited.
/// </summary>
public static class UsageEndpoints
{
    /// <summary>Fallback monthly cap used only if the settings row is missing.</summary>
    public const int DefaultFreeExportLimit = 10;

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
            var used = EffectiveUsed(user, DateTime.UtcNow);
            return Results.Ok(Snapshot(user, limit, used, allowed: IsPro(user) || used < limit));
        });

        // POST /api/usage/export -> claim one export. 402 when the monthly quota is exhausted.
        group.MapPost("/export", async (ClaimsPrincipal principal, UserManager<ApplicationUser> userManager, ApplicationDbContext db, CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var user = await userManager.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            var now = DateTime.UtcNow;
            var limit = await FreeLimitAsync(db, ct);

            if (IsPro(user))
            {
                // Unlimited; count toward lifetime metrics but not the free quota.
                user.TotalExports += 1;
                await userManager.UpdateAsync(user);
                return Results.Ok(Snapshot(user, limit, EffectiveUsed(user, now), allowed: true));
            }

            var used = EffectiveUsed(user, now);
            if (used >= limit)
            {
                return Results.Json(Snapshot(user, limit, used, allowed: false), statusCode: StatusCodes.Status402PaymentRequired);
            }

            // New month → reset the counter; otherwise increment within the period.
            if (IsNewPeriod(user, now))
            {
                user.FreeExportsUsed = 1;
                user.FreeExportsPeriodStart = now;
            }
            else
            {
                user.FreeExportsUsed += 1;
            }
            user.TotalExports += 1;

            var update = await userManager.UpdateAsync(user);
            if (!update.Succeeded)
                return Results.Problem("Could not record export.", statusCode: StatusCodes.Status500InternalServerError);

            return Results.Ok(Snapshot(user, limit, user.FreeExportsUsed, allowed: true));
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

    /// <summary>True when the stored counter belongs to a previous month.</summary>
    private static bool IsNewPeriod(ApplicationUser user, DateTime now) =>
        user.FreeExportsPeriodStart is not { } start || start.Year != now.Year || start.Month != now.Month;

    /// <summary>Exports counted in the current month (0 if the period rolled over).</summary>
    private static int EffectiveUsed(ApplicationUser user, DateTime now) =>
        IsNewPeriod(user, now) ? 0 : user.FreeExportsUsed;

    private static UsageResponse Snapshot(ApplicationUser user, int limit, int used, bool allowed)
    {
        var pro = IsPro(user);
        return new UsageResponse
        {
            IsPro = pro,
            FreeLimit = limit,
            ExportsUsed = used,
            Remaining = pro ? null : Math.Max(0, limit - used),
            Allowed = allowed,
        };
    }
}
