namespace SocialReviewCard.Models;

public class PlatformDto
{
    public int Id { get; set; }
    public string Label { get; set; } = "";
    public string Color { get; set; } = "";
    public string Icon { get; set; } = "";
    public int SortOrder { get; set; }
    public bool Enabled { get; set; }
}

/// <summary>Create/update payload for a platform from the admin panel.</summary>
public class PlatformUpsertRequest
{
    public string Label { get; set; } = "";
    public string Color { get; set; } = "#6d5efc";
    public string Icon { get; set; } = "fas:store";
    public int SortOrder { get; set; }
    public bool Enabled { get; set; } = true;
}
