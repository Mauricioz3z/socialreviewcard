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

        // ---- Platforms CRUD ----
        group.MapGet("/platforms", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var rows = await db.Platforms.AsNoTracking()
                .OrderBy(p => p.SortOrder)
                .Select(p => new PlatformDto
                {
                    Id = p.Id, Label = p.Label, Color = p.Color, Icon = p.Icon, SortOrder = p.SortOrder, Enabled = p.Enabled,
                })
                .ToListAsync(ct);
            return Results.Ok(rows);
        });

        group.MapPost("/platforms", async (
            [FromBody] PlatformUpsertRequest request,
            ApplicationDbContext db,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Label))
                return Results.BadRequest(new { error = "Label is required." });

            var p = new Platform
            {
                Label = request.Label.Trim(),
                Color = string.IsNullOrWhiteSpace(request.Color) ? "#6d5efc" : request.Color.Trim(),
                Icon = string.IsNullOrWhiteSpace(request.Icon) ? "fas:store" : request.Icon.Trim(),
                SortOrder = request.SortOrder,
                Enabled = request.Enabled,
            };
            db.Platforms.Add(p);
            await db.SaveChangesAsync(ct);
            await audit.LogAsync(AdminEmail(principal), "platform.create", p.Label, ClientIp(http), ct);
            return Results.Ok(new PlatformDto { Id = p.Id, Label = p.Label, Color = p.Color, Icon = p.Icon, SortOrder = p.SortOrder, Enabled = p.Enabled });
        });

        group.MapPut("/platforms/{id:int}", async (
            int id,
            [FromBody] PlatformUpsertRequest request,
            ApplicationDbContext db,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            var p = await db.Platforms.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (p is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(request.Label))
                return Results.BadRequest(new { error = "Label is required." });

            p.Label = request.Label.Trim();
            p.Color = string.IsNullOrWhiteSpace(request.Color) ? "#6d5efc" : request.Color.Trim();
            p.Icon = string.IsNullOrWhiteSpace(request.Icon) ? "fas:store" : request.Icon.Trim();
            p.SortOrder = request.SortOrder;
            p.Enabled = request.Enabled;
            await db.SaveChangesAsync(ct);
            await audit.LogAsync(AdminEmail(principal), "platform.update", p.Label, ClientIp(http), ct);
            return Results.Ok(new PlatformDto { Id = p.Id, Label = p.Label, Color = p.Color, Icon = p.Icon, SortOrder = p.SortOrder, Enabled = p.Enabled });
        });

        group.MapDelete("/platforms/{id:int}", async (
            int id,
            ApplicationDbContext db,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            var p = await db.Platforms.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (p is null) return Results.NotFound();
            db.Platforms.Remove(p);
            await db.SaveChangesAsync(ct);
            await audit.LogAsync(AdminEmail(principal), "platform.delete", p.Label, ClientIp(http), ct);
            return Results.NoContent();
        });

        // ---- Reel themes CRUD ----
        group.MapGet("/reel-themes", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var rows = await db.ReelThemes.AsNoTracking()
                .OrderBy(t => t.SortOrder)
                .Select(t => new ReelThemeDto { Id = t.Id, Name = t.Name, Json = t.Json, Enabled = t.Enabled, SortOrder = t.SortOrder })
                .ToListAsync(ct);
            return Results.Ok(rows);
        });

        group.MapPost("/reel-themes", async (
            [FromBody] ReelThemeUpsertRequest request,
            ApplicationDbContext db,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest(new { error = "Name is required." });
            if (!IsValidJson(request.Json)) return Results.BadRequest(new { error = "Theme JSON is invalid." });

            var t = new ReelTheme
            {
                Name = request.Name.Trim(),
                Json = request.Json,
                Enabled = request.Enabled,
                SortOrder = request.SortOrder,
                UpdatedAt = DateTime.UtcNow,
            };
            db.ReelThemes.Add(t);
            await db.SaveChangesAsync(ct);
            await audit.LogAsync(AdminEmail(principal), "reeltheme.create", t.Name, ClientIp(http), ct);
            return Results.Ok(new ReelThemeDto { Id = t.Id, Name = t.Name, Json = t.Json, Enabled = t.Enabled, SortOrder = t.SortOrder });
        });

        group.MapPut("/reel-themes/{id:int}", async (
            int id,
            [FromBody] ReelThemeUpsertRequest request,
            ApplicationDbContext db,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            var t = await db.ReelThemes.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (t is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest(new { error = "Name is required." });
            if (!IsValidJson(request.Json)) return Results.BadRequest(new { error = "Theme JSON is invalid." });

            t.Name = request.Name.Trim();
            t.Json = request.Json;
            t.Enabled = request.Enabled;
            t.SortOrder = request.SortOrder;
            t.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            await audit.LogAsync(AdminEmail(principal), "reeltheme.update", t.Name, ClientIp(http), ct);
            return Results.Ok(new ReelThemeDto { Id = t.Id, Name = t.Name, Json = t.Json, Enabled = t.Enabled, SortOrder = t.SortOrder });
        });

        group.MapDelete("/reel-themes/{id:int}", async (
            int id,
            ApplicationDbContext db,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            var t = await db.ReelThemes.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (t is null) return Results.NotFound();
            db.ReelThemes.Remove(t);
            await db.SaveChangesAsync(ct);
            await audit.LogAsync(AdminEmail(principal), "reeltheme.delete", t.Name, ClientIp(http), ct);
            return Results.NoContent();
        });

        // ---- Billing plans CRUD ----
        group.MapGet("/billing-plans", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var rows = await db.BillingPlans.AsNoTracking()
                .OrderBy(p => p.SortOrder)
                .Select(p => ToPlanDto(p))
                .ToListAsync(ct);
            return Results.Ok(rows);
        });

        group.MapPost("/billing-plans", async (
            [FromBody] BillingPlanUpsertRequest request,
            ApplicationDbContext db,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.StripePriceId))
                return Results.BadRequest(new { error = "Name and Stripe price id are required." });

            var p = ApplyPlan(new BillingPlan(), request);
            db.BillingPlans.Add(p);
            await db.SaveChangesAsync(ct);
            await EnsureSingleFeatured(db, p, ct);
            await audit.LogAsync(AdminEmail(principal), "plan.create", p.Name, ClientIp(http), ct);
            return Results.Ok(ToPlanDto(p));
        });

        group.MapPut("/billing-plans/{id:int}", async (
            int id,
            [FromBody] BillingPlanUpsertRequest request,
            ApplicationDbContext db,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            var p = await db.BillingPlans.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (p is null) return Results.NotFound();
            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.StripePriceId))
                return Results.BadRequest(new { error = "Name and Stripe price id are required." });

            ApplyPlan(p, request);
            await db.SaveChangesAsync(ct);
            await EnsureSingleFeatured(db, p, ct);
            await audit.LogAsync(AdminEmail(principal), "plan.update", p.Name, ClientIp(http), ct);
            return Results.Ok(ToPlanDto(p));
        });

        group.MapDelete("/billing-plans/{id:int}", async (
            int id,
            ApplicationDbContext db,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            var p = await db.BillingPlans.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (p is null) return Results.NotFound();
            db.BillingPlans.Remove(p);
            await db.SaveChangesAsync(ct);
            await audit.LogAsync(AdminEmail(principal), "plan.delete", p.Name, ClientIp(http), ct);
            return Results.NoContent();
        });

        // ---- Asset uploads ----
        group.MapPost("/assets", async (
            HttpRequest req,
            UploadStore store,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http) =>
        {
            if (!req.HasFormContentType) return Results.BadRequest(new { error = "Expected multipart form data." });
            var form = await req.ReadFormAsync();
            var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
            if (file is null || file.Length == 0) return Results.BadRequest(new { error = "No file uploaded." });
            if (file.Length > 2 * 1024 * 1024) return Results.BadRequest(new { error = "Max file size is 2 MB." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            string[] allowed = { ".svg", ".png", ".jpg", ".jpeg", ".webp" };
            if (!allowed.Contains(ext)) return Results.BadRequest(new { error = "Allowed types: SVG, PNG, JPG, WEBP." });

            var name = UploadStore.SafeName(file.FileName);
            await using (var fs = File.Create(store.PathFor(name)))
                await file.CopyToAsync(fs);
            await audit.LogAsync(AdminEmail(principal), "asset.upload", name, ClientIp(http));
            return Results.Ok(new { name, url = "/uploads/" + name, size = file.Length });
        })
        .DisableAntiforgery();

        group.MapGet("/assets", (UploadStore store) =>
        {
            if (!Directory.Exists(store.Root)) return Results.Ok(Array.Empty<object>());
            var files = new DirectoryInfo(store.Root).GetFiles()
                .OrderByDescending(f => f.LastWriteTimeUtc)
                .Select(f => new { name = f.Name, url = "/uploads/" + f.Name, size = f.Length });
            return Results.Ok(files);
        });

        group.MapDelete("/assets/{name}", async (
            string name,
            UploadStore store,
            IAuditLogger audit,
            ClaimsPrincipal principal,
            HttpContext http) =>
        {
            var path = store.PathFor(name);
            if (!File.Exists(path)) return Results.NotFound();
            File.Delete(path);
            await audit.LogAsync(AdminEmail(principal), "asset.delete", Path.GetFileName(name), ClientIp(http));
            return Results.NoContent();
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
        IsPro = u.IsLifetime || string.Equals(u.SubscriptionStatus, "active", StringComparison.OrdinalIgnoreCase),
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

    private static BillingPlan ApplyPlan(BillingPlan p, BillingPlanUpsertRequest r)
    {
        p.Name = r.Name.Trim();
        p.StripePriceId = r.StripePriceId.Trim();
        p.Kind = r.Kind == "lifetime" ? "lifetime" : "subscription";
        p.PriceLabel = r.PriceLabel ?? "";
        p.Interval = string.IsNullOrWhiteSpace(r.Interval) ? "month" : r.Interval.Trim();
        p.Enabled = r.Enabled;
        p.SortOrder = r.SortOrder;
        p.Featured = r.Featured;
        p.MaxRedemptions = r.MaxRedemptions;
        return p;
    }

    private static async Task EnsureSingleFeatured(ApplicationDbContext db, BillingPlan p, CancellationToken ct)
    {
        if (!p.Featured) return;
        await db.BillingPlans.Where(x => x.Id != p.Id && x.Featured)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Featured, false), ct);
    }

    private static BillingPlanDto ToPlanDto(BillingPlan p) => new()
    {
        Id = p.Id, Name = p.Name, StripePriceId = p.StripePriceId, Kind = p.Kind, PriceLabel = p.PriceLabel,
        Interval = p.Interval, Enabled = p.Enabled, SortOrder = p.SortOrder, Featured = p.Featured, MaxRedemptions = p.MaxRedemptions,
    };

    private static bool IsValidJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            using var _ = JsonDocument.Parse(json);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static string AdminEmail(ClaimsPrincipal principal) =>
        principal.FindFirstValue(ClaimTypes.Email) ?? principal.Identity?.Name ?? "admin";

    private static string? ClientIp(HttpContext http) =>
        http.Request.Headers.TryGetValue("X-Forwarded-For", out var fwd) && fwd.Count > 0
            ? fwd.ToString().Split(',')[0].Trim()
            : http.Connection.RemoteIpAddress?.ToString();
}
