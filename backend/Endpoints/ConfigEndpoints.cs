using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SocialReviewCard.Data;
using SocialReviewCard.Models;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// Anonymous runtime configuration the SPA fetches on load: third-party scripts,
/// the free-plan watermark, and monetization copy. Contains no secrets.
/// </summary>
public static class ConfigEndpoints
{
    public static IEndpointRouteBuilder MapConfigEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/api/config", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var s = await db.PlatformSettings.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == PlatformSettings.SingletonId, ct);

            // Fall back to defaults if the row is somehow missing.
            s ??= new PlatformSettings();

            var platforms = await db.Platforms.AsNoTracking()
                .Where(p => p.Enabled)
                .OrderBy(p => p.SortOrder)
                .Select(p => new PlatformDto
                {
                    Id = p.Id, Label = p.Label, Color = p.Color, Icon = p.Icon, SortOrder = p.SortOrder, Enabled = p.Enabled,
                })
                .ToListAsync(ct);

            return Results.Ok(new PublicConfigResponse
            {
                Platforms = platforms,
                FreeExportLimit = s.FreeExportLimit,
                ProPriceLabel = s.ProPriceLabel,
                ProFeatures = ParseFeatures(s.ProFeaturesJson),
                UpgradeTitle = s.UpgradeTitle,
                UpgradeSubtitle = s.UpgradeSubtitle,
                WatermarkEnabled = s.WatermarkEnabled,
                WatermarkText = s.WatermarkText,
                HeadScripts = s.HeadScripts,
                BodyScripts = s.BodyScripts,
            });
        })
        .AllowAnonymous()
        .WithTags("Config");

        // GET /api/reel-themes -> enabled animation themes for the video studio.
        routes.MapGet("/api/reel-themes", async (ApplicationDbContext db, CancellationToken ct) =>
        {
            var themes = await db.ReelThemes.AsNoTracking()
                .Where(t => t.Enabled)
                .OrderBy(t => t.SortOrder)
                .Select(t => new PublicReelThemeDto { Id = t.Id, Name = t.Name, Json = t.Json })
                .ToListAsync(ct);
            return Results.Ok(themes);
        })
        .AllowAnonymous()
        .WithTags("Config");

        return routes;
    }

    /// <summary>Parses the stored JSON array of perk strings, tolerating bad data.</summary>
    public static List<string> ParseFeatures(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new();
        }
        catch (JsonException)
        {
            return new();
        }
    }
}
