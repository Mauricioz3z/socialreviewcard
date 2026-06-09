namespace SocialReviewCard.Models;

public class ReelThemeDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Json { get; set; } = "{}";
    public bool Enabled { get; set; }
    public int SortOrder { get; set; }
}

public class ReelThemeUpsertRequest
{
    public string Name { get; set; } = "";
    public string Json { get; set; } = "{}";
    public bool Enabled { get; set; } = true;
    public int SortOrder { get; set; }
}

/// <summary>What the SPA needs to drive the animation (no admin-only fields).</summary>
public class PublicReelThemeDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Json { get; set; } = "{}";
}
