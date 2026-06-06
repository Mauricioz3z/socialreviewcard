using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using SocialReviewCard.Data;
using SocialReviewCard.Models;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// Public endpoint receiving messages from the in-app feedback form. Admins read
/// them via <see cref="AdminEndpoints"/>.
/// </summary>
public static class FeedbackEndpoints
{
    private static readonly string[] AllowedTypes = { "suggestion", "criticism", "support" };

    public static IEndpointRouteBuilder MapFeedbackEndpoints(this IEndpointRouteBuilder routes)
    {
        // POST /api/feedback -> store a message. Anonymous; captures the user id
        // when a valid token happens to be present.
        routes.MapPost("/api/feedback", async (
            [FromBody] FeedbackRequest request,
            ApplicationDbContext db,
            ClaimsPrincipal principal,
            HttpContext http,
            CancellationToken ct) =>
        {
            var message = request.Message?.Trim() ?? "";
            if (message.Length < 3)
                return Results.BadRequest(new { error = "Please write a longer message." });
            if (message.Length > 4000)
                message = message[..4000];

            var type = AllowedTypes.Contains(request.Type) ? request.Type : "suggestion";
            var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
            if (email is { Length: > 256 }) email = email[..256];

            db.Feedback.Add(new Feedback
            {
                Type = type,
                Message = message,
                Email = email,
                UserId = principal.GetUserId(),
                IpAddress = http.Request.Headers.TryGetValue("X-Forwarded-For", out var fwd) && fwd.Count > 0
                    ? fwd.ToString().Split(',')[0].Trim()
                    : http.Connection.RemoteIpAddress?.ToString(),
            });
            await db.SaveChangesAsync(ct);

            return Results.Ok(new { ok = true });
        })
        .AllowAnonymous()
        .WithTags("Feedback");

        return routes;
    }
}
