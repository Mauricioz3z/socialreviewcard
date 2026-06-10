using Microsoft.AspNetCore.Identity;
using SocialReviewCard.Models;
using SocialReviewCard.Services;
using System.Security.Claims;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// Screenshot import: the user uploads a screenshot of a customer review and a
/// vision LLM extracts the text/name/rating/platform so the editor fills itself.
/// Auth-gated and rate-limited per day because every call hits a paid API.
/// </summary>
public static class ScanEndpoints
{
    /// <summary>Upload cap. Frontend downscales before upload; nginx caps the body at 4 MB.</summary>
    private const long MaxImageBytes = 4 * 1024 * 1024;

    public static IEndpointRouteBuilder MapScanEndpoints(this IEndpointRouteBuilder routes)
    {
        // POST /api/scan/review (multipart/form-data, field "image")
        routes.MapPost("/api/scan/review", async (
            HttpRequest request,
            ClaimsPrincipal principal,
            UserManager<ApplicationUser> userManager,
            IReviewScanner scanner,
            ScanQuotaTracker quota,
            Microsoft.Extensions.Options.IOptions<AnthropicOptions> options,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
        {
            if (!scanner.IsConfigured)
                return Results.Problem("Screenshot import isn't available right now.",
                    statusCode: StatusCodes.Status503ServiceUnavailable);

            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();
            var user = await userManager.FindByIdAsync(userId);
            if (user is null) return Results.Unauthorized();

            if (!request.HasFormContentType)
                return Results.BadRequest(new { detail = "Send the screenshot as multipart/form-data." });

            // Defense-in-depth: cap the body at Kestrel level too, so a direct
            // hit on :5080 (bypassing nginx's client_max_body_size) can't make
            // ReadFormAsync buffer an arbitrarily large upload.
            var sizeFeature = request.HttpContext.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
            if (sizeFeature is { IsReadOnly: false })
                sizeFeature.MaxRequestBodySize = MaxImageBytes + 64 * 1024; // + multipart overhead

            var form = await request.ReadFormAsync(ct);
            var file = form.Files.GetFile("image");
            if (file is null || file.Length == 0)
                return Results.BadRequest(new { detail = "Attach a screenshot image." });
            if (file.Length > MaxImageBytes)
                return Results.BadRequest(new { detail = "Image is too large (max 4 MB)." });

            byte[] bytes;
            await using (var stream = file.OpenReadStream())
            using (var ms = new MemoryStream((int)file.Length))
            {
                await stream.CopyToAsync(ms, ct);
                bytes = ms.ToArray();
            }

            // Never trust the client-asserted Content-Type: sniff the magic
            // bytes and forward the *detected* media type to the vision API.
            var mediaType = SniffImageType(bytes);
            if (mediaType is null)
                return Results.BadRequest(new { detail = "Use a PNG, JPEG, WebP or GIF screenshot." });

            // Daily cap: Pro accounts get a higher ceiling, never unlimited.
            // Claimed only after validation so a bad file doesn't burn a scan.
            var isPro = user.IsLifetime ||
                        string.Equals(user.SubscriptionStatus, "active", StringComparison.OrdinalIgnoreCase);
            var limit = isPro ? options.Value.ProDailyScanLimit : options.Value.FreeDailyScanLimit;
            if (!quota.TryClaim(userId, limit, out _))
            {
                return Results.Json(
                    new { detail = $"Daily screenshot limit reached ({limit}/day). Try again tomorrow." },
                    statusCode: StatusCodes.Status429TooManyRequests);
            }

            try
            {
                var result = await scanner.ScanAsync(bytes, mediaType, ct);
                return Results.Ok(new
                {
                    found = result.Found,
                    review = result.Review,
                    reviewerName = result.ReviewerName,
                    rating = result.Rating,
                    platform = result.Platform,
                });
            }
            catch (ReviewScanException ex)
            {
                loggerFactory.CreateLogger("ScanEndpoints")
                    .LogWarning(ex, "Review scan failed for user {UserId}", userId);
                // ReviewScanException messages are a closed set of generic,
                // client-safe constants (see ReviewScanner) — never provider output.
                return Results.Problem(ex.Message, statusCode: StatusCodes.Status502BadGateway);
            }
        })
        .RequireAuthorization()
        // Bearer-token auth — CSRF doesn't apply; required for multipart
        // form reading in .NET 8 minimal APIs.
        .DisableAntiforgery()
        .WithTags("Scan");

        return routes;
    }

    /// <summary>
    /// Detects the image format from its magic bytes. Returns the canonical
    /// media type, or null when the content is not a supported image.
    /// </summary>
    private static string? SniffImageType(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < 12) return null;
        if (bytes[..4].SequenceEqual("\x89PNG"u8)) return "image/png";
        if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return "image/jpeg";
        if (bytes[..4].SequenceEqual("GIF8"u8)) return "image/gif";
        if (bytes[..4].SequenceEqual("RIFF"u8) && bytes[8..12].SequenceEqual("WEBP"u8)) return "image/webp";
        return null;
    }
}
