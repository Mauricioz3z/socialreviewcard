using System.ComponentModel.DataAnnotations;

namespace SocialReviewCard.Models;

/// <summary>
/// A saved review card configuration. The backend never renders images — it only
/// persists the metadata + styling so the React client can rebuild the card and
/// rasterize it locally with html2canvas.
/// </summary>
public class ReviewCard
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Foreign key to <see cref="ApplicationUser"/>.</summary>
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [MaxLength(2000)]
    public string ReviewText { get; set; } = string.Empty;

    [Required]
    [MaxLength(120)]
    public string ReviewerName { get; set; } = string.Empty;

    [Range(1, 5)]
    public int Rating { get; set; } = 5;

    [Required]
    [MaxLength(40)]
    public string Platform { get; set; } = "Custom";

    /// <summary>
    /// Opaque JSON blob holding all visual styling (background, gradient, card style,
    /// font, aspect ratio, grain, avatar mode, etc.). Stored verbatim as text.
    /// </summary>
    [Required]
    public string StylesJson { get; set; } = "{}";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Navigation back to the owning user.</summary>
    public ApplicationUser? User { get; set; }
}
