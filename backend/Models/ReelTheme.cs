namespace SocialReviewCard.Models;

/// <summary>
/// An animated-video (Reel) template. Stores the full ReelTheme JSON consumed by
/// the client engine, so art direction can be tuned from the admin without a
/// code change.
/// </summary>
public class ReelTheme
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>The ReelTheme JSON (matches the frontend schema).</summary>
    public string Json { get; set; } = "{}";

    public bool Enabled { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
