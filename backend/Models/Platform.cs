namespace SocialReviewCard.Models;

/// <summary>
/// A review source (Etsy, Shopify, Instagram, …) shown as a pill on the card.
/// Managed from the admin backoffice so new platforms can be added without a
/// code change. The card stores the platform's <see cref="Label"/> as a string,
/// so unknown/free-text sources still render (as a "Custom" label).
/// </summary>
public class Platform
{
    public int Id { get; set; }

    /// <summary>Display name and the value persisted on the card (e.g. "Etsy").</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>Accent color (hex) for the pill icon.</summary>
    public string Color { get; set; } = "#6d5efc";

    /// <summary>Icon token "prefix:name" resolved by FontAwesome (e.g. "fab:instagram").</summary>
    public string Icon { get; set; } = "fas:store";

    /// <summary>Ordering in the picker (ascending).</summary>
    public int SortOrder { get; set; }

    /// <summary>Hidden from the picker when false (kept for existing cards).</summary>
    public bool Enabled { get; set; } = true;
}
