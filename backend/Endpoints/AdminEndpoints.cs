using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SocialReviewCard.Data;
using SocialReviewCard.Models;
using SocialReviewCard.Services;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// Backoffice API. Login is email/password (admin accounts only); everything
/// else requires the "Admin" role. The SPA reaches these from the secret
/// /chuchubeleza route.
/// </summary>
public static class AdminEndpoints
{
    public const string AdminRole = "Admin";

    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder routes)
    {
        // ---- Admin login (anonymous) ----
        routes.MapPost("/api/admin/login", async (
            [FromBody] AdminLoginRequest request,
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            IAuditLogger audit,
            HttpContext http) =>
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
                return Results.BadRequest(new { error = "Email and password are required." });

            var user = await userManager.FindByEmailAsync(request.Email.Trim());
            if (user is null || !await userManager.IsInRoleAsync(user, AdminRole))
                return Results.Unauthorized();

            var check = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
            if (!check.Succeeded)
                return Results.Unauthorized();

            await audit.LogAsync(user.Email ?? "admin", "admin.login", null, ClientIp(http));

            signInManager.AuthenticationScheme = IdentityConstants.BearerScheme;
            await signInManager.SignInAsync(user, isPersistent: false);
            return Results.Empty;
        })
        .AllowAnonymous()
        .WithTags("Admin");

        // ---- Everything below requires the Admin role ----
        var group = routes.MapGroup("/api/admin")
            .RequireAuthorization(AdminRole)
            .WithTags("Admin");

        // GET /api/admin/me -> confirms the caller is an authenticated admin.
        group.MapGet("/me", (ClaimsPrincipal principal) =>
            Results.Ok(new { email = AdminEmail(principal) }));

        // GET /api/admin/metrics -> dashboard numbers.
        group.MapGet("/metrics", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var now = DateTime.UtcNow;
            var users = db.Users;

            var metrics = new AdminMetricsResponse
            {
                TotalUsers = await users.CountAsync(ct),
                ProUsers = await users.CountAsync(u => u.SubscriptionStatus == "active", ct),
                NewUsers7d = await users.CountAsync(u => u.CreatedAt >= now.AddDays(-7), ct),
                NewUsers30d = await users.CountAsync(u => u.CreatedAt >= now.AddDays(-30), ct),
                TotalCards = await db.ReviewCards.CountAsync(ct),
                TotalExports = await users.SumAsync(u => (long)u.TotalExports, ct),
                FreeExportsUsed = await users.SumAsync(u => (long)u.FreeExportsUsed, ct),
            };
            metrics.FreeUsers = metrics.TotalUsers - metrics.ProUsers;
            return Results.Ok(metrics);
        });

        // GET /api/admin/users?search=&skip=&take=
        group.MapGet("/users", async (
            ApplicationDbContext db,
            UserManager<ApplicationUser> userManager,
            string? search,
            int skip,
            int take,
            CancellationToken ct) =>
        {
            take = take is <= 0 or > 100 ? 25 : take;
            skip = skip < 0 ? 0 : skip;

            var q = db.Users.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                q = q.Where(u => u.Email!.ToLower().Contains(term));
            }

            var total = await q.CountAsync(ct);
            var rows = await q.OrderByDescending(u => u.CreatedAt)
                .Skip(skip).Take(take)
                .ToListAsync(ct);

            // Resolve admin role membership for the page.
            var adminUsers = await userManager.GetUsersInRoleAsync(AdminRole);
            var adminIds = adminUsers.Select(a => a.Id).ToHashSet();

            return Results.Ok(new AdminUserListResponse
            {
                Total = total,
                Items = rows.Select(u => ToDto(u, adminIds.Contains(u.Id))).ToList(),
            });
        });

        // PATCH /api/admin/users/{id}
        group.MapPatch("/users/{id}", async (
            string id,
            [FromBody] AdminUserUpdateRequest request,
            UserManager<ApplicationUser> userManager,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null) return Results.NotFound();

            var changes = new List<string>();
            if (request.SubscriptionStatus is { } status && status != user.SubscriptionStatus)
            {
                changes.Add($"status {user.SubscriptionStatus}->{status}");
                user.SubscriptionStatus = status;
            }
            if (request.FreeExportsUsed is { } used && used != user.FreeExportsUsed)
            {
                changes.Add($"freeExportsUsed {user.FreeExportsUsed}->{used}");
                user.FreeExportsUsed = Math.Max(0, used);
            }
            if (request.SubscriptionEndDate.HasValue)
            {
                user.SubscriptionEndDate = request.SubscriptionEndDate;
                changes.Add("subscriptionEndDate updated");
            }

            var update = await userManager.UpdateAsync(user);
            if (!update.Succeeded)
                return Results.Problem("Could not update user.", statusCode: StatusCodes.Status500InternalServerError);

            await audit.LogAsync(AdminEmail(principal), "user.update",
                $"{user.Email}: {(changes.Count == 0 ? "no changes" : string.Join(", ", changes))}", ClientIp(http), ct);

            var isAdmin = await userManager.IsInRoleAsync(user, AdminRole);
            return Results.Ok(ToDto(user, isAdmin));
        });

        // DELETE /api/admin/users/{id}
        group.MapDelete("/users/{id}", async (
            string id,
            UserManager<ApplicationUser> userManager,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http) =>
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null) return Results.NotFound();

            // Don't allow deleting admin accounts from the panel.
            if (await userManager.IsInRoleAsync(user, AdminRole))
                return Results.BadRequest(new { error = "Admin accounts cannot be deleted here." });

            var email = user.Email;
            var del = await userManager.DeleteAsync(user);
            if (!del.Succeeded)
                return Results.Problem("Could not delete user.", statusCode: StatusCodes.Status500InternalServerError);

            await audit.LogAsync(AdminEmail(principal), "user.delete", email, ClientIp(http));
            return Results.NoContent();
        });

        // GET /api/admin/settings
        group.MapGet("/settings", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var s = await GetSettingsAsync(db, ct);
            return Results.Ok(ToSettingsDto(s));
        });

        // PUT /api/admin/settings
        group.MapPut("/settings", async (
            [FromBody] PlatformSettingsDto dto,
            ApplicationDbContext db,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            var s = await GetSettingsAsync(db, ct);

            s.FreeExportLimit = Math.Max(0, dto.FreeExportLimit);
            s.ProPriceLabel = dto.ProPriceLabel ?? "";
            s.ProFeaturesJson = JsonSerializer.Serialize(dto.ProFeatures ?? new());
            s.UpgradeTitle = dto.UpgradeTitle ?? "";
            s.UpgradeSubtitle = dto.UpgradeSubtitle ?? "";
            s.WatermarkEnabled = dto.WatermarkEnabled;
            s.WatermarkText = dto.WatermarkText ?? "";
            s.HeadScripts = dto.HeadScripts ?? "";
            s.BodyScripts = dto.BodyScripts ?? "";
            s.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);
            await audit.LogAsync(AdminEmail(principal), "settings.update", null, ClientIp(http), ct);

            return Results.Ok(ToSettingsDto(s));
        });

        // GET /api/admin/feedback?skip=&take=
        group.MapGet("/feedback", async (ApplicationDbContext db, int skip, int take, CancellationToken ct) =>
        {
            take = take is <= 0 or > 200 ? 50 : take;
            skip = skip < 0 ? 0 : skip;

            var total = await db.Feedback.CountAsync(ct);
            var unhandled = await db.Feedback.CountAsync(f => !f.Handled, ct);
            var rows = await db.Feedback.AsNoTracking()
                .OrderByDescending(f => f.CreatedAt)
                .Skip(skip).Take(take)
                .Select(f => new FeedbackDto
                {
                    Id = f.Id,
                    CreatedAt = f.CreatedAt,
                    Type = f.Type,
                    Message = f.Message,
                    Email = f.Email,
                    Handled = f.Handled,
                    IpAddress = f.IpAddress,
                })
                .ToListAsync(ct);

            return Results.Ok(new FeedbackListResponse { Total = total, Unhandled = unhandled, Items = rows });
        });

        // PATCH /api/admin/feedback/{id} -> toggle handled flag.
        group.MapPatch("/feedback/{id:guid}", async (
            Guid id,
            [FromBody] FeedbackHandledRequest request,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var fb = await db.Feedback.FirstOrDefaultAsync(f => f.Id == id, ct);
            if (fb is null) return Results.NotFound();
            fb.Handled = request.Handled;
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { ok = true });
        });

        // GET /api/admin/audit?skip=&take=
        group.MapGet("/audit", async (ApplicationDbContext db, int skip, int take, CancellationToken ct) =>
        {
            take = take is <= 0 or > 200 ? 50 : take;
            skip = skip < 0 ? 0 : skip;

            var total = await db.AuditLogs.CountAsync(ct);
            var rows = await db.AuditLogs.AsNoTracking()
                .OrderByDescending(a => a.TimestampUtc)
                .Skip(skip).Take(take)
                .Select(a => new AuditLogDto
                {
                    Id = a.Id,
                    TimestampUtc = a.TimestampUtc,
                    ActorEmail = a.ActorEmail,
                    Action = a.Action,
                    Details = a.Details,
                    IpAddress = a.IpAddress,
                })
                .ToListAsync(ct);

            return Results.Ok(new AuditLogListResponse { Total = total, Items = rows });
        });

        return routes;
    }

    // ---- helpers ----

    private static async Task<PlatformSettings> GetSettingsAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var s = await db.PlatformSettings.FirstOrDefaultAsync(x => x.Id == PlatformSettings.SingletonId, ct);
        if (s is null)
        {
            s = new PlatformSettings();
            db.PlatformSettings.Add(s);
            await db.SaveChangesAsync(ct);
        }
        return s;
    }

    private static AdminUserDto ToDto(ApplicationUser u, bool isAdmin) => new()
    {
        Id = u.Id,
        Email = u.Email,
        SubscriptionStatus = u.SubscriptionStatus,
        IsPro = string.Equals(u.SubscriptionStatus, "active", StringComparison.OrdinalIgnoreCase),
        SubscriptionEndDate = u.SubscriptionEndDate,
        FreeExportsUsed = u.FreeExportsUsed,
        TotalExports = u.TotalExports,
        StripeCustomerId = u.StripeCustomerId,
        CreatedAt = u.CreatedAt,
        IsAdmin = isAdmin,
    };

    private static PlatformSettingsDto ToSettingsDto(PlatformSettings s) => new()
    {
        FreeExportLimit = s.FreeExportLimit,
        ProPriceLabel = s.ProPriceLabel,
        ProFeatures = ConfigEndpoints.ParseFeatures(s.ProFeaturesJson),
        UpgradeTitle = s.UpgradeTitle,
        UpgradeSubtitle = s.UpgradeSubtitle,
        WatermarkEnabled = s.WatermarkEnabled,
        WatermarkText = s.WatermarkText,
        HeadScripts = s.HeadScripts,
        BodyScripts = s.BodyScripts,
        UpdatedAt = s.UpdatedAt,
    };

    private static string AdminEmail(ClaimsPrincipal principal) =>
        principal.FindFirstValue(ClaimTypes.Email) ?? principal.Identity?.Name ?? "admin";

    private static string? ClientIp(HttpContext http) =>
        http.Request.Headers.TryGetValue("X-Forwarded-For", out var fwd) && fwd.Count > 0
            ? fwd.ToString().Split(',')[0].Trim()
            : http.Connection.RemoteIpAddress?.ToString();
}
