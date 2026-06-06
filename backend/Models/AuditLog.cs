namespace SocialReviewCard.Models;

/// <summary>
/// Append-only record of notable admin/operational actions, for audit and
/// troubleshooting. Written by <see cref="Services.IAuditLogger"/>.
/// </summary>
public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;

    /// <summary>Email of the admin (or "system") that performed the action.</summary>
    public string ActorEmail { get; set; } = "system";

    /// <summary>Short machine-ish action code, e.g. "user.update", "settings.update".</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>Free-form human-readable detail of what changed.</summary>
    public string? Details { get; set; }

    /// <summary>Remote IP that initiated the action, when available.</summary>
    public string? IpAddress { get; set; }
}
