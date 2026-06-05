using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SocialReviewCard.Data;
using SocialReviewCard.Models;

namespace SocialReviewCard.Endpoints;

/// <summary>
/// CRUD endpoints for a user's saved review-card configurations. All routes
/// require an authenticated caller.
/// </summary>
public static class CardEndpoints
{
    public static RouteGroupBuilder MapCardEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/cards")
            .RequireAuthorization()
            .WithTags("Cards");

        // GET /api/cards -> all cards for the authenticated user (newest first).
        group.MapGet("/", async (ClaimsPrincipal principal, ApplicationDbContext db, CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var cards = await db.ReviewCards
                .AsNoTracking()
                .Where(c => c.UserId == userId)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => CardResponse.FromEntity(c))
                .ToListAsync(ct);

            return Results.Ok(cards);
        });

        // POST /api/cards -> create or update a card configuration.
        group.MapPost("/", async (
            [FromBody] CardUpsertRequest request,
            ClaimsPrincipal principal,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var validation = ValidateModel(request);
            if (validation is not null) return validation;

            ReviewCard card;

            if (request.Id is Guid existingId)
            {
                var existing = await db.ReviewCards.FirstOrDefaultAsync(c => c.Id == existingId, ct);
                if (existing is null) return Results.NotFound();

                // Never allow editing a card that belongs to someone else.
                if (existing.UserId != userId)
                    return Results.Forbid();

                card = existing;

                card.ReviewText = request.ReviewText;
                card.ReviewerName = request.ReviewerName;
                card.Rating = request.Rating;
                card.Platform = request.Platform;
                card.StylesJson = request.StylesJson;

                await db.SaveChangesAsync(ct);
                return Results.Ok(CardResponse.FromEntity(card));
            }

            card = new ReviewCard
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ReviewText = request.ReviewText,
                ReviewerName = request.ReviewerName,
                Rating = request.Rating,
                Platform = request.Platform,
                StylesJson = request.StylesJson,
                CreatedAt = DateTime.UtcNow,
            };

            db.ReviewCards.Add(card);
            await db.SaveChangesAsync(ct);

            return Results.Created($"/api/cards/{card.Id}", CardResponse.FromEntity(card));
        });

        // DELETE /api/cards/{id} -> delete a card owned by the caller.
        group.MapDelete("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal principal,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var userId = principal.GetUserId();
            if (userId is null) return Results.Unauthorized();

            var card = await db.ReviewCards.FirstOrDefaultAsync(c => c.Id == id, ct);
            if (card is null) return Results.NotFound();
            if (card.UserId != userId) return Results.Forbid();

            db.ReviewCards.Remove(card);
            await db.SaveChangesAsync(ct);

            return Results.NoContent();
        });

        return group;
    }

    private static IResult? ValidateModel(CardUpsertRequest request)
    {
        var context = new System.ComponentModel.DataAnnotations.ValidationContext(request);
        var results = new List<System.ComponentModel.DataAnnotations.ValidationResult>();
        if (System.ComponentModel.DataAnnotations.Validator.TryValidateObject(request, context, results, validateAllProperties: true))
            return null;

        var errors = results
            .GroupBy(r => r.MemberNames.FirstOrDefault() ?? string.Empty)
            .ToDictionary(g => g.Key, g => g.Select(r => r.ErrorMessage ?? "Invalid").ToArray());

        return Results.ValidationProblem(errors);
    }

    /// <summary>Resolves the Identity user id from the current principal.</summary>
    public static string? GetUserId(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(ClaimTypes.NameIdentifier);
}
