namespace SocialReviewCard.Models;

// ---- Admin auth ----

public class AdminLoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

// ---- Dashboard metrics ----

public class AdminMetricsResponse
{
    public int TotalUsers { get; set; }
    public int ProUsers { get; set; }
    public int FreeUsers { get; set; }
    public int NewUsers7d { get; set; }
    public int NewUsers30d { get; set; }
    public int TotalCards { get; set; }
    public long TotalExports { get; set; }
    public long FreeExportsUsed { get; set; }
}

// ---- User management ----

public class AdminUserDto
{
    public string Id { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string SubscriptionStatus { get; set; } = "free";
    public bool IsPro { get; set; }
    public DateTime? SubscriptionEndDate { get; set; }
    public int FreeExportsUsed { get; set; }
    public int TotalExports { get; set; }
    public string? StripeCustomerId { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsAdmin { get; set; }
}

public class AdminUserListResponse
{
    public int Total { get; set; }
    public List<AdminUserDto> Items { get; set; } = new();
}

/// <summary>Partial update of a user from the admin panel. Null fields are left unchanged.</summary>
public class AdminUserUpdateRequest
{
    public string? SubscriptionStatus { get; set; }
    public int? FreeExportsUsed { get; set; }
    public DateTime? SubscriptionEndDate { get; set; }
}

// ---- Platform settings (admin read/write) ----

public class PlatformSettingsDto
{
    public int FreeExportLimit { get; set; }
    public string ProPriceLabel { get; set; } = "";
    public List<string> ProFeatures { get; set; } = new();
    public string UpgradeTitle { get; set; } = "";
    public string UpgradeSubtitle { get; set; } = "";
    public bool WatermarkEnabled { get; set; }
    public string WatermarkText { get; set; } = "";
    public string HeadScripts { get; set; } = "";
    public string BodyScripts { get; set; } = "";
    public DateTime UpdatedAt { get; set; }
}

// ---- Audit log ----

public class AuditLogDto
{
    public Guid Id { get; set; }
    public DateTime TimestampUtc { get; set; }
    public string ActorEmail { get; set; } = "";
    public string Action { get; set; } = "";
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
}

public class AuditLogListResponse
{
    public int Total { get; set; }
    public List<AuditLogDto> Items { get; set; } = new();
}

// ---- Public runtime config (anonymous) consumed by the SPA ----

public class PublicConfigResponse
{
    public int FreeExportLimit { get; set; }
    public string ProPriceLabel { get; set; } = "";
    public List<string> ProFeatures { get; set; } = new();
    public string UpgradeTitle { get; set; } = "";
    public string UpgradeSubtitle { get; set; } = "";
    public bool WatermarkEnabled { get; set; }
    public string WatermarkText { get; set; } = "";
    public string HeadScripts { get; set; } = "";
    public string BodyScripts { get; set; } = "";
    public List<PlatformDto> Platforms { get; set; } = new();
}
