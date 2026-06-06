using SocialReviewCard.Data;
using SocialReviewCard.Models;

namespace SocialReviewCard.Services;

/// <summary>Writes <see cref="AuditLog"/> entries.</summary>
public interface IAuditLogger
{
    Task LogAsync(string actorEmail, string action, string? details, string? ipAddress, CancellationToken ct = default);
}

public class AuditLogger : IAuditLogger
{
    private readonly ApplicationDbContext _db;

    public AuditLogger(ApplicationDbContext db) => _db = db;

    public async Task LogAsync(string actorEmail, string action, string? details, string? ipAddress, CancellationToken ct = default)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            ActorEmail = string.IsNullOrWhiteSpace(actorEmail) ? "system" : actorEmail,
            Action = action,
            Details = details,
            IpAddress = ipAddress,
        });
        await _db.SaveChangesAsync(ct);
    }
}
