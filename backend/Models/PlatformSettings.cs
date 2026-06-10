namespace SocialReviewCard.Models;

/// <summary>
/// Single-row table (Id == 1) holding all operator-tunable platform configuration:
/// monetization limits, upgrade copy, the free-plan watermark, and third-party
/// scripts. Editable from the admin backoffice so day-to-day tuning never needs
/// a code change or redeploy.
/// </summary>
public class PlatformSettings
{
    /// <summary>Fixed primary key — there is always exactly one settings row.</summary>
    public const int SingletonId = 1;

    public int Id { get; set; } = SingletonId;

    // ---- Monetization ----

    /// <summary>Lifetime free export allowance for non-Pro accounts.</summary>
    public int FreeExportLimit { get; set; } = 3;

    /// <summary>Display label for the Pro price (e.g. "$7/mo"). Cosmetic only.</summary>
    public string ProPriceLabel { get; set; } = "$7/mo";

    /// <summary>JSON array of Pro perk strings shown in the upgrade popup.</summary>
    public string ProFeaturesJson { get; set; } =
        "[\"Unlimited high-resolution exports\",\"No watermark on your cards\",\"Every premium template & background\"]";

    /// <summary>Title shown in the upgrade popup.</summary>
    public string UpgradeTitle { get; set; } = "You're out of free exports";

    /// <summary>Subtitle shown in the upgrade popup.</summary>
    public string UpgradeSubtitle { get; set; } = "Upgrade to ReviewCraft Pro to keep exporting";

    // ---- Free-plan watermark ----

    /// <summary>Whether free-plan exports get a watermark.</summary>
    public bool WatermarkEnabled { get; set; } = true;

    /// <summary>Watermark text stamped on free-plan exports.</summary>
    public string WatermarkText { get; set; } = "SocialReviewCard.com";

    // ---- Third-party scripts ----

    /// <summary>Raw HTML/JS injected into &lt;head&gt; (GTM, GA, Meta Pixel, Hotjar, ...).</summary>
    public string HeadScripts { get; set; } = "";

    /// <summary>Raw HTML/JS injected just before &lt;/body&gt;.</summary>
    public string BodyScripts { get; set; } = "";

    /// <summary>Last time an admin saved these settings.</summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
