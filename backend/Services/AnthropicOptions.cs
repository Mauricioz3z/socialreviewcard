namespace SocialReviewCard.Services;

/// <summary>Strongly-typed binding of the "Anthropic" configuration section.</summary>
public class AnthropicOptions
{
    public const string SectionName = "Anthropic";

    /// <summary>API key (sk-ant-...). Empty disables the screenshot-import feature.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Vision-capable model used to read review screenshots. Haiku is the
    /// cheapest tier that handles OCR + structured extraction reliably.
    /// </summary>
    public string Model { get; set; } = "claude-haiku-4-5-20251001";

    /// <summary>Daily screenshot scans allowed per free account.</summary>
    public int FreeDailyScanLimit { get; set; } = 5;

    /// <summary>Daily screenshot scans allowed per Pro account.</summary>
    public int ProDailyScanLimit { get; set; } = 50;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}
